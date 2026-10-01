import "server-only";

import type { PrismaClient } from "@prisma/client";
import { inSequence } from "@/server/db/prisma";
import {
  WEIGH_EVERY_DAYS,
  ageInMonths,
  assessCondition,
  conditionTarget,
  daysSince,
  dewormerDoseWeight,
  weightTrend,
  type WeightMethod,
} from "@/lib/body-condition";

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** Dos años: si se ha cubierto en ese tiempo, es yegua de cría o semental. */
const BREEDING_LOOKBACK_MS = 2 * 365 * 24 * 3600 * 1000;

/**
 * El último peso registrado pasa a ser el peso de la ficha veterinaria, que es
 * el que usan la ración del día, la de cría y el techo de concentrado. Si se
 * borran todos los pesajes, el peso de la ficha se queda como estaba.
 */
export async function syncBaseWeight(tx: PrismaClient, tenantId: string, horseId: string) {
  const latest = await tx.bodyMeasurement.findFirst({
    where: { tenantId, horseId, weightKg: { not: null } },
    orderBy: { date: "desc" },
    select: { weightKg: true },
  });
  if (!latest?.weightKg) return null;
  await tx.veterinaryProfile.upsert({
    where: { horseId },
    update: { baseWeightKg: latest.weightKg },
    create: { tenantId, horseId, baseWeightKg: latest.weightKg },
  });
  return Number(latest.weightKg);
}

/** Pesajes, tendencia, condición y objetivo de un caballo. */
export async function getBodyCondition(
  tx: PrismaClient,
  tenantId: string,
  horseId: string,
  now: Date = new Date(),
) {
  const since = new Date(now.getTime() - BREEDING_LOOKBACK_MS);
  const [horse, rows, maresCovered, stallionCovered] = await inSequence([
    () =>
      tx.horse.findFirst({
        where: { id: horseId, tenantId },
        select: {
          id: true,
          name: true,
          sex: true,
          birthDate: true,
          vetProfile: { select: { baseWeightKg: true, discipline: true, reproductiveStatus: true } },
        },
      }),
    () =>
      tx.bodyMeasurement.findMany({
        where: { tenantId, horseId },
        orderBy: { date: "asc" },
        take: 120,
      }),
    () => tx.covering.count({ where: { tenantId, mareId: horseId, date: { gte: since } } }),
    () => tx.covering.count({ where: { tenantId, stallionId: horseId, date: { gte: since } } }),
  ]);
  if (!horse) return null;

  const measurements = rows.map((m) => ({
    id: m.id,
    date: m.date,
    method: m.method as WeightMethod | null,
    weightKg: num(m.weightKg),
    girthCm: num(m.girthCm),
    lengthCm: num(m.lengthCm),
    bodyCondition: num(m.bodyCondition),
    notes: m.notes,
  }));

  const weights = measurements.filter(
    (m): m is typeof m & { weightKg: number; method: WeightMethod } => m.weightKg != null && m.method != null,
  );
  const conditions = measurements.filter(
    (m): m is typeof m & { bodyCondition: number } => m.bodyCondition != null,
  );
  const lastWeight = weights.at(-1) ?? null;
  const lastCondition = conditions.at(-1) ?? null;

  const months = ageInMonths(horse.birthDate, now);
  const repro = horse.vetProfile?.reproductiveStatus;
  const target = conditionTarget({
    sex: horse.sex as "MALE" | "FEMALE" | "GELDING",
    ageYears: months != null ? Math.floor(months / 12) : null,
    broodmare: maresCovered > 0 || repro === "GESTANTE" || repro === "LACTANDO",
    breedingStallion: stallionCovered > 0 || repro === "SEMENTAL_EN_MONTA",
    discipline: horse.vetProfile?.discipline ?? null,
  });

  const weightKg = lastWeight?.weightKg ?? num(horse.vetProfile?.baseWeightKg);
  const sinceWeighed = lastWeight ? daysSince(lastWeight.date, now) : null;

  return {
    horse: { id: horse.id, name: horse.name, ageMonths: months },
    measurements,
    lastWeight,
    lastCondition,
    /** Peso actual: el último pesaje o, si no hay, el de la ficha veterinaria. */
    weightKg,
    weightFromProfileOnly: !lastWeight && weightKg != null,
    trend: weightTrend(weights.map((w) => ({ date: w.date, weightKg: w.weightKg, method: w.method }))),
    target,
    assessment: lastCondition ? assessCondition(lastCondition.bodyCondition, target) : null,
    daysSinceWeighed: sinceWeighed,
    weighingDue: sinceWeighed == null || sinceWeighed > WEIGH_EVERY_DAYS,
    dewormerDoseKg: weightKg != null ? dewormerDoseWeight(weightKg) : null,
  };
}

export type BodyConditionSummary = NonNullable<Awaited<ReturnType<typeof getBodyCondition>>>;
