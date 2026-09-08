import "server-only";

import { withTenant } from "@/server/db/prisma";
import { stripTime, type PhaseValue } from "../performance/periodization";
import { getPhaseForDate } from "../performance/plan-service";
import {
  computeDailyPrescription,
  type NutritionBaselineInput,
  type NutritionVetContext,
  type ReproductiveStatusValue,
  type SweatLossValue,
} from "./engine";
import { getMaxTempC } from "./weather";

/** Valores por defecto cuando el veterinario aun no ha fijado la dieta base. */
function fallbackBaseline(weightKg: number): NutritionBaselineInput {
  return {
    baseForageKg: Math.round(weightKg * 0.017 * 10) / 10,
    baseConcentrateKg: 1.5,
    proteinPercentTarget: 12,
    mealsPerDay: 3,
    minForagePctBodyweight: 1.5,
    maxConcentrateKgPerDay: Math.round(weightKg * 0.01 * 10) / 10,
    maxConcentrateKgPerMeal: 2,
    maxElectrolytesGrams: 90,
    maxVitaminEIu: 5000,
  };
}

export interface SyncNutritionInput {
  tenantId: string;
  horseId: string;
  date: Date;
  /** Carga interna del dia; si se omite se lee del plan de entrenamiento. */
  internalLoadUa?: number;
  sweatLoss?: SweatLossValue | null;
  strengthSession?: boolean;
  /** Si se omite, se consulta la temperatura maxima prevista. */
  ambientTempC?: number | null;
  mesocyclePhase?: PhaseValue | null;
}

/**
 * Recalcula y persiste la racion del dia. Es el punto de entrada unico del
 * webhook de sincronizacion entre el modulo de entrenamiento y el de nutricion.
 */
export async function syncNutritionForDay(input: SyncNutritionInput) {
  const day = stripTime(input.date);

  const planContext = await getPhaseForDate({
    tenantId: input.tenantId,
    horseId: input.horseId,
    date: day,
  });

  // Antes de que el jinete reporte, la racion se anticipa con la carga prevista.
  const internalLoadUa =
    input.internalLoadUa ?? (planContext.actualLoadUa || planContext.plannedLoadUa);
  const phase = input.mesocyclePhase ?? planContext.phase;

  const ambientTempC =
    input.ambientTempC ?? (await getMaxTempC({ date: day }));

  return withTenant(input.tenantId, async (tx) => {
    const horse = await tx.horse.findFirst({
      where: { id: input.horseId, tenantId: input.tenantId },
      include: { vetProfile: true, nutritionBaseline: true },
    });
    if (!horse) throw new Error("Caballo no encontrado");

    const weightKg = horse.vetProfile?.baseWeightKg
      ? Number(horse.vetProfile.baseWeightKg)
      : 500;

    const vet: NutritionVetContext = {
      baseWeightKg: weightKg,
      reproductiveStatus:
        (horse.vetProfile?.reproductiveStatus as ReproductiveStatusValue | undefined) ??
        "NA",
      gestationMonth: horse.vetProfile?.gestationMonth ?? null,
      restrictions: horse.vetProfile?.restrictions ?? [],
    };

    const baseline: NutritionBaselineInput = horse.nutritionBaseline
      ? {
          baseForageKg: Number(horse.nutritionBaseline.baseForageKg),
          baseConcentrateKg: Number(horse.nutritionBaseline.baseConcentrateKg),
          proteinPercentTarget: horse.nutritionBaseline.proteinPercentTarget,
          mealsPerDay: horse.nutritionBaseline.mealsPerDay,
          minForagePctBodyweight: Number(
            horse.nutritionBaseline.minForagePctBodyweight,
          ),
          maxConcentrateKgPerDay: Number(
            horse.nutritionBaseline.maxConcentrateKgPerDay,
          ),
          maxConcentrateKgPerMeal: Number(
            horse.nutritionBaseline.maxConcentrateKgPerMeal,
          ),
          maxElectrolytesGrams: horse.nutritionBaseline.maxElectrolytesGrams,
          maxVitaminEIu: horse.nutritionBaseline.maxVitaminEIu,
        }
      : fallbackBaseline(weightKg);

    const prescription = computeDailyPrescription({
      vet,
      baseline,
      training: {
        internalLoadUa,
        mesocyclePhase: phase,
        sweatLoss: input.sweatLoss ?? null,
        ambientTempC,
        strengthSession: input.strengthSession,
      },
    });

    const data = {
      tenantId: input.tenantId,
      horseId: input.horseId,
      date: day,
      internalLoadUa,
      fatigueZone: prescription.fatigueZone,
      mesocyclePhase: phase,
      forageKg: prescription.forageKg,
      concentrateKg: prescription.concentrateKg,
      extraConcentrateGrams: prescription.extraConcentrateGrams,
      proteinPercentTarget: prescription.proteinPercentTarget,
      electrolytesGrams: prescription.electrolytesGrams,
      vitaminEIu: prescription.vitaminEIu,
      seleniumMg: prescription.seleniumMg,
      bcaa: prescription.bcaa,
      totalMeals: prescription.totalMeals,
      instructionsForStaff: prescription.instructionsForStaff,
      clampNotes: prescription.clampNotes,
      ambientTempC,
    };

    return tx.nutritionPrescription.upsert({
      where: { horseId_date: { horseId: input.horseId, date: day } },
      update: { ...data, computedAt: new Date() },
      create: data,
    });
  });
}

/** Lista de raciones del dia para la pantalla del mozo de cuadras. */
export async function getGroomList(params: { tenantId: string; date: Date }) {
  const day = stripTime(params.date);
  return withTenant(params.tenantId, async (tx) => {
    const rows = await tx.nutritionPrescription.findMany({
      where: { tenantId: params.tenantId, date: day },
      include: {
        horse: { select: { id: true, name: true, boxLocation: true, photoUrl: true } },
      },
    });
    return rows
      .sort((a, b) =>
        (a.horse.boxLocation ?? "").localeCompare(b.horse.boxLocation ?? ""),
      )
      .map((row) => ({
        horseId: row.horseId,
        horseName: row.horse.name,
        boxLocation: row.horse.boxLocation,
        photoUrl: row.horse.photoUrl,
        forageKg: Number(row.forageKg),
        concentrateKg: Number(row.concentrateKg),
        totalMeals: row.totalMeals,
        electrolytes: row.electrolytesGrams > 0,
        instructions: row.instructionsForStaff,
      }));
  });
}
