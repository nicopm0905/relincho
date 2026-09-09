import "server-only";

import { withTenant } from "@/server/db/prisma";
import { stripTime, type PhaseValue } from "../performance/periodization";
import { getPhaseForDate } from "../performance/plan-service";
import { computeDailyPrescription, type SweatLossValue } from "./engine";
import { loadNutritionContext } from "./context";
import { getMaxTempC } from "./weather";

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
  /** Tipo de trabajo previsto para ese dia, informativo para el mozo. */
  workType?: string | null;
  /**
   * true cuando la racion sale de la carga planificada y todavia no del
   * reporte del jinete. Una racion confirmada nunca vuelve a previsión.
   */
  isProjection?: boolean;
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
    const { vet, baseline } = await loadNutritionContext(
      tx,
      input.tenantId,
      input.horseId,
    );

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
      workType: (input.workType as never) ?? null,
      isProjection: input.isProjection ?? false,
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
        isProjection: row.isProjection,
      }));
  });
}
