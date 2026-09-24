/**
 * Reglas del ciclo reproductivo en un solo sitio. Antes el tablero, la ficha
 * del caballo e Inicio decidian cada uno si una yegua estaba preñada, y una
 * ecografia de gemelos la mandaba a "vacias".
 */

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
/** Gestacion media de la yegua; el parto normal cae entre 335 y 342 dias. */
export const GESTATION_DAYS = 340;
const GESTATION_MIN = 335;
const GESTATION_MAX = 342;

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function gestation(coveringDate: Date | string, now: Date = new Date()) {
  const start = new Date(coveringDate);
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / DAY_MS));
  return {
    days,
    percent: Math.min(100, Math.round((days / GESTATION_DAYS) * 100)),
    expected: addDays(start, GESTATION_DAYS),
    windowFrom: addDays(start, GESTATION_MIN),
    windowTo: addDays(start, GESTATION_MAX),
  };
}

/**
 * Ecografias de control tras la cubricion: deteccion (14-16 dias), latido
 * (25-30) y confirmacion (45-60). Devuelve la siguiente que toca y si ya va
 * tarde, contando las que ya estan hechas.
 */
export const CHECKPOINTS = [
  { key: "detection", label: "Eco de detección", from: 14, to: 16 },
  { key: "heartbeat", label: "Eco de latido", from: 25, to: 30 },
  { key: "confirmation", label: "Eco de confirmación", from: 45, to: 60 },
] as const;

export function nextCheckpoint(
  coveringDate: Date | string,
  checksDone: number,
  now: Date = new Date(),
) {
  const checkpoint = CHECKPOINTS[checksDone];
  if (!checkpoint) return null;
  const start = new Date(coveringDate);
  const due = addDays(start, checkpoint.from);
  const limit = addDays(start, checkpoint.to);
  return { ...checkpoint, due, limit, overdue: now.getTime() > limit.getTime() + DAY_MS };
}
