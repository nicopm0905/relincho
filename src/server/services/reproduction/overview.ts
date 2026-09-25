import "server-only";
import type { PrismaClient } from "@/server/db/prisma";
import { parseReproSettings, type ReproSettings } from "@/lib/repro-settings";
import {
  mareInsight,
  seasonCategory,
  type MareHistory,
  type MareInsight,
  type SeasonCategory,
} from "@/lib/repro-engine";
import { milestoneTaskKey } from "@/lib/repro-gestation";
import { coveringResult } from "@/lib/reproduction";

export async function loadReproSettings(tx: PrismaClient, tenantId: string): Promise<ReproSettings> {
  const row = await tx.reproSettings.findUnique({ where: { tenantId } });
  return parseReproSettings(row?.config);
}

const coveringSelect = {
  id: true,
  cycleId: true,
  date: true,
  method: true,
  dosesUsed: true,
  externalStallionName: true,
  stallion: { select: { id: true, name: true } },
  pregnancyChecks: { select: { date: true, result: true }, orderBy: { date: "asc" as const } },
  foaling: {
    select: {
      date: true,
      alive: true,
      foalStoodMinutes: true,
      foalSuckledMinutes: true,
      placentaMinutes: true,
      meconiumPassed: true,
      foalIggMgDl: true,
      complications: true,
    },
  },
  foalingWatch: {
    select: { date: true, udderScore: true, wax: true, milkCalciumPpm: true, relaxation: true },
    orderBy: { date: "asc" as const },
  },
};

const examSelect = {
  id: true,
  cycleId: true,
  date: true,
  teasingScore: true,
  leftFollicleMm: true,
  rightFollicleMm: true,
  corpusLuteum: true,
  uterineEdema: true,
  uterineFluidMm: true,
  cervix: true,
  ovulated: true,
  treatments: true,
};

/**
 * Historial reproductivo completo de un conjunto de yeguas, agrupado por yegua,
 * en el formato del motor. Se trae entero (todas las temporadas) porque de ahi
 * se aprenden la duracion del ciclo y de la gestacion de cada una.
 */
export async function loadMareHistories(tx: PrismaClient, tenantId: string, mareIds: string[]) {
  if (mareIds.length === 0) return new Map<string, MareHistory & { stallionName: string | null }>();
  const [exams, coverings, profiles] = [
    await tx.reproExam.findMany({
      where: { tenantId, mareId: { in: mareIds } },
      select: { ...examSelect, mareId: true },
      orderBy: { date: "asc" },
    }),
    await tx.covering.findMany({
      where: { tenantId, mareId: { in: mareIds } },
      select: { ...coveringSelect, mareId: true },
      orderBy: { date: "asc" },
    }),
    await tx.mareReproProfile.findMany({ where: { tenantId, horseId: { in: mareIds } } }),
  ];

  const map = new Map<string, MareHistory & { stallionName: string | null }>();
  for (const id of mareIds) map.set(id, { exams: [], coverings: [], profile: null, stallionName: null });
  for (const e of exams) map.get(e.mareId)!.exams.push(e);
  for (const c of coverings) {
    const h = map.get(c.mareId)!;
    h.coverings.push(c);
    h.stallionName = c.stallion?.name ?? c.externalStallionName ?? null;
  }
  for (const p of profiles) map.get(p.horseId)!.profile = p;
  return map;
}

export type MareOverview = {
  mare: { id: string; name: string; birthDate: Date | null; boxLocation: string | null };
  /** Temporada en curso de la yegua (si se ha iniciado). */
  cycle: { id: string; season: number; category: string | null } | null;
  /** Ciclo al que pertenece su ultima cubricion (p. ej. una gestacion de la temporada anterior). */
  latestCycleId: string | null;
  category: SeasonCategory;
  stallionName: string | null;
  insight: MareInsight;
};

/**
 * Situacion reproductiva de todas las yeguas en seguimiento: las que tienen
 * temporada iniciada este año y las que siguen gestantes de la anterior (su
 * parto cae en esta). El resto de hembras activas se devuelven como
 * `untracked` para poder iniciarles la temporada.
 */
