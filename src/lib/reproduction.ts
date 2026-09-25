/**
 * Reglas del ciclo reproductivo en un solo sitio. Antes el tablero, la ficha
 * del caballo e Inicio decidian cada uno si una yegua estaba preñada, y una
 * ecografia de gemelos la mandaba a "vacias".
 */

import { DEFAULT_REPRO_SETTINGS, type ReproSettings } from "./repro-settings";

export const CHECK_RESULTS = [
  "POSITIVE",
  "TWINS",
  "NEGATIVE",
  "REABSORBED",
  "ABORTION",
] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

export const checkResultLabels: Record<CheckResult | "PENDING", string> = {
  PENDING: "Pendiente",
  POSITIVE: "Positiva",
  TWINS: "Gemelos",
  NEGATIVE: "Negativa",
  REABSORBED: "Reabsorción",
  ABORTION: "Aborto",
};

/** Resultados con gestacion en curso. Gemelos cuenta: sigue gestante (y pide atencion). */
const PREGNANT: ReadonlySet<string> = new Set(["POSITIVE", "TWINS"]);

export function isPregnantResult(result: string | null | undefined) {
  return !!result && PREGNANT.has(result);
}

/**
 * Resultado de una cubricion segun su ultima ecografia (por fecha, no por
 * orden de alta: una eco atrasada que se mete despues no manda).
 */
export function coveringResult(checks: { date: Date | string; result: string }[]) {
  if (checks.length === 0) return "PENDING";
  const latest = [...checks].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )[0];
  return latest.result;
}

export type MareState = "EMPTY" | "COVERED" | "PREGNANT" | "TWINS" | "LOST" | "FOALED";

export const mareStateLabels: Record<MareState, string> = {
  EMPTY: "Vacía",
  COVERED: "Cubierta (pdte. eco)",
  PREGNANT: "Preñada",
  TWINS: "Preñada de gemelos",
  LOST: "Pérdida gestacional",
  FOALED: "Parida",
};

/** Estado de la yegua a partir de su ultima cubricion del ciclo. */
export function mareState(
  latestCovering:
    | { foaling?: unknown; pregnancyChecks?: { date: Date | string; result: string }[] }
    | null
    | undefined,
): MareState {
  if (!latestCovering) return "EMPTY";
  if (latestCovering.foaling) return "FOALED";
  const result = coveringResult(latestCovering.pregnancyChecks ?? []);
  if (result === "PENDING") return "COVERED";
  if (result === "POSITIVE") return "PREGNANT";
  if (result === "TWINS") return "TWINS";
  if (result === "REABSORBED" || result === "ABORTION") return "LOST";
  return "EMPTY";
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Gestacion media de la yegua. Cada yeguada la ajusta y cada yegua la aprende. */
export const GESTATION_DAYS = DEFAULT_REPRO_SETTINGS.gestationDays;
/** Margen de la fecha probable de parto alrededor de la media de la yegua. */
const PROBABLE_MARGIN_DAYS = 10;

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type GestationOptions = {
  /** Gestacion media para esta yegua (aprendida o corregida a mano). */
  gestationDays?: number;
  settings?: Pick<ReproSettings, "gestationDays" | "gestationMinDays" | "gestationMaxDays">;
};

/**
 * Dias de gestacion y fecha probable de parto. La ventana probable son ±10
 * dias sobre la media de la yegua; `normalFrom`-`normalTo` es el rango normal
 * de la especie (antes de `normalFrom` seria prematuro, despues de `normalTo`
 * gestacion prolongada).
 */
export function gestation(
  coveringDate: Date | string,
  now: Date = new Date(),
  options: GestationOptions = {},
) {
  const settings = options.settings ?? DEFAULT_REPRO_SETTINGS;
  const mean = options.gestationDays ?? settings.gestationDays;
  const start = new Date(coveringDate);
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / DAY_MS));
  return {
    days,
    meanDays: mean,
    percent: Math.min(100, Math.round((days / mean) * 100)),
    expected: addDays(start, mean),
    windowFrom: addDays(start, Math.max(settings.gestationMinDays, mean - PROBABLE_MARGIN_DAYS)),
    windowTo: addDays(start, Math.min(settings.gestationMaxDays, mean + PROBABLE_MARGIN_DAYS)),
    normalFrom: addDays(start, settings.gestationMinDays),
    normalTo: addDays(start, settings.gestationMaxDays),
    premature: days > 0 && days < settings.gestationMinDays,
    prolonged: days > settings.gestationMaxDays,
  };
}

/**
 * Ecografias de control tras la cubricion. Por defecto: deteccion y gemelos
 * (14-16 dias, antes de la fijacion), latido (28-35) y confirmacion (45-60);
 * cada yeguada las ajusta en sus parametros. Devuelve la siguiente que toca y
 * si ya va tarde, contando las que ya estan hechas.
 */
export const CHECKPOINTS = DEFAULT_REPRO_SETTINGS.pregnancyCheckpoints;

export function nextCheckpoint(
  coveringDate: Date | string,
  checksDone: number,
  now: Date = new Date(),
  checkpoints: ReproSettings["pregnancyCheckpoints"] = CHECKPOINTS,
) {
  const checkpoint = checkpoints[checksDone];
  if (!checkpoint) return null;
  const start = new Date(coveringDate);
  const due = addDays(start, checkpoint.from);
  const limit = addDays(start, checkpoint.to);
  return { ...checkpoint, due, limit, overdue: now.getTime() > limit.getTime() + DAY_MS };
}
