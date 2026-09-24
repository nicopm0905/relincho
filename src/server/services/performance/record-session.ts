import "server-only";
import { addDays } from "date-fns";
import { reportSession, type ReportSessionInput } from "./plan-service";
import { syncNutritionForDay } from "@/server/services/nutrition/sync";
import { projectNutrition } from "@/server/services/nutrition/projection";

/**
 * Un unico camino para registrar una sesion con esfuerzo: calcula la carga,
 * reajusta el plan si lo hay y resincroniza la racion del dia (y la de los
 * siguientes si el plan cambio). Lo usan el formulario rapido de entrenamiento
 * y el panel de rendimiento; antes el rapido guardaba la sesion aparte y el
 * motor de carga y de nutricion no se enteraba.
 */
export async function recordSessionWithLoad(
  input: ReportSessionInput & { strengthSession?: boolean },
) {
  const result = await reportSession(input);
  const prescription = await syncNutritionForDay({
    tenantId: input.tenantId,
    horseId: input.horseId,
    date: input.date,
    internalLoadUa: result.internalLoadUa,
    sweatLoss: input.sweatLoss ?? null,
    strengthSession: input.strengthSession,
    isProjection: false,
  });

  if (result.adjustments.length > 0) {
    await projectNutrition({
      tenantId: input.tenantId,
      horseId: input.horseId,
      from: addDays(input.date, 1),
    });
  }

  return { ...result, prescription };
}
