import "server-only";

import { addDays } from "date-fns";
import { withTenant } from "@/server/db/prisma";
import { stripTime, type PhaseValue } from "../performance/periodization";
import { computeDailyPrescription } from "./engine";
import { loadNutritionContext } from "./context";
import { getMaxTempRange } from "./weather";

/** Horizonte por defecto: la semana en curso y la siguiente. */
export const DEFAULT_PROJECTION_DAYS = 14;

/**
 * Trabajos que tiran de fuerza y potencia, y que por tanto justifican subir la
 * proteina de la racion nocturna para la reparacion del tejido.
 */
const STRENGTH_WORK_TYPES = new Set(["GIMNASIA_SALTO", "PISTA_ALTA_INTENSIDAD"]);

/**
 * Sudoracion estimada de un dia que todavia no se ha entrenado. Es una
 * previsión conservadora: cuando el jinete reporte la sesion real, la racion
 * se recalcula con el dato de verdad.
 */
function estimateSweat(
  workType: string,
  plannedLoadUa: number,
  tempC: number | null,
): "BAJA" | "MEDIA" | "ALTA" | null {
  if (workType === "DESCANSO") return null;
  if (plannedLoadUa > 400 || (tempC != null && tempC > 30 && plannedLoadUa > 200)) {
    return "ALTA";
  }
  if (plannedLoadUa > 200) return "MEDIA";
  return "BAJA";
}

export interface ProjectNutritionInput {
  tenantId: string;
  horseId: string;
  /** Primer dia a proyectar. Por defecto, hoy. */
  from?: Date;
  days?: number;
  /**
   * Por defecto las raciones ya confirmadas por un reporte del jinete no se
   * tocan. Solo el panel veterinario fuerza el recalculo completo.
   */
  overwriteConfirmed?: boolean;
}

/**
 * Calcula y guarda la racion prevista de cada dia del plan a partir de la carga
 * planificada, sin esperar a que el jinete entrene. Es lo que permite al mozo
 * de cuadras ver la comida de la semana por adelantado.
 */
export async function projectNutrition(input: ProjectNutritionInput) {
  const from = stripTime(input.from ?? new Date());
  const days = Math.min(Math.max(input.days ?? DEFAULT_PROJECTION_DAYS, 1), 60);
  const to = addDays(from, days - 1);

  // Una sola llamada al tiempo para todo el rango.
  const temps = await getMaxTempRange({ from, to });

  return withTenant(input.tenantId, async (tx) => {
    const context = await loadNutritionContext(tx, input.tenantId, input.horseId);

    const plannedDays = await tx.dailyLoad.findMany({
      where: {
        tenantId: input.tenantId,
        horseId: input.horseId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
      include: {
        microcycle: { select: { mesocycle: { select: { phase: true } } } },
      },
    });
    if (plannedDays.length === 0) return { written: 0, skipped: 0, days: [] };

    const existing = await tx.nutritionPrescription.findMany({
      where: {
        tenantId: input.tenantId,
        horseId: input.horseId,
        date: { gte: from, lte: to },
      },
      select: { date: true, isProjection: true },
    });
    const confirmed = new Set(
      existing
        .filter((row) => !row.isProjection)
        .map((row) => row.date.toISOString().slice(0, 10)),
    );

    let written = 0;
    let skipped = 0;
    const written_days: { date: Date; concentrateKg: number }[] = [];

    for (const day of plannedDays) {
      const key = day.date.toISOString().slice(0, 10);

      // Lo que ya paso de verdad manda sobre cualquier previsión.
      if (!input.overwriteConfirmed && confirmed.has(key)) {
        skipped++;
        continue;
      }

      const tempC = temps.get(key) ?? null;
      const phase = day.microcycle.mesocycle.phase as PhaseValue;

      const prescription = computeDailyPrescription({
        vet: context.vet,
        baseline: context.baseline,
        training: {
          internalLoadUa: day.plannedLoadUa,
          mesocyclePhase: phase,
          sweatLoss: estimateSweat(day.workType, day.plannedLoadUa, tempC),
          ambientTempC: tempC,
          strengthSession: STRENGTH_WORK_TYPES.has(day.workType),
        },
      });

      const data = {
        tenantId: input.tenantId,
        horseId: input.horseId,
        date: day.date,
        internalLoadUa: day.plannedLoadUa,
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
        ambientTempC: tempC,
        workType: day.workType,
        isProjection: true,
      };

      await tx.nutritionPrescription.upsert({
        where: { horseId_date: { horseId: input.horseId, date: day.date } },
        update: { ...data, computedAt: new Date() },
        create: data,
      });
      written++;
      written_days.push({ date: day.date, concentrateKg: prescription.concentrateKg });
    }

    return { written, skipped, days: written_days };
  });
}

/** Raciones de los proximos dias, para la previsión que ve el usuario. */
export async function getUpcomingRations(params: {
  tenantId: string;
  horseId: string;
  from?: Date;
  days?: number;
}) {
  const from = stripTime(params.from ?? new Date());
  const to = addDays(from, Math.min(Math.max(params.days ?? 7, 1), 60) - 1);

  return withTenant(params.tenantId, (tx) =>
    tx.nutritionPrescription.findMany({
      where: {
        tenantId: params.tenantId,
        horseId: params.horseId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
    }),
  );
}