export async function buildReproOverview(
  tx: PrismaClient,
  tenantId: string,
  season: number,
  scope: Record<string, { in: string[] }>,
  now: Date = new Date(),
) {
  const settings = await loadReproSettings(tx, tenantId);
  const mares = await tx.horse.findMany({
    where: { tenantId, sex: "FEMALE", status: "ACTIVE", ...scope },
    select: {
      id: true,
      name: true,
      birthDate: true,
      boxLocation: true,
      reproCycles: {
        where: { season: { gte: season - 1, lte: season } },
        select: { id: true, season: true, category: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const histories = await loadMareHistories(
    tx,
    tenantId,
    mares.map((m) => m.id),
  );

  const tracked: MareOverview[] = [];
  const untracked: { id: string; name: string; birthDate: Date | null }[] = [];

  for (const mare of mares) {
    const history = histories.get(mare.id)!;
    const cycle = mare.reproCycles.find((c) => c.season === season) ?? null;
    const insight = mareInsight(history, settings, now);
    const carriesPregnancy = insight.gestation !== null;
    const recentlyFoaled = insight.phase === "POSTPARTUM";
    if (!cycle && !carriesPregnancy && !recentlyFoaled) {
      untracked.push({ id: mare.id, name: mare.name, birthDate: mare.birthDate });
      continue;
    }
    const latest = history.coverings[history.coverings.length - 1] as { cycleId?: string } | undefined;
    tracked.push({
      mare: { id: mare.id, name: mare.name, birthDate: mare.birthDate, boxLocation: mare.boxLocation },
      cycle,
      latestCycleId: latest?.cycleId ?? null,
      category: (cycle?.category as SeasonCategory | null) ?? seasonCategory(history.coverings, season),
      stallionName: history.stallionName,
      insight,
    });
  }

  return { settings, season, tracked, untracked };
}

/**
 * Convierte los hitos de gestacion proximos en tareas (vacunas, desparasitar,
 * pasar al box de partos...). Idempotente: cada tarea lleva `sourceKey` unica,
 * asi que el cron puede pasar cada dia. Si una gestacion se pierde o ya parió,
 * se borran sus tareas pendientes.
 */
export async function syncGestationTasks(tx: PrismaClient, tenantId: string, now: Date = new Date()) {
  const { settings, tracked } = await buildReproOverview(tx, tenantId, now.getFullYear(), {}, now);
  const histories = await loadMareHistories(
    tx,
    tenantId,
    tracked.map((m) => m.mare.id),
  );
  const DAY = 24 * 60 * 60 * 1000;
  const liveCoverings = new Set<string>();
  const rows: { tenantId: string; horseId: string; title: string; dueDate: Date; notes: string; sourceKey: string }[] = [];

  for (const m of tracked) {
    if (!m.insight.gestation) continue;
    const coverings = histories.get(m.mare.id)?.coverings ?? [];
    const latest = coverings[coverings.length - 1] as { id?: string } | undefined;
    if (!latest?.id) continue;
    liveCoverings.add(latest.id);
    for (const milestone of m.insight.milestones) {
      const until = (milestone.due.getTime() - now.getTime()) / DAY;
      // Lo que ya paso hace mas de un mes no se crea (gestaciones dadas de
      // alta tarde): seria una lista de tareas atrasadas sin sentido.
      if (until > settings.milestoneTaskLeadDays || until < -30) continue;
      rows.push({
        tenantId,
        horseId: m.mare.id,
        title: `${milestone.label} · ${m.mare.name}`,
        dueDate: milestone.due,
        notes: "Creada por Reproducción (hito de gestación).",
        sourceKey: milestoneTaskKey(latest.id, milestone.key),
      });
    }
  }

  const created = rows.length ? (await tx.task.createMany({ data: rows, skipDuplicates: true })).count : 0;

  const pending = await tx.task.findMany({
    where: { tenantId, doneAt: null, sourceKey: { startsWith: "repro:" } },
    select: { id: true, sourceKey: true },
  });
  // Solo se retiran las de gestaciones que ya no siguen: perdida, parto o
  // cubricion borrada. Una yegua que sale del seguimiento por otra razon (p. ej.
  // pasa a inactiva) conserva sus tareas.
  const orphanIds = [
    ...new Set(
      pending.map((t) => t.sourceKey!.split(":")[1]).filter((id) => !liveCoverings.has(id)),
    ),
  ];
  const orphans = orphanIds.length
    ? await tx.covering.findMany({
        where: { tenantId, id: { in: orphanIds } },
        select: { id: true, foaling: { select: { id: true } }, pregnancyChecks: { select: { date: true, result: true } } },
      })
    : [];
  const ended = new Set(orphanIds);
  for (const c of orphans) {
    const result = coveringResult(c.pregnancyChecks);
    if (!c.foaling && (result === "POSITIVE" || result === "TWINS")) ended.delete(c.id);
  }
  const stale = pending.filter((t) => ended.has(t.sourceKey!.split(":")[1]));
  if (stale.length) await tx.task.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } });

  return { created, removed: stale.length };
}
