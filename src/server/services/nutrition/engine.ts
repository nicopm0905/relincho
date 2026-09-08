/**
 * Motor de nutricion dinamica.
 *
 * Cruza tres fuentes antes de escupir la racion del dia:
 *   1. Baseline veterinario (sexo, estado reproductivo, peso, restricciones).
 *   2. Contexto del mesociclo (Acumulacion, Transmutacion, Realizacion).
 *   3. Impacto del microciclo diario (carga interna en UA, sudoracion, calor).
 *
 * Modulo puro: no toca base de datos. Todos los resultados quedan acotados por
 * los techos de seguridad definidos por el veterinario.
 */

import { EXTRA_CONCENTRATE_GRAMS, fatigueZoneFor, type FatigueZoneValue } from "../performance/load";
import type { PhaseValue } from "../performance/periodization";
import { clamp } from "../performance/load";

export type ReproductiveStatusValue =
  | "NA"
  | "CICLANDO"
  | "GESTANTE"
  | "LACTANDO"
  | "SEMENTAL_EN_MONTA"
  | "SEMENTAL_REPOSO";

export type SweatLossValue = "BAJA" | "MEDIA" | "ALTA";

export interface NutritionVetContext {
  baseWeightKg: number;
  reproductiveStatus: ReproductiveStatusValue;
  /** Mes de gestacion, 1-11. */
  gestationMonth?: number | null;
  /** Etiquetas libres: tendencia_colico, limitar_almidon, ... */
  restrictions?: string[];
}

export interface NutritionBaselineInput {
  baseForageKg: number;
  baseConcentrateKg: number;
  proteinPercentTarget: number;
  mealsPerDay: number;
  minForagePctBodyweight: number;
  maxConcentrateKgPerDay: number;
  maxConcentrateKgPerMeal: number;
  maxElectrolytesGrams: number;
  maxVitaminEIu: number;
}

export interface TrainingImpactInput {
  internalLoadUa: number;
  mesocyclePhase?: PhaseValue | null;
  sweatLoss?: SweatLossValue | null;
  /** Temperatura maxima del dia; por encima de 30 grados se activan electrolitos. */
  ambientTempC?: number | null;
  /** Marca los microciclos de fuerza/potencia para el ajuste proteico nocturno. */
  strengthSession?: boolean;
}

export interface NutritionPrescription {
  fatigueZone: FatigueZoneValue;
  forageKg: number;
  concentrateKg: number;
  extraConcentrateGrams: number;
  proteinPercentTarget: number;
  electrolytesGrams: number;
  vitaminEIu: number;
  seleniumMg: number;
  bcaa: boolean;
  totalMeals: number;
  instructionsForStaff: string;
  /** Ajustes aplicados al chocar con un techo de seguridad. */
  clampNotes: string[];
}

const HIGH_TEMP_C = 30;

/** Multiplicador del concentrado extra segun el bloque de entrenamiento. */
const PHASE_CONCENTRATE_FACTOR: Record<PhaseValue, number> = {
  ACUMULACION: 1.0,
  TRANSMUTACION: 0.9,
  // Tapering: bajar el trabajo manteniendo el carbohidrato alto es la via directa
  // a la rabdomiolisis de esfuerzo, asi que el extra se recorta a la mitad.
  REALIZACION: 0.5,
  TRANSICION: 0.4,
};

/** Coste metabolico de gestacion sobre el concentrado basal. */
function gestationConcentrateFactor(vet: NutritionVetContext): number {
  if (vet.reproductiveStatus !== "GESTANTE") return 1;
  const month = vet.gestationMonth ?? 0;
  if (month >= 11) return 1.3;
  if (month >= 9) return 1.25;
  if (month >= 8) return 1.15;
  return 1;
}

function reproductiveProteinTarget(
  vet: NutritionVetContext,
  baselineProtein: number,
): number {
  if (vet.reproductiveStatus === "GESTANTE") {
    const month = vet.gestationMonth ?? 0;
    if (month >= 9) return Math.max(baselineProtein, 16);
    if (month >= 8) return Math.max(baselineProtein, 14);
  }
  if (vet.reproductiveStatus === "LACTANDO") return Math.max(baselineProtein, 16);
  if (vet.reproductiveStatus === "SEMENTAL_EN_MONTA") return Math.max(baselineProtein, 14);
  return baselineProtein;
}

/** La compresion gastrica fetal obliga a fraccionar mas las tomas. */
function mealsForContext(
  vet: NutritionVetContext,
  baselineMeals: number,
  concentrateKg: number,
  maxPerMeal: number,
): number {
  let meals = baselineMeals;
  if (vet.reproductiveStatus === "GESTANTE" && (vet.gestationMonth ?? 0) >= 8) {
    meals += 1;
  }
  if (vet.restrictions?.includes("tendencia_colico")) {
    meals = Math.max(meals, 4);
  }
  const byVolume = Math.ceil(concentrateKg / Math.max(0.5, maxPerMeal));
  return clamp(Math.max(meals, byVolume), 2, 6);
}

