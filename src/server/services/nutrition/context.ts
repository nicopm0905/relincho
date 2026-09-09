import "server-only";

import type { PrismaClient } from "@prisma/client";
import type {
  NutritionBaselineInput,
  NutritionVetContext,
  ReproductiveStatusValue,
} from "./engine";

/** Peso de referencia cuando el veterinario aun no ha pesado al caballo. */
const DEFAULT_WEIGHT_KG = 500;

/**
 * Valores por defecto cuando el veterinario aun no ha fijado la dieta base.
 * Son conservadores a proposito: forraje segun peso vivo y un techo de
 * concentrado del 1% del peso, muy por debajo de lo que nadie discutiria.
 */
export function fallbackBaseline(weightKg: number): NutritionBaselineInput {
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

export interface NutritionContext {
  vet: NutritionVetContext;
  baseline: NutritionBaselineInput;
}

/**
 * Ficha veterinaria y dieta base de un caballo, en el formato que consume el
 * motor. Lo comparten el calculo del dia y la proyeccion de la semana, para
 * que ambos partan exactamente de los mismos limites.
 */
export async function loadNutritionContext(
  tx: PrismaClient,
  tenantId: string,
  horseId: string,
): Promise<NutritionContext> {
  const horse = await tx.horse.findFirst({
    where: { id: horseId, tenantId },
    include: { vetProfile: true, nutritionBaseline: true },
  });
  if (!horse) throw new Error("Caballo no encontrado");

  const weightKg = horse.vetProfile?.baseWeightKg
    ? Number(horse.vetProfile.baseWeightKg)
    : DEFAULT_WEIGHT_KG;

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
        maxConcentrateKgPerDay: Number(horse.nutritionBaseline.maxConcentrateKgPerDay),
        maxConcentrateKgPerMeal: Number(
          horse.nutritionBaseline.maxConcentrateKgPerMeal,
        ),
        maxElectrolytesGrams: horse.nutritionBaseline.maxElectrolytesGrams,
        maxVitaminEIu: horse.nutritionBaseline.maxVitaminEIu,
      }
    : fallbackBaseline(weightKg);

  return { vet, baseline };
}
