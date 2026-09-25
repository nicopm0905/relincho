/**
 * Motor reproductivo: a partir de las exploraciones, cubriciones, ecografias y
 * partos de una yegua deduce en que fase esta, cuando ovulara, cuando cubrirla,
 * cuando vuelve a salir en celo y que hay que hacer con ella. Todo son
 * funciones puras (sin base de datos ni reloj propio: `now` entra como
 * parametro) para poder probarlas con fechas fijas.
 *
 * Fisiologia en la que se apoya (valores en `repro-settings.ts`):
 * - La yegua es poliestrica estacional: cicla con dias largos y entra en
 *   anestro en invierno. No menstrua.
 * - Ciclo estral ~21 dias; la ovulacion cae al final del celo.
 * - El foliculo dominante crece unos 2-3 mm/dia hasta ~35-45 mm y ovula.
 * - hCG o deslorelina con foliculo >= 35 mm: ovulacion a las ~36-48 h.
 * - PGF2α desde el dia 5 tras ovular: nuevo celo en 2-5 dias.
 * - Tras el parto: celo del potro, ovulacion hacia el dia 10.
 */

import {
  coveringResult,
  gestation,
  nextCheckpoint,
  type MareState,
  mareState,
} from "./reproduction";
import type { CoveringMethodKey, ReproSettings } from "./repro-settings";
import {
  assessFoalingWatch,
  assessNeonatal,
  gestationMilestones,
  type FoalingWatchInput,
  type Milestone,
  type NeonatalInput,
  type WatchAssessment,
} from "./repro-gestation";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function addHours(date: Date, h: number) {
  return new Date(date.getTime() + h * HOUR_MS);
}
function addDays(date: Date, d: number) {
  return new Date(date.getTime() + d * DAY_MS);
}
function daysBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / DAY_MS;
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Tipos de entrada (lo minimo que el motor necesita de cada registro)
// ---------------------------------------------------------------------------

export type ExamInput = {
  id?: string;
  date: Date | string;
  teasingScore?: number | null;
  leftFollicleMm?: number | null;
  rightFollicleMm?: number | null;
  corpusLuteum?: string | null;
  uterineEdema?: number | null;
  uterineFluidMm?: number | null;
  cervix?: string | null;
  ovulated?: boolean | null;
  treatments?: string[] | null;
};

export type CoveringInput = {
  id?: string;
  date: Date | string;
  method: string;
  pregnancyChecks?: { date: Date | string; result: string }[];
  foaling?: ({ date: Date | string; alive?: boolean | null } & NeonatalInput) | null;
  foalingWatch?: FoalingWatchInput[];
};

export type MareProfileInput = {
  cycleLengthDays?: number | null;
  estrusLengthDays?: number | null;
  gestationDays?: number | null;
  preovulatoryFollicleMm?: number | null;
  conditions?: string[] | null;
} | null;

export type MareHistory = {
  /** Todas las exploraciones de la yegua, de cualquier temporada. */
  exams: ExamInput[];
  /** Todas sus cubriciones, de cualquier temporada, con ecografias y parto. */
  coverings: CoveringInput[];
  profile?: MareProfileInput;
};

type Exam = Omit<ExamInput, "date"> & { date: Date };
type Covering = Omit<CoveringInput, "date"> & { date: Date };

