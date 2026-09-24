import "server-only";

import { randomUUID } from "node:crypto";

import { withTenant } from "@/server/db/prisma";
import type { PrismaClient } from "@prisma/client";
import {
  buildPeriodizationPlan,
  recalculatePlan,
  stripTime,
  type AdjustableDay,
  type DisciplineValue,
  type LoadConstraints,
  type PhaseValue,
} from "./periodization";
import { calcInternalLoad, fatigueZoneFor, isAcuteOverload } from "./load";

const DEFAULT_DISCIPLINE: DisciplineValue = "DOMA_CLASICA";

/** Restricciones de carga derivadas del perfil veterinario del caballo. */
function constraintsFromVetProfile(profile: {
  tendonHistoryAlert: boolean;
  maxImpactSurfaceMinutes: number | null;
  maxRpe: number | null;
} | null): LoadConstraints {
  if (!profile) return {};
  return {
    tendonHistoryAlert: profile.tendonHistoryAlert,
    maxImpactSurfaceMinutes: profile.maxImpactSurfaceMinutes,
    maxRpe: profile.maxRpe,
  };
}

export interface GeneratePlanInput {
  tenantId: string;
  horseId: string;
  /** Si se omite, se toma la competicion objetivo mas proxima del caballo. */
  competitionTargetId?: string;
  targetDate?: Date;
  startDate?: Date;
  discipline?: DisciplineValue;
  recoveryBufferPct?: number;
}

/**
 * Genera el arbol Macro/Meso/Micro/Dia y lo persiste, archivando cualquier
 * macrociclo activo anterior del mismo caballo.
 */
