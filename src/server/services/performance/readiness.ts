import "server-only";
import { addDays } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import { stripTime } from "./periodization";
import {
  WORKLOAD,
  assessReadiness,
  computeWorkload,
  dayKey,
  type Lameness,
  type LimbCheckData,
  type ReadinessHeat,
  type ReadinessResult,
  type SessionLoad,
  type WorkloadSummary,
} from "@/lib/readiness";

/** Días de chequeos que enseña el mapa de patas de la ficha. */
export const LIMB_HISTORY_DAYS = 14;

type Tx = Pick<PrismaClient, "limbCheck" | "trainingSession" | "veterinaryProfile">;

interface LimbCheckRow {
  id?: string;
  date: Date;
  heatLegs: string[];
  swellingLegs: string[];
  painLegs: string[];
  lameness: Lameness;
  notes?: string | null;
}

interface SessionRow {
  date: Date;
  internalLoadUa: number | null;
  rpe: number | null;
  minutes: number;
}

/**
 * Carga de una sesión. Las antiguas o las del formulario rápido sin
 * intensidad no tienen UA: se calcula si hay intensidad y, si no, cuenta 0
 * (mejor no inventar carga).
 */
export function sessionLoad(row: SessionRow): SessionLoad {
  const loadUa =
    row.internalLoadUa ?? (row.rpe != null ? row.rpe * row.minutes : 0);
  return { date: row.date, loadUa };
}

function toCheck(row: LimbCheckRow): LimbCheckData {
  return {
    date: row.date,
    heatLegs: row.heatLegs,
    swellingLegs: row.swellingLegs,
    painLegs: row.painLegs,
    lameness: row.lameness,
  };
}

export interface HorseReadiness {
  today: (LimbCheckData & { id?: string; notes?: string | null }) | null;
  history: (LimbCheckData & { notes?: string | null })[];
  workload: WorkloadSummary;
  readiness: ReadinessResult;
  tendonHistory: boolean;
}

/** Semáforo, carga y mapa de patas de un caballo para la ficha de rendimiento. */
export async function getHorseReadiness(
  tx: Tx,
  tenantId: string,
  horseId: string,
  now: Date = new Date(),
  heat: ReadinessHeat | null = null,
): Promise<HorseReadiness> {
  const today = stripTime(now);
  const historyFrom = addDays(today, -(LIMB_HISTORY_DAYS - 1));
  const loadFrom = addDays(today, -(WORKLOAD.chronicDays - 1));

  const [checks, sessions, vet] = await Promise.all([
    tx.limbCheck.findMany({
      where: { tenantId, horseId, date: { gte: historyFrom, lte: today } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        heatLegs: true,
        swellingLegs: true,
        painLegs: true,
        lameness: true,
        notes: true,
      },
    }),
    tx.trainingSession.findMany({
      where: { tenantId, horseId, date: { gte: loadFrom } },
      select: { date: true, internalLoadUa: true, rpe: true, minutes: true },
    }),
    tx.veterinaryProfile.findUnique({
      where: { horseId },
      select: { tendonHistoryAlert: true },
    }),
  ]);

  const todayKey = dayKey(today);
  const yesterdayKey = dayKey(addDays(today, -1));
  const todayRow = checks.find((c) => dayKey(c.date) === todayKey) ?? null;
  const yesterdayRow = checks.find((c) => dayKey(c.date) === yesterdayKey) ?? null;

  const workload = computeWorkload(sessions.map(sessionLoad), now);
  const tendonHistory = vet?.tendonHistoryAlert ?? false;
  const readiness = assessReadiness({
    today: todayRow ? toCheck(todayRow) : null,
    yesterday: yesterdayRow ? toCheck(yesterdayRow) : null,
    workload,
    tendonHistory,
    heat,
  });

  return {
    today: todayRow ? { ...toCheck(todayRow), id: todayRow.id, notes: todayRow.notes } : null,
    history: checks.map((c) => ({ ...toCheck(c), notes: c.notes })),
    workload,
    readiness,
    tendonHistory,
  };
}

/**
 * Semáforo de varios caballos a la vez (lista de rendimiento). Dos consultas
 * en total, no dos por caballo.
 */
export async function getReadinessForHorses(
  tx: Tx,
  tenantId: string,
  horses: { id: string; tendonHistory: boolean }[],
  now: Date = new Date(),
  heat: ReadinessHeat | null = null,
): Promise<Map<string, ReadinessResult & { checked: boolean }>> {
  const result = new Map<string, ReadinessResult & { checked: boolean }>();
  if (horses.length === 0) return result;

  const ids = horses.map((h) => h.id);
  const today = stripTime(now);
  const yesterday = addDays(today, -1);
  const loadFrom = addDays(today, -(WORKLOAD.chronicDays - 1));

  const [checks, sessions] = await Promise.all([
    tx.limbCheck.findMany({
      where: { tenantId, horseId: { in: ids }, date: { gte: yesterday, lte: today } },
      select: {
        horseId: true,
        date: true,
        heatLegs: true,
        swellingLegs: true,
        painLegs: true,
        lameness: true,
      },
    }),
    tx.trainingSession.findMany({
      where: { tenantId, horseId: { in: ids }, date: { gte: loadFrom } },
      select: { horseId: true, date: true, internalLoadUa: true, rpe: true, minutes: true },
    }),
  ]);

  const todayKey = dayKey(today);
  for (const horse of horses) {
    const own = checks.filter((c) => c.horseId === horse.id);
    const todayRow = own.find((c) => dayKey(c.date) === todayKey) ?? null;
    const yesterdayRow = own.find((c) => dayKey(c.date) !== todayKey) ?? null;
    const workload = computeWorkload(
      sessions.filter((s) => s.horseId === horse.id).map(sessionLoad),
      now,
    );
    const readiness = assessReadiness({
      today: todayRow ? toCheck(todayRow) : null,
      yesterday: yesterdayRow ? toCheck(yesterdayRow) : null,
      workload,
      tendonHistory: horse.tendonHistory,
      heat,
    });
    result.set(horse.id, { ...readiness, checked: Boolean(todayRow) });
  }
  return result;
}