export function computeDailyPrescription(params: {
  vet: NutritionVetContext;
  baseline: NutritionBaselineInput;
  training: TrainingImpactInput;
}): NutritionPrescription {
  const { vet, baseline, training } = params;
  const clampNotes: string[] = [];

  const fatigueZone = fatigueZoneFor(training.internalLoadUa);
  const phase = training.mesocyclePhase ?? null;

  // --- Forraje: base innegociable sobre el peso vivo -----------------------
  const forageFloor = (vet.baseWeightKg * baseline.minForagePctBodyweight) / 100;
  let forageKg = round1(Math.max(baseline.baseForageKg, forageFloor));
  if (vet.reproductiveStatus === "GESTANTE" && (vet.gestationMonth ?? 0) >= 9) {
    // Menos capacidad gastrica: se mantiene el forraje pero repartido.
    forageKg = round1(Math.max(forageKg, forageFloor));
  }

  // --- Concentrado: extra por carga, modulado por fase y gestacion ---------
  const phaseFactor = phase ? PHASE_CONCENTRATE_FACTOR[phase] : 1;
  let extraGrams = Math.round(
    EXTRA_CONCENTRATE_GRAMS[fatigueZone] * phaseFactor * gestationConcentrateFactor(vet),
  );
  if (vet.restrictions?.includes("limitar_almidon")) {
    extraGrams = Math.round(extraGrams * 0.5);
    clampNotes.push("Extra de concentrado reducido al 50% por restriccion de almidon.");
  }

  const baseConcentrate = baseline.baseConcentrateKg * gestationConcentrateFactor(vet);
  let concentrateKg = round1(baseConcentrate + extraGrams / 1000);
  if (concentrateKg > baseline.maxConcentrateKgPerDay) {
    const overflowGrams = Math.round(
      (concentrateKg - baseline.maxConcentrateKgPerDay) * 1000,
    );
    concentrateKg = round1(baseline.maxConcentrateKgPerDay);
    extraGrams = Math.max(0, extraGrams - overflowGrams);
    clampNotes.push(
      `Concentrado limitado al techo veterinario de ${baseline.maxConcentrateKgPerDay} kg/dia.`,
    );
  }

  // --- Proteina: sintesis proteica nocturna tras fuerza/potencia -----------
  let proteinPercentTarget = reproductiveProteinTarget(vet, baseline.proteinPercentTarget);
  if (training.strengthSession || fatigueZone === "ALTA") {
    proteinPercentTarget = Math.max(proteinPercentTarget, baseline.proteinPercentTarget + 2);
  }

  // --- Electrolitos: sudoracion o calor ------------------------------------
  const hot = (training.ambientTempC ?? 0) > HIGH_TEMP_C;
  let electrolytesGrams = 0;
  if (training.sweatLoss === "ALTA" || (hot && fatigueZone !== "BAJA")) {
    electrolytesGrams = 60;
  } else if (training.sweatLoss === "MEDIA" || fatigueZone === "ALTA" || hot) {
    electrolytesGrams = 30;
  }
  if (electrolytesGrams > baseline.maxElectrolytesGrams) {
    electrolytesGrams = baseline.maxElectrolytesGrams;
    clampNotes.push("Electrolitos limitados al techo veterinario.");
  }

  // --- Antioxidantes: estres oxidativo en los bloques de mas intensidad ----
  let vitaminEIu = 1000;
  let seleniumMg = 1;
  if (phase === "TRANSMUTACION" || phase === "REALIZACION" || fatigueZone === "ALTA") {
    vitaminEIu = 2500;
    seleniumMg = 2;
  }
  if (vitaminEIu > baseline.maxVitaminEIu) {
    vitaminEIu = baseline.maxVitaminEIu;
    clampNotes.push("Vitamina E limitada al techo veterinario.");
  }

  const bcaa = fatigueZone === "ALTA" || Boolean(training.strengthSession);

  const totalMeals = mealsForContext(
    vet,
    baseline.mealsPerDay,
    concentrateKg,
    baseline.maxConcentrateKgPerMeal,
  );

  return {
    fatigueZone,
    forageKg,
    concentrateKg,
    extraConcentrateGrams: extraGrams,
    proteinPercentTarget,
    electrolytesGrams,
    vitaminEIu,
    seleniumMg,
    bcaa,
    totalMeals,
    clampNotes,
    instructionsForStaff: buildStaffInstructions({
      vet,
      totalMeals,
      extraGrams,
      electrolytesGrams,
      bcaa,
    }),
  };
}

/** Texto plano para el mozo de cuadras: sin porcentajes ni graficas. */
function buildStaffInstructions(params: {
  vet: NutritionVetContext;
  totalMeals: number;
  extraGrams: number;
  electrolytesGrams: number;
  bcaa: boolean;
}): string {
  const parts: string[] = [];
  parts.push(`Repartir la racion en ${params.totalMeals} tomas.`);

  if (params.extraGrams > 0) {
    parts.push(
      `Anadir ${params.extraGrams} g extra de pienso repartidos en la cena por el trabajo de hoy.`,
    );
  }
  if (params.electrolytesGrams > 0) {
    parts.push(
      `Administrar ${params.electrolytesGrams} g de electrolitos en la toma post-entreno.`,
    );
  }
  if (params.bcaa) {
    parts.push("Anadir el sobre de aminoacidos en la toma de la noche.");
  }
  if (
    params.vet.reproductiveStatus === "GESTANTE" &&
    (params.vet.gestationMonth ?? 0) >= 8
  ) {
    parts.push("Tomas pequenas y frecuentes por compresion gastrica fetal.");
  }
  if (params.vet.restrictions?.includes("tendencia_colico")) {
    parts.push("Agua limpia siempre disponible y nunca pienso antes del forraje.");
  }

  return parts.join(" ");
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