export async function generatePlan(input: GeneratePlanInput) {
  return withTenant(input.tenantId, async (tx) => {
    const horse = await tx.horse.findFirst({
      where: { id: input.horseId, tenantId: input.tenantId },
      include: {
        vetProfile: true,
        competitionTargets: { orderBy: { targetDate: "asc" } },
      },
    });
    if (!horse) throw new Error("Caballo no encontrado");

    const target = input.competitionTargetId
      ? horse.competitionTargets.find((t) => t.id === input.competitionTargetId)
      : horse.competitionTargets.find((t) => t.targetDate >= new Date());

    const targetDate = input.targetDate ?? target?.targetDate;
    if (!targetDate) {
      throw new Error(
        "Sin fecha de competicion objetivo: crea un objetivo o pasa targetDate.",
      );
    }

    const discipline =
      input.discipline ??
      (horse.vetProfile?.discipline as DisciplineValue | undefined) ??
      DEFAULT_DISCIPLINE;

    const plan = buildPeriodizationPlan({
      startDate: input.startDate ?? new Date(),
      targetDate,
      discipline,
      constraints: constraintsFromVetProfile(horse.vetProfile),
    });

    await tx.macrocycle.updateMany({
      where: { tenantId: input.tenantId, horseId: horse.id, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const macro = await tx.macrocycle.create({
      data: {
        tenantId: input.tenantId,
        horseId: horse.id,
        name: target?.name
          ? `Temporada ${target.name}`
          : `Temporada ${targetDate.getUTCFullYear()}`,
        discipline,
        startDate: plan.startDate,
        targetDate: plan.targetDate,
        competitionTargetId: target?.id,
        recoveryBufferPct: input.recoveryBufferPct ?? 15,
      },
    });

    // Una temporada son decenas de filas. Se generan los identificadores en
    // memoria para poder escribir todo en tres inserciones en vez de una por
    // semana, que contra una base de datos remota agota la transaccion.
    const mesocycleRows = [];
    const microcycleRows = [];
    const dailyRows = [];

    for (const meso of plan.mesocycles) {
      const mesocycleId = randomUUID();
      mesocycleRows.push({
        id: mesocycleId,
        tenantId: input.tenantId,
        macrocycleId: macro.id,
        phase: meso.phase,
        orderIndex: meso.orderIndex,
        startDate: meso.startDate,
        endDate: meso.endDate,
        weeks: meso.weeks,
        volumeIndex: meso.volumeIndex,
        intensityIndex: meso.intensityIndex,
      });

      for (const micro of meso.microcycles) {
        const microcycleId = randomUUID();
        microcycleRows.push({
          id: microcycleId,
          tenantId: input.tenantId,
          mesocycleId,
          weekNumber: micro.weekNumber,
          startDate: micro.startDate,
          endDate: micro.endDate,
          plannedLoadUa: micro.plannedLoadUa,
          mandatoryRestDays: micro.mandatoryRestDays,
        });

        for (const day of micro.days) {
          dailyRows.push({
            tenantId: input.tenantId,
            microcycleId,
            horseId: horse.id,
            date: day.date,
            workType: day.workType,
            rpeTarget: day.rpeTarget,
            durationMinutes: day.durationMinutes,
            plannedLoadUa: day.plannedLoadUa,
            impactSurfaceMinutes: day.impactSurfaceMinutes,
          });
        }
      }
    }

    await tx.mesocycle.createMany({ data: mesocycleRows });
    await tx.microcycle.createMany({ data: microcycleRows });
    await tx.dailyLoad.createMany({ data: dailyRows });

    return {
      macrocycleId: macro.id,
      totalWeeks: plan.totalWeeks,
      mesocycles: plan.mesocycles.length,
      startDate: plan.startDate,
      targetDate: plan.targetDate,
      discipline,
    };
  });
}

/** Carga el macrociclo activo con toda su descendencia. */
async function loadActiveMacrocycle(
  tx: PrismaClient,
  tenantId: string,
  horseId: string,
) {
  return tx.macrocycle.findFirst({
    where: { tenantId, horseId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      competitionTarget: true,
      mesocycles: {
        orderBy: { orderIndex: "asc" },
        include: {
          microcycles: {
            orderBy: { weekNumber: "asc" },
            include: { days: { orderBy: { date: "asc" } } },
          },
        },
      },
    },
  });
}

type ActiveMacrocycle = NonNullable<Awaited<ReturnType<typeof loadActiveMacrocycle>>>;

/** Aplana el arbol a la lista de dias que el algoritmo de recalculo puede tocar. */
function flattenDays(macro: ActiveMacrocycle) {
  return macro.mesocycles.flatMap((meso) =>
    meso.microcycles.flatMap((micro) =>
      micro.days.map((day) => ({
        row: day,
        phase: meso.phase as PhaseValue,
        microcycleId: micro.id,
        mesocycleId: meso.id,
      })),
    ),
  );
}

/** Estado del plan para una fecha concreta, con el formato del contrato movil. */
export async function getPlanSnapshot(params: {
  tenantId: string;
  horseId: string;
  date?: Date;
}) {
  const day = stripTime(params.date ?? new Date());
  return withTenant(params.tenantId, async (tx) => {
    const macro = await loadActiveMacrocycle(tx, params.tenantId, params.horseId);
    if (!macro) return null;

    const flat = flattenDays(macro);
    const today = flat.find((d) => sameDay(d.row.date, day));
    const meso = today
      ? macro.mesocycles.find((m) => m.id === today.mesocycleId)
      : macro.mesocycles.find(
          (m) => m.startDate <= day && m.endDate >= day,
        );
    const micro = today
      ? meso?.microcycles.find((m) => m.id === today.microcycleId)
      : meso?.microcycles.find((m) => m.startDate <= day && m.endDate >= day);

    const vetProfile = await tx.veterinaryProfile.findUnique({
      where: { horseId: params.horseId },
    });

    return {
      macrocycle: {
        id: macro.id,
        name: macro.name,
        discipline: macro.discipline,
        startDate: macro.startDate,
        targetDate: macro.targetDate,
        recoveryBufferPct: macro.recoveryBufferPct,
        competitionName: macro.competitionTarget?.name ?? null,
      },
      currentMesocycle: meso
        ? { id: meso.id, phase: meso.phase, weeks: meso.weeks, orderIndex: meso.orderIndex }
        : null,
      currentMicrocycle: micro
        ? {
            id: micro.id,
            weekNumber: micro.weekNumber,
            plannedLoadUa: micro.plannedLoadUa,
            actualLoadUa: micro.actualLoadUa,
            mandatoryRestDays: micro.mandatoryRestDays,
            bufferStatus: micro.bufferStatus,
          }
        : null,
      today: today?.row ?? null,
      week: micro?.days ?? [],
      timeline: macro.mesocycles.map((m) => ({
        id: m.id,
        phase: m.phase,
        weeks: m.weeks,
        startDate: m.startDate,
        endDate: m.endDate,
        isCurrent: m.id === meso?.id,
        microcycles: m.microcycles.map((w) => ({
          id: w.id,
          weekNumber: w.weekNumber,
          startDate: w.startDate,
          plannedLoadUa: w.plannedLoadUa,
          actualLoadUa: w.actualLoadUa,
          bufferStatus: w.bufferStatus,
          isCurrent: w.id === micro?.id,
        })),
      })),
      veterinaryConstraints: {
        tendonHistoryAlert: vetProfile?.tendonHistoryAlert ?? false,
        maxImpactSurfaceMinutes: vetProfile?.maxImpactSurfaceMinutes ?? null,
        maxRpe: vetProfile?.maxRpe ?? null,
      },
    };
  });
}

export interface ReportSessionInput {
  tenantId: string;
  horseId: string;
  date: Date;
  minutes: number;
  rpe: number;
  riderName?: string;
  notes?: string;
  /** Tipo de trabajo (doma, cuerda, paseo...), tal como lo elige el jinete. */
  type?: string;
  sweatLoss?: "BAJA" | "MEDIA" | "ALTA";
  /** Frecuencia cardiaca media, si el jinete la ha medido. Opcional siempre. */
  heartRateBpm?: number;
  /** El jinete ha reportado fatiga o menor rendimiento de forma explicita. */
  riderReportedFatigue?: boolean;
}

/**
 * Registra la sesion real del dia, calcula la carga interna y recalcula el
 * resto del mesociclo si hay desviacion. Nunca toca la fase de Realizacion.
 */
export async function reportSession(input: ReportSessionInput) {
  const day = stripTime(input.date);
  const internalLoadUa = calcInternalLoad(input.rpe, input.minutes);
  const fatigueZone = fatigueZoneFor(internalLoadUa);

  return withTenant(input.tenantId, async (tx) => {
    const session = await tx.trainingSession.create({
      data: {
        tenantId: input.tenantId,
        horseId: input.horseId,
        date: day,
        riderName: input.riderName,
        minutes: input.minutes,
        notes: input.notes,
        type: input.type,
        rpe: input.rpe,
        internalLoadUa,
        fatigueZone,
        sweatLoss: input.sweatLoss,
        heartRateBpm: input.heartRateBpm,
      },
    });

    const macro = await loadActiveMacrocycle(tx, input.tenantId, input.horseId);
    if (!macro) {
      return { session, internalLoadUa, fatigueZone, adjustments: [], bufferStatus: "idle" as const };
    }

    const flat = flattenDays(macro);
    const todayEntry = flat.find((d) => sameDay(d.row.date, day));
    if (!todayEntry) {
      return { session, internalLoadUa, fatigueZone, adjustments: [], bufferStatus: "idle" as const };
    }

    await tx.dailyLoad.update({
      where: { id: todayEntry.row.id },
      data: {
        status: "COMPLETED",
        actualRpe: input.rpe,
        actualMinutes: input.minutes,
        actualLoadUa: internalLoadUa,
        fatigueZone,
        trainingSessionId: session.id,
      },
    });

    await tx.microcycle.update({
      where: { id: todayEntry.microcycleId },
      data: { actualLoadUa: { increment: internalLoadUa } },
    });

    const overload = isAcuteOverload({
      actualUa: internalLoadUa,
      plannedUa: todayEntry.row.plannedLoadUa,
      riderReportedFatigue: input.riderReportedFatigue,
    });
    if (!overload) {
      return { session, internalLoadUa, fatigueZone, adjustments: [], bufferStatus: "idle" as const };
    }

    const excess = Math.max(
      0,
      internalLoadUa - todayEntry.row.plannedLoadUa,
      input.riderReportedFatigue ? Math.round(internalLoadUa * 0.15) : 0,
    );

    const result = await applyRecalculation({
      tx,
      tenantId: input.tenantId,
      macro,
      flat,
      fromDate: day,
      microcycleId: todayEntry.microcycleId,
      mesocycleId: todayEntry.mesocycleId,
      kind: "ACUTE_OVERLOAD",
      deltaUa: excess,
    });

    return { session, internalLoadUa, fatigueZone, ...result };
  });
}

/** Un dia de trabajo perdido: su carga se reparte por el resto del microciclo. */
export async function markMissedDay(params: {
  tenantId: string;
  horseId: string;
  date: Date;
  reason?: string;
}) {
  const day = stripTime(params.date);
  return withTenant(params.tenantId, async (tx) => {
    const macro = await loadActiveMacrocycle(tx, params.tenantId, params.horseId);
    if (!macro) throw new Error("El caballo no tiene un plan activo");

    const flat = flattenDays(macro);
    const entry = flat.find((d) => sameDay(d.row.date, day));
    if (!entry) throw new Error("Ese dia no forma parte del plan activo");

    await tx.dailyLoad.update({
      where: { id: entry.row.id },
      data: {
        status: "MISSED",
        actualLoadUa: 0,
        adjustmentReason: params.reason ?? "Dia de trabajo perdido",
      },
    });

    return applyRecalculation({
      tx,
      tenantId: params.tenantId,
      macro,
      flat,
      fromDate: day,
      microcycleId: entry.microcycleId,
      mesocycleId: entry.mesocycleId,
      kind: "MISSED_DAY",
      deltaUa: entry.row.plannedLoadUa,
    });
  });
}

async function applyRecalculation(params: {
  tx: PrismaClient;
  tenantId: string;
  macro: ActiveMacrocycle;
  flat: ReturnType<typeof flattenDays>;
  fromDate: Date;
  microcycleId: string;
  mesocycleId: string;
  kind: "MISSED_DAY" | "ACUTE_OVERLOAD";
  deltaUa: number;
}) {
  const { tx, macro, flat, fromDate, kind } = params;
  const vetProfile = await tx.veterinaryProfile.findUnique({
    where: { horseId: macro.horseId },
  });

  // Solo se recalcula lo que queda del mesociclo en curso. Un dia ya reajustado
  // por una desviacion anterior sigue siendo ajustable; los ejecutados no.
  const upcoming: AdjustableDay[] = flat
    .filter(
      (d) =>
        d.mesocycleId === params.mesocycleId &&
        d.row.date > fromDate &&
        (d.row.status === "PLANNED" || d.row.status === "ADJUSTED"),
    )
    .sort((a, b) => a.row.date.getTime() - b.row.date.getTime())
    .map((d) => ({
      date: d.row.date,
      phase: d.phase,
      workType: d.row.workType,
      rpeTarget: d.row.rpeTarget,
      durationMinutes: d.row.durationMinutes,
      plannedLoadUa: d.row.plannedLoadUa,
      locked: false,
      microcycleId: d.microcycleId,
    }));

  const result = recalculatePlan({
    kind,
    upcoming,
    microcycleId: params.microcycleId,
    deltaUa: params.deltaUa,
    recoveryBufferPct: macro.recoveryBufferPct,
    constraints: constraintsFromVetProfile(vetProfile),
  });

  for (const adj of result.adjustments) {
    await tx.dailyLoad.updateMany({
      where: { microcycleId: adj.microcycleId, date: adj.date },
      data: {
        workType: adj.workType,
        rpeTarget: adj.rpeTarget,
        durationMinutes: adj.durationMinutes,
        plannedLoadUa: adj.plannedLoadUa,
        status: "ADJUSTED",
        adjustmentReason: adj.reason,
      },
    });
  }

  const touchedMicrocycles = new Set(result.adjustments.map((a) => a.microcycleId));
  touchedMicrocycles.add(params.microcycleId);
  for (const microcycleId of touchedMicrocycles) {
    const days = await tx.dailyLoad.findMany({
      where: { microcycleId },
      select: { plannedLoadUa: true },
    });
    await tx.microcycle.update({
      where: { id: microcycleId },
      data: {
        plannedLoadUa: days.reduce((acc, d) => acc + d.plannedLoadUa, 0),
        bufferStatus: result.bufferStatus,
      },
    });
  }

  return {
    adjustments: result.adjustments,
    bufferStatus: result.bufferStatus,
    unabsorbedUa: result.unabsorbedUa,
  };
}

/** Fase del mesociclo vigente en una fecha, para el motor de nutricion. */
export async function getPhaseForDate(params: {
  tenantId: string;
  horseId: string;
  date: Date;
}): Promise<{ phase: PhaseValue | null; plannedLoadUa: number; actualLoadUa: number }> {
  const day = stripTime(params.date);
  return withTenant(params.tenantId, async (tx) => {
    const meso = await tx.mesocycle.findFirst({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: day },
        endDate: { gte: day },
        macrocycle: { horseId: params.horseId, status: "ACTIVE" },
      },
    });
    const dayRow = await tx.dailyLoad.findFirst({
      where: { tenantId: params.tenantId, horseId: params.horseId, date: day },
    });
    return {
      phase: (meso?.phase as PhaseValue | undefined) ?? null,
      plannedLoadUa: dayRow?.plannedLoadUa ?? 0,
      actualLoadUa: dayRow?.actualLoadUa ?? 0,
    };
  });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