function normalize(history: MareHistory) {
  const exams: Exam[] = history.exams
    .map((e) => ({ ...e, date: new Date(e.date) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const coverings: Covering[] = history.coverings
    .map((c) => ({ ...c, date: new Date(c.date) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return { exams, coverings };
}

export function dominantFollicle(exam: ExamInput): number | null {
  const sizes = [exam.leftFollicleMm, exam.rightFollicleMm].filter(
    (v): v is number => typeof v === "number" && v > 0,
  );
  return sizes.length ? Math.max(...sizes) : null;
}

function hasTreatment(exam: ExamInput, ...codes: string[]) {
  return (exam.treatments ?? []).some((t) => codes.includes(t));
}

// ---------------------------------------------------------------------------
// Parametros de la yegua: corregidos a mano > aprendidos > de la yeguada
// ---------------------------------------------------------------------------

export type ParamSource = "manual" | "learned" | "default";

export type MareParams = {
  cycleLengthDays: number;
  cycleSource: ParamSource;
  cycleSamples: number;
  estrusLengthDays: number;
  estrusSource: ParamSource;
  gestationDays: number;
  gestationSource: ParamSource;
  gestationSamples: number;
  preovulatoryFollicleMm: number;
  follicleSource: ParamSource;
  follicleSamples: number;
};

/** Ovulaciones registradas, en orden. */
export function ovulations(exams: ExamInput[]): Date[] {
  return exams
    .filter((e) => e.ovulated)
    .map((e) => new Date(e.date))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function learnMareParams(history: MareHistory, settings: ReproSettings): MareParams {
  const { exams, coverings } = normalize(history);
  const profile = history.profile ?? null;
  const learn = settings.learnFromHistory;

  // Ciclo: intervalo entre ovulaciones consecutivas. Solo cuentan los que
  // parecen un ciclo natural: entre 17 y 26 dias y sin prostaglandina en
  // medio (la PGF lo acorta a proposito).
  const ovs = exams.filter((e) => e.ovulated);
  const intervals: number[] = [];
  for (let i = 1; i < ovs.length; i++) {
    const gap = daysBetween(ovs[i - 1].date, ovs[i].date);
    const pgfBetween = exams.some(
      (e) => e.date > ovs[i - 1].date && e.date < ovs[i].date && hasTreatment(e, "PGF2A"),
    );
    if (gap >= 17 && gap <= 26 && !pgfBetween) intervals.push(gap);
  }

  // Gestacion: de la cubricion al parto con potro vivo, dentro del rango normal.
  const gestations = coverings
    .filter((c) => c.foaling && c.foaling.alive !== false)
    .map((c) => daysBetween(c.date, new Date(c.foaling!.date)))
    .filter((d) => d >= settings.gestationMinDays && d <= settings.gestationMaxDays);

  // Foliculo preovulatorio: el mayor medido en las 48 h previas a una ovulacion.
  const follicles: number[] = [];
  for (const ov of ovs) {
    const before = exams
      .filter((e) => !e.ovulated && e.date < ov.date && daysBetween(e.date, ov.date) <= 2)
      .map(dominantFollicle)
      .filter((v): v is number => v !== null);
    if (before.length) follicles.push(Math.max(...before));
  }

  const pick = (
    manual: number | null | undefined,
    samples: number[],
    minSamples: number,
    fallback: number,
  ): [number, ParamSource] => {
    if (manual) return [manual, "manual"];
    if (learn && samples.length >= minSamples) return [Math.round(median(samples)), "learned"];
    return [fallback, "default"];
  };

  const [cycleLengthDays, cycleSource] = pick(profile?.cycleLengthDays, intervals, 2, settings.cycleLengthDays);
  const [gestationDays, gestationSource] = pick(profile?.gestationDays, gestations, 1, settings.gestationDays);
  const [preovulatoryFollicleMm, follicleSource] = pick(
    profile?.preovulatoryFollicleMm,
    follicles,
    2,
    settings.preovulatoryFollicleMm,
  );
  const estrusLengthDays = profile?.estrusLengthDays ?? settings.estrusLengthDays;

  return {
    cycleLengthDays,
    cycleSource,
    cycleSamples: intervals.length,
    estrusLengthDays,
    estrusSource: profile?.estrusLengthDays ? "manual" : "default",
    gestationDays,
    gestationSource,
    gestationSamples: gestations.length,
    preovulatoryFollicleMm,
    follicleSource,
    follicleSamples: follicles.length,
  };
}

// ---------------------------------------------------------------------------
// Prediccion de ovulacion
// ---------------------------------------------------------------------------

export type OvulationBasis = "induction" | "follicle" | "pgf";

export type OvulationPrediction = {
  expected: Date;
  from: Date;
  to: Date;
  basis: OvulationBasis;
  confidence: "alta" | "media" | "baja";
  /** Mm/dia usados (observados entre dos exploraciones o los de la yeguada). */
  growthMmPerDay?: number;
  /** La ventana ya paso y no se ha registrado la ovulacion: hay que explorar. */
  overdue: boolean;
};

export function predictOvulation(
  history: MareHistory,
  settings: ReproSettings,
  params: Pick<MareParams, "preovulatoryFollicleMm">,
  now: Date,
): OvulationPrediction | null {
  const { exams } = normalize(history);
  const lastOvIdx = exams.map((e) => !!e.ovulated).lastIndexOf(true);
  const since = exams.slice(lastOvIdx + 1);
  if (since.length === 0) return null;
  const last = since[since.length - 1];
  const lastOv = lastOvIdx >= 0 ? exams[lastOvIdx].date : null;

  const finish = (p: Omit<OvulationPrediction, "overdue">): OvulationPrediction => ({
    ...p,
    overdue: now.getTime() > p.to.getTime() + 12 * HOUR_MS,
  });

  // 1. Induccion con foliculo suficiente: lo mas fiable.
  const induction = [...since]
    .reverse()
    .find((e) => {
      if (!hasTreatment(e, "HCG", "DESLORELIN")) return false;
      const f = dominantFollicle(e);
      return f === null || f >= settings.inductionMinFollicleMm - 3;
    });
  if (induction) {
    const expected = addHours(induction.date, settings.inductionToOvulationHours);
    return finish({
      expected,
      from: addHours(expected, -12),
      to: addHours(expected, 12),
      basis: "induction",
      confidence: "alta",
    });
  }

  // 2. Crecimiento del foliculo dominante.
  const measured = since.filter((e) => dominantFollicle(e) !== null);
  const lastMeasured = measured[measured.length - 1];
  if (lastMeasured) {
    const size = dominantFollicle(lastMeasured)!;
    let growth = settings.follicleGrowthMmPerDay;
    let confidence: OvulationPrediction["confidence"] = "baja";
    const prev = measured[measured.length - 2];
    if (prev) {
      const dt = daysBetween(prev.date, lastMeasured.date);
      const observed = dt > 0.5 ? (size - dominantFollicle(prev)!) / dt : NaN;
      if (observed >= 1 && observed <= 6) {
        growth = Math.round(observed * 10) / 10;
        confidence = "media";
      }
    }
    // Un foliculo pequeño sin mas signos no permite predecir nada util.
    const signs =
      (lastMeasured.teasingScore ?? 0) >= 2 ||
      (lastMeasured.uterineEdema ?? 0) >= 1 ||
      size >= settings.estrusFollicleMm - 5;
    if (signs) {
      const target = params.preovulatoryFollicleMm;
      const daysToGo = size >= target ? 1 : (target - size) / growth + 1;
      const expected = addDays(lastMeasured.date, daysToGo);
      const spread = size >= target ? 24 : Math.min(72, 24 + daysToGo * 8);
      return finish({
        expected,
        from: addHours(expected, -spread),
        to: addHours(expected, spread),
        basis: "follicle",
        confidence,
        growthMmPerDay: growth,
      });
    }
  }

  // 3. Prostaglandina con cuerpo luteo maduro.
  const pgf = [...since].reverse().find((e) => hasTreatment(e, "PGF2A"));
  if (pgf && (!lastOv || daysBetween(lastOv, pgf.date) >= settings.pgfMinDaysAfterOvulation)) {
    const expected = addDays(pgf.date, settings.pgfToOvulationDays);
    return finish({
      expected,
      from: addDays(expected, -2),
      to: addDays(expected, 2),
      basis: "pgf",
      confidence: "baja",
    });
  }

  void last;
  return null;
}

// ---------------------------------------------------------------------------
// Ventana de cubricion segun metodo
// ---------------------------------------------------------------------------

export function breedingWindow(
  ovulation: Pick<OvulationPrediction, "expected">,
  method: CoveringMethodKey,
  settings: ReproSettings,
) {
  const w = settings.breedingWindows[method];
  return {
    method,
    from: addHours(ovulation.expected, w.fromHours),
    to: addHours(ovulation.expected, w.toHours),
  };
}

// ---------------------------------------------------------------------------
// Siguiente celo
// ---------------------------------------------------------------------------

export type EstrusPrediction = {
  estrusFrom: Date;
  estrusTo: Date;
  ovulation: Date;
  /** Se ha proyectado mas de un ciclo sin datos: fiabilidad baja. */
  extrapolated: boolean;
  basis: "cycle" | "pgf";
};

export function predictNextEstrus(
  history: MareHistory,
  settings: ReproSettings,
  params: Pick<MareParams, "cycleLengthDays" | "estrusLengthDays">,
  now: Date,
): EstrusPrediction | null {
  const { exams } = normalize(history);
  const ovs = exams.filter((e) => e.ovulated);
  const lastOv = ovs[ovs.length - 1]?.date;
  if (!lastOv) return null;

  // PGF puesta despues de la ultima ovulacion con el cuerpo luteo ya maduro.
  const pgf = exams.find(
    (e) =>
      e.date > lastOv &&
      hasTreatment(e, "PGF2A") &&
      daysBetween(lastOv, e.date) >= settings.pgfMinDaysAfterOvulation,
  );
  if (pgf) {
    const ovulation = addDays(pgf.date, settings.pgfToOvulationDays);
    if (ovulation.getTime() > now.getTime() - 2 * DAY_MS) {
      return {
        estrusFrom: addDays(pgf.date, settings.pgfToEstrusDays),
        estrusTo: addDays(ovulation, 1),
        ovulation,
        extrapolated: false,
        basis: "pgf",
      };
    }
  }

  let ovulation = addDays(lastOv, params.cycleLengthDays);
  let cycles = 1;
  // Si ya paso sin registrarse, se proyecta al siguiente ciclo (maximo 3).
  while (ovulation.getTime() < now.getTime() - 2 * DAY_MS && cycles < 4) {
    ovulation = addDays(ovulation, params.cycleLengthDays);
    cycles++;
  }
  if (ovulation.getTime() < now.getTime() - 2 * DAY_MS) return null;
  return {
    estrusFrom: addDays(ovulation, -(params.estrusLengthDays - 1)),
    estrusTo: addDays(ovulation, 1),
    ovulation,
    extrapolated: cycles > 1,
    basis: "cycle",
  };
}

// ---------------------------------------------------------------------------
// Celo del potro
// ---------------------------------------------------------------------------

export function foalHeat(foalingDate: Date | string, settings: ReproSettings) {
  const d = new Date(foalingDate);
  return {
    from: addDays(d, settings.foalHeatFromDay),
    to: addDays(d, settings.foalHeatToDay),
    minOvulation: addDays(d, settings.foalHeatMinOvulationDay),
  };
}

// ---------------------------------------------------------------------------
// Categoria de la temporada
// ---------------------------------------------------------------------------

export const SEASON_CATEGORIES = ["MAIDEN", "FOALING", "BARREN", "SLIPPED", "RESTED"] as const;
export type SeasonCategory = (typeof SEASON_CATEGORIES)[number];

export const seasonCategoryLabels: Record<SeasonCategory, string> = {
  MAIDEN: "Doncella",
  FOALING: "Parida / con potro",
  BARREN: "Vacía",
  SLIPPED: "Pérdida gestacional",
  RESTED: "Descansada",
};

/**
 * Doncella: nunca cubierta. Parida: pare esta temporada. Vacia: cubierta la
 * temporada anterior sin quedar preñada. Perdida: quedo preñada y la perdio.
 * Descansada: no se cubrio la temporada anterior pero tiene historial.
 */
export function seasonCategory(coveringsInput: CoveringInput[], season: number): SeasonCategory {
  const coverings = coveringsInput.map((c) => ({ ...c, date: new Date(c.date) }));
  const before = coverings.filter((c) => c.date.getFullYear() < season);
  if (before.length === 0) return "MAIDEN";
  const prev = before.filter((c) => c.date.getFullYear() === season - 1);
  if (prev.length === 0) {
    // Cubierta hace dos temporadas y parida en esta: sigue siendo parida.
    const foalsNow = before.some(
      (c) => c.foaling && new Date(c.foaling.date).getFullYear() === season,
    );
    return foalsNow ? "FOALING" : "RESTED";
  }
  const last = prev[prev.length - 1];
  const result = coveringResult(last.pregnancyChecks ?? []);
  if (last.foaling) return last.foaling.alive === false ? "SLIPPED" : "FOALING";
  if (result === "POSITIVE" || result === "TWINS") return "FOALING";
  if (result === "REABSORBED" || result === "ABORTION") return "SLIPPED";
  return "BARREN";
}

// ---------------------------------------------------------------------------
// Fase, avisos y acciones
// ---------------------------------------------------------------------------

export const REPRO_PHASES = [
  "ANESTRUS",
  "UNTRACKED",
  "DIESTRUS",
  "IN_HEAT",
  "COVERED",
  "PREGNANT",
  "FOALING_SOON",
  "POSTPARTUM",
] as const;
export type ReproPhase = (typeof REPRO_PHASES)[number];

export const reproPhaseLabels: Record<ReproPhase, string> = {
  ANESTRUS: "Anestro",
  UNTRACKED: "Sin seguimiento",
  DIESTRUS: "Ciclando (diestro)",
  IN_HEAT: "En celo",
  COVERED: "Cubierta",
  PREGNANT: "Gestante",
  FOALING_SOON: "Parto próximo",
  POSTPARTUM: "Parida",
};

export type ReproAlertLevel = "info" | "warning" | "danger";
export type ReproAlert = { key: string; level: ReproAlertLevel; message: string };

export type ReproActionKind =
  | "exam"
  | "breed"
  | "tease"
  | "pregnancy_check"
  | "foaling_watch"
  | "confirm_ovulation"
  | "milestone";

export type ReproAction = {
  kind: ReproActionKind;
  label: string;
  from: Date;
  to: Date;
  /** Ya deberia estar hecho. */
  overdue: boolean;
};

export type MareInsight = {
  phase: ReproPhase;
  mareState: MareState;
  params: MareParams;
  lastExam: { date: Date; follicleMm: number | null; edema: number | null } | null;
  lastOvulation: Date | null;
  ovulation: OvulationPrediction | null;
  breeding: ReturnType<typeof breedingWindow> | null;
  nextEstrus: EstrusPrediction | null;
  gestation: ReturnType<typeof gestation> | null;
  nextCheck: ReturnType<typeof nextCheckpoint> | null;
  foalHeat: ReturnType<typeof foalHeat> | null;
  lactating: boolean;
  /** Hitos de la gestacion en curso (vacunas, desparasitacion, manejo). */
  milestones: Milestone[];
  /** Lectura de la ultima vigilancia preparto. */
  watch: WatchAssessment | null;
  alerts: ReproAlert[];
  actions: ReproAction[];
};

/** Dias tras el parto en los que la yegua cuenta como lactante. */
const LACTATION_DAYS = 180;
/** Una cubricion sin ecografias deja de contar como "cubierta" a los 60 dias. */
const COVERED_STALE_DAYS = 60;

function isEstrusExam(exam: Exam, settings: ReproSettings) {
  if (exam.ovulated) return false;
  const f = dominantFollicle(exam);
  const hasCL = exam.corpusLuteum && exam.corpusLuteum !== "NONE";
  return (
    (exam.teasingScore ?? 0) >= 2 ||
    (exam.uterineEdema ?? 0) >= 2 ||
    (f !== null && f >= settings.estrusFollicleMm && !hasCL)
  );
}

export function mareInsight(
  history: MareHistory,
  settings: ReproSettings,
  now: Date = new Date(),
): MareInsight {
  const { exams, coverings } = normalize(history);
  const params = learnMareParams(history, settings);
  const alerts: ReproAlert[] = [];
  const actions: ReproAction[] = [];

  const latestCovering = coverings[coverings.length - 1] ?? null;
  const state = mareState(latestCovering);
  const lastExam = exams[exams.length - 1] ?? null;
  const ovs = exams.filter((e) => e.ovulated);
  const lastOvulation = ovs[ovs.length - 1]?.date ?? null;

  const foaled = [...coverings].reverse().find((c) => c.foaling);
  const foalingDate = foaled?.foaling ? new Date(foaled.foaling.date) : null;
  const daysPostpartum = foalingDate ? daysBetween(foalingDate, now) : null;
  const lactating = daysPostpartum !== null && daysPostpartum >= 0 && daysPostpartum <= LACTATION_DAYS;

  let phase: ReproPhase = "UNTRACKED";
  let gest: MareInsight["gestation"] = null;
  let nextCheck: MareInsight["nextCheck"] = null;
  let ovulation: OvulationPrediction | null = null;
  let breeding: MareInsight["breeding"] = null;
  let nextEstrus: EstrusPrediction | null = null;
  let fh: MareInsight["foalHeat"] = null;
  let milestones: Milestone[] = [];
  let watch: WatchAssessment | null = null;

  const pregnant = state === "PREGNANT" || state === "TWINS";
  const coveredRecently =
    state === "COVERED" &&
    latestCovering !== null &&
    daysBetween(latestCovering.date, now) <= COVERED_STALE_DAYS;

  if (pregnant && latestCovering) {
    gest = gestation(latestCovering.date, now, {
      gestationDays: params.gestationDays,
      settings,
    });
    const checksDone = latestCovering.pregnancyChecks?.length ?? 0;
    nextCheck = nextCheckpoint(latestCovering.date, checksDone, now, settings.pregnancyCheckpoints);
    const watchFrom = addDays(gest.windowFrom, -settings.foalingWatchDays);
    phase = now >= watchFrom ? "FOALING_SOON" : "PREGNANT";

    if (state === "TWINS") {
      alerts.push({
        key: "twins",
        level: "danger",
        message: "Gestación gemelar: valorar con el veterinario la reducción de una vesícula.",
      });
    }
    if (gest.prolonged) {
      alerts.push({
        key: "prolonged",
        level: "danger",
        message: `Gestación prolongada: ${gest.days} días (más de ${settings.gestationMaxDays}).`,
      });
    } else if (now > gest.windowTo) {
      alerts.push({
        key: "late",
        level: "warning",
        message: "Pasada la fecha probable de parto: vigilar signos de parto.",
      });
    }
    if (phase === "FOALING_SOON") {
      actions.push({
        kind: "foaling_watch",
        label: "Vigilancia de parto",
        from: gest.windowFrom,
        to: gest.windowTo,
        overdue: false,
      });
      watch = assessFoalingWatch(latestCovering.foalingWatch ?? [], settings, now);
      if (watch && watch.level !== "info") {
        alerts.push({ key: "foaling_watch", level: watch.level, message: watch.message });
      }
    }

    // Hitos: se enseñan desde una semana antes (o la antelacion de las
    // tareas, si es mayor) hasta una semana despues.
    milestones = gestationMilestones(latestCovering.date, gest.expected, settings);
    const lead = Math.max(7, settings.milestoneTaskLeadDays);
    for (const m of milestones) {
      const until = daysBetween(now, m.due);
      if (until <= lead && until >= -7) {
        actions.push({
          kind: "milestone",
          label: m.label,
          from: m.due,
          to: addDays(m.due, 3),
          overdue: until < -3,
        });
      }
    }
  } else if (coveredRecently && latestCovering) {
    phase = "COVERED";
    nextCheck = nextCheckpoint(latestCovering.date, 0, now, settings.pregnancyCheckpoints);
    // Cubierta sin ovulacion registrada despues: confirmarla.
    const ovAfter = ovs.some((o) => o.date >= addHours(latestCovering.date, -24));
    if (!ovAfter && daysBetween(latestCovering.date, now) <= 4) {
      actions.push({
        kind: "confirm_ovulation",
        label: "Confirmar ovulación tras la cubrición",
        from: addHours(latestCovering.date, 24),
        to: addHours(latestCovering.date, 48),
        overdue: now > addHours(latestCovering.date, 60),
      });
    }
    // Liquido intrauterino tras cubrir: endometritis post-cubricion.
    const fluidAfter = exams.find(
      (e) =>
        e.date >= latestCovering.date &&
        daysBetween(latestCovering.date, e.date) <= 3 &&
        (e.uterineFluidMm ?? 0) >= 2,
    );
    if (fluidAfter) {
      alerts.push({
        key: "post_breeding_fluid",
        level: "warning",
        message: `Líquido intrauterino tras la cubrición (${fluidAfter.uterineFluidMm} mm): posible endometritis post-cubrición.`,
      });
    }
  } else {
    if (state === "LOST" && latestCovering && daysBetween(latestCovering.date, now) <= 120) {
      alerts.push({
        key: "loss",
        level: "warning",
        message: "Pérdida gestacional reciente: revisar causa antes de volver a cubrir.",
      });
    }

    ovulation = predictOvulation(history, settings, params, now);
    const recentHeatExam =
      lastExam && daysBetween(lastExam.date, now) <= 3 && isEstrusExam(lastExam, settings);
    const inPostpartum =
      daysPostpartum !== null &&
      daysPostpartum >= 0 &&
      daysPostpartum <= settings.foalHeatToDay + 10 &&
      !(lastOvulation && foalingDate && lastOvulation > foalingDate);

    if (inPostpartum && foalingDate) {
      phase = "POSTPARTUM";
      fh = foalHeat(foalingDate, settings);
      for (const a of assessNeonatal(foaled!.foaling!, settings)) {
        alerts.push({ key: `neonatal_${a.key}`, level: a.level, message: a.message });
      }
      if (now <= fh.to) {
        actions.push({
          kind: "exam",
          label: "Explorar celo del potro",
          from: fh.from,
          to: fh.to,
          overdue: false,
        });
      }
      if (ovulation && ovulation.expected < fh.minOvulation) {
        alerts.push({
          key: "early_foal_heat",
          level: "info",
          message: `Ovulación prevista antes del día ${settings.foalHeatMinOvulationDay} postparto: la fertilidad es menor, valorar saltar este celo.`,
        });
      }
    } else if (recentHeatExam || (ovulation && !ovulation.overdue)) {
      phase = "IN_HEAT";
    } else {
      nextEstrus = predictNextEstrus(history, settings, params, now);
      const month = now.getMonth() + 1;
      const recentOv = lastOvulation && daysBetween(lastOvulation, now) <= params.cycleLengthDays + 5;
      if (recentOv || (nextEstrus && !nextEstrus.extrapolated)) phase = "DIESTRUS";
      else if (settings.anestrusMonths.includes(month)) phase = "ANESTRUS";
      else if (nextEstrus) phase = "DIESTRUS";
      else phase = "UNTRACKED";
    }

    if (ovulation) {
      breeding = breedingWindow(ovulation, settings.defaultMethod, settings);
      if (ovulation.overdue) {
        actions.push({
          kind: "exam",
          label: "Explorar: ovulación prevista no confirmada",
          from: ovulation.to,
          to: addDays(ovulation.to, 1),
          overdue: true,
        });
      } else {
        actions.push({
          kind: "breed",
          label: "Ventana de cubrición",
          from: breeding.from,
          to: breeding.to,
          overdue: false,
        });
        // En celo se explora cada 24-48 h hasta confirmar la ovulacion.
        const nextExam = lastExam ? addDays(lastExam.date, 1) : now;
        actions.push({
          kind: "exam",
          label: "Explorar seguimiento folicular",
          from: nextExam,
          to: addDays(nextExam, 1),
          overdue: now > addDays(nextExam, 1),
        });
      }
    } else if (phase === "IN_HEAT") {
      actions.push({
        kind: "exam",
        label: "Explorar (en celo, sin predicción de ovulación)",
        from: now,
        to: addDays(now, 1),
        overdue: false,
      });
    }

    if (nextEstrus) {
      actions.push({
        kind: "tease",
        label: nextEstrus.basis === "pgf" ? "Celo inducido por PGF: recelar" : "Celo previsto: recelar",
        from: addDays(nextEstrus.estrusFrom, -1),
        to: nextEstrus.estrusTo,
        overdue: false,
      });
    }

    // Candidata a PGF: diestro con cuerpo luteo maduro y sin cubrir.
    if (
      phase === "DIESTRUS" &&
      lastOvulation &&
      daysBetween(lastOvulation, now) >= settings.pgfMinDaysAfterOvulation &&
      daysBetween(lastOvulation, now) <= params.cycleLengthDays - 5
    ) {
      alerts.push({
        key: "pgf_candidate",
        level: "info",
        message: `Cuerpo lúteo maduro: una PGF2α adelantaría el celo unos ${Math.max(
          0,
          Math.round(daysBetween(now, nextEstrus?.estrusFrom ?? now) - settings.pgfToEstrusDays),
        )} días.`,
      });
    }
  }

  if (nextCheck) {
    actions.push({
      kind: "pregnancy_check",
      label: nextCheck.label,
      from: nextCheck.due,
      to: nextCheck.limit,
      overdue: nextCheck.overdue,
    });
  }

  if (lastExam && (lastExam.uterineFluidMm ?? 0) >= 2 && phase !== "COVERED" && daysBetween(lastExam.date, now) <= 7) {
    alerts.push({
      key: "fluid",
      level: "warning",
      message: `Líquido intrauterino en la última exploración (${lastExam.uterineFluidMm} mm).`,
    });
  }

  actions.sort((a, b) => a.from.getTime() - b.from.getTime());

  return {
    phase,
    mareState: state,
    params,
    lastExam: lastExam
      ? { date: lastExam.date, follicleMm: dominantFollicle(lastExam), edema: lastExam.uterineEdema ?? null }
      : null,
    lastOvulation,
    ovulation,
    breeding,
    nextEstrus,
    gestation: gest,
    nextCheck,
    foalHeat: fh,
    lactating,
    milestones,
    watch,
    alerts,
    actions,
  };
}

/** Acciones que tocan hoy (o van tarde) de una yegua. */
export function actionsDueBy(insight: Pick<MareInsight, "actions">, until: Date) {
  return insight.actions.filter((a) => a.from.getTime() <= until.getTime());
}

/**
 * Estado reproductivo que consume la nutricion (y el resto de modulos que
 * usaban el campo manual de la ficha veterinaria).
 */
export function nutritionReproStatus(insight: MareInsight): {
  status: "CICLANDO" | "GESTANTE" | "LACTANDO" | "NA";
  gestationMonth: number | null;
} {
  if (insight.gestation) {
    return {
      status: "GESTANTE",
      gestationMonth: Math.min(12, Math.max(1, Math.ceil(insight.gestation.days / 30.4))),
    };
  }
  if (insight.lactating) return { status: "LACTANDO", gestationMonth: null };
  if (insight.phase === "ANESTRUS" || insight.phase === "UNTRACKED") return { status: "NA", gestationMonth: null };
  return { status: "CICLANDO", gestationMonth: null };
}
