/**
 * Cuantificacion de la carga interna de sesion (Session-RPE, Foster)
 * adaptada al atleta equino.
 *
 * Carga Interna (UA) = RPE (1-10) x Duracion (minutos)
 */

export type FatigueZoneValue = "BAJA" | "MEDIA" | "ALTA";

/** Umbrales del arbol de decision nutricional (Unidades Arbitrarias). */
export const LOAD_THRESHOLDS = {
  /** Por debajo: trabajo ligero, sin depleccion significativa de glucogeno. */
  light: 200,
  /** Por debajo: trabajo medio de mantenimiento. */
  medium: 400,
} as const;

/** Gramos extra de concentrado por zona de fatiga. */
export const EXTRA_CONCENTRATE_GRAMS: Record<FatigueZoneValue, number> = {
  BAJA: 0,
  MEDIA: 400,
  ALTA: 800,
};

export function calcInternalLoad(rpe: number, minutes: number): number {
  const safeRpe = clamp(Math.round(rpe), 0, 10);
  const safeMinutes = Math.max(0, Math.round(minutes));
  return safeRpe * safeMinutes;
}

export function fatigueZoneFor(loadUa: number): FatigueZoneValue {
  if (loadUa < LOAD_THRESHOLDS.light) return "BAJA";
  if (loadUa <= LOAD_THRESHOLDS.medium) return "MEDIA";
  return "ALTA";
}

/**
 * Desviacion de la sesion real respecto a la planificada.
 * > 1 significa que el caballo ha trabajado por encima de lo previsto.
 */
export function loadDeviation(actualUa: number, plannedUa: number): number {
  if (plannedUa <= 0) return actualUa > 0 ? Infinity : 1;
  return actualUa / plannedUa;
}

/**
 * Sobrecarga aguda: la sesion ha excedido el margen de tolerancia del dia
 * o el jinete ha reportado fatiga explicita.
 */
export function isAcuteOverload(params: {
  actualUa: number;
  plannedUa: number;
  toleranceRatio?: number;
  riderReportedFatigue?: boolean;
}): boolean {
  const tolerance = params.toleranceRatio ?? 1.3;
  if (params.riderReportedFatigue) return true;
  // Un dia sin carga prevista no tiene ratio: un paseo suelto en jornada de
  // descanso no es una sobrecarga, pero una sesion de verdad si lo es.
  if (params.plannedUa <= 0) return params.actualUa >= LOAD_THRESHOLDS.light;
  return loadDeviation(params.actualUa, params.plannedUa) > tolerance;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
