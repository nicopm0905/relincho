/**
 * Peso y condición corporal.
 *
 * Peso: báscula si la hay; si no, cinta de peso o la fórmula de Carroll y
 * Huntington (1988) con el perímetro torácico y la longitud del cuerpo:
 *   peso (lb) = perímetro² (in) × longitud (in) / 330
 * (280 en destetes y 301 en potros de un año). Se equivoca en torno a un
 * 3-4 % frente a la báscula; la cinta comercial suele quedarse corta. Lo que
 * importa es pesar siempre igual para ver la tendencia.
 *
 * Condición corporal: escala Henneke (1983), de 1 (caquéctico) a 9 (obeso),
 * mirando y palpando cuello, cruz, dorso, costillas, base de la cola y detrás
 * del hombro. 5 es lo ideal en la mayoría; las yeguas de cría paren y quedan
 * mejor con 5-7 (Henneke et al., 1984) y los sementales conviene que empiecen
 * la temporada en torno a 6, porque la pierden durante la monta.
 *
 * Módulo puro: sin Prisma, se usa en servidor y navegador.
 */

export const WEIGHT_METHODS = ["BASCULA", "CINTA", "MEDIDAS"] as const;
export type WeightMethod = (typeof WEIGHT_METHODS)[number];

export const WEIGHT_METHOD_LABELS: Record<WeightMethod, string> = {
  BASCULA: "Báscula",
  CINTA: "Cinta de peso",
  MEDIDAS: "Perímetro y longitud",
};

/** Henneke 1-9, en lenguaje de cuadra: qué se ve y qué se palpa. */
export const HENNEKE: { score: number; name: string; description: string }[] = [
  {
    score: 1,
    name: "Muy pobre",
    description:
      "Extremadamente flaco. Se marcan columna, costillas, base de la cola, cadera y cruz. No se palpa grasa.",
  },
  {
    score: 2,
    name: "Muy delgado",
    description:
      "Flaco. Columna, costillas, base de la cola y cadera muy marcadas; cruz, hombros y cuello apenas cubiertos.",
  },
  {
    score: 3,
    name: "Delgado",
    description:
      "Algo de grasa sobre la columna; las costillas se ven fácilmente; la base de la cola y la cadera se notan pero redondeadas.",
  },
  {
    score: 4,
    name: "Algo delgado",
    description:
      "Se ve la cresta del dorso y se adivina el contorno de las costillas; cruz, hombros y cuello no se ven flacos.",
  },
  {
    score: 5,
    name: "Ideal",
    description:
      "Dorso plano. Las costillas no se ven pero se palpan fácil. Grasa esponjosa en la base de la cola; hombros y cuello se funden con el cuerpo.",
  },
  {
    score: 6,
    name: "Algo gordo",
    description:
      "Puede haber un ligero surco en el dorso; grasa esponjosa sobre las costillas y blanda en la cola; empieza a acumularse detrás del hombro y en el cuello.",
  },
  {
    score: 7,
    name: "Gordo",
    description:
      "Surco en el dorso. Las costillas se palpan, pero con grasa entre ellas. Grasa visible en la cruz, detrás del hombro y en el cuello.",
  },
  {
    score: 8,
    name: "Obeso",
    description:
      "Surco marcado; cuesta palpar las costillas. Cruz y zona detrás del hombro rellenas, cuello grueso, grasa en la cara interna de los muslos.",
  },
  {
    score: 9,
    name: "Muy obeso",
    description:
      "Surco evidente, grasa a parches sobre las costillas, bultos de grasa en la cola, la cruz y el cuello; los muslos se rozan.",
  },
];

export function hennekeName(score: number): string {
  const entry = HENNEKE.find((h) => h.score === Math.round(score));
  return entry?.name ?? "";
}

// ---------------------------------------------------------------------------
// Peso por medidas
// ---------------------------------------------------------------------------

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

/** Divisor de la fórmula según la edad (Carroll y Huntington, 1988). */
export function formulaDivisor(ageMonths: number | null): number {
  if (ageMonths != null && ageMonths < 12) return 280;
  if (ageMonths != null && ageMonths < 24) return 301;
  return 330;
}

/** Peso estimado (kg) a partir del perímetro torácico y la longitud (cm). */
export function weightFromMeasurements(
  girthCm: number,
  lengthCm: number,
  ageMonths: number | null = null,
): number {
  const girthIn = girthCm / CM_PER_IN;
  const lengthIn = lengthCm / CM_PER_IN;
  const lb = (girthIn * girthIn * lengthIn) / formulaDivisor(ageMonths);
  return Math.round(lb * KG_PER_LB);
}

/** Medidas posibles de un caballo (para no guardar un error de tecleo). */
export const MEASURE_LIMITS = {
  girthCm: [60, 260],
  lengthCm: [50, 230],
  weightKg: [20, 1300],
} as const;

// ---------------------------------------------------------------------------
// Objetivo de condición corporal
// ---------------------------------------------------------------------------

export interface ConditionContext {
  sex: "MALE" | "FEMALE" | "GELDING";
  ageYears: number | null;
  /** Yegua preñada o con potro al pie, o que se va a cubrir. */
  broodmare?: boolean;
  /** Semental en monta o preparando la temporada. */
  breedingStallion?: boolean;
  /** Disciplina deportiva, si compite. */
  discipline?: string | null;
}

export interface ConditionTarget {
  min: number;
  max: number;
  ideal: number;
  /** Por qué ese objetivo, en una frase. */
  reason: string;
}

export function conditionTarget(ctx: ConditionContext): ConditionTarget {
  if (ctx.ageYears != null && ctx.ageYears < 3) {
    return {
      min: 4,
      max: 6,
      ideal: 5,
      reason: "En crecimiento: ni flaco ni gordo, el exceso de peso castiga las articulaciones.",
    };
  }
  if (ctx.sex === "FEMALE" && ctx.broodmare) {
    return {
      min: 5,
      max: 7,
      ideal: 6,
      reason: "Yegua de cría: con 5-7 queda preñada antes y aguanta mejor la lactación.",
    };
  }
  if (ctx.sex === "MALE" && ctx.breedingStallion) {
    return {
      min: 5,
      max: 6.5,
      ideal: 6,
      reason: "Semental: que empiece la temporada en torno a 6, porque la pierde durante la monta.",
    };
  }
  if (ctx.discipline === "RAID") {
    return {
      min: 4,
      max: 5,
      ideal: 4.5,
      reason: "Raid: algo más enjuto disipa mejor el calor en esfuerzos largos.",
    };
  }
  if (ctx.discipline && ctx.discipline !== "OCIO") {
    return {
      min: 4,
      max: 6,
      ideal: 5,
      reason: "Caballo de deporte: 5 es lo ideal; por encima de 6 carga más tendones y articulaciones.",
    };
  }
  if (ctx.ageYears != null && ctx.ageYears >= 20) {
    return {
      min: 5,
      max: 6,
      ideal: 5.5,
      reason: "Caballo mayor: mejor que entre en invierno algo cubierto, en torno a 6.",
    };
  }
  return { min: 4, max: 6, ideal: 5, reason: "Lo ideal es 5: costillas que no se ven pero se palpan." };
}

export type ConditionStatus = "MUY_BAJA" | "BAJA" | "OK" | "ALTA" | "MUY_ALTA";

export interface ConditionAssessment {
  status: ConditionStatus;
  text: string;
}

export function assessCondition(score: number, target: ConditionTarget): ConditionAssessment {
  if (score <= 3) {
    return {
      status: "MUY_BAJA",
      text: "Muy delgado: revisa dientes, parásitos y ración con el veterinario.",
    };
  }
  if (score >= 8) {
    return {
      status: "MUY_ALTA",
      text: "Obeso: riesgo alto de laminitis y síndrome metabólico. Habla con el veterinario y quita concentrado antes que forraje.",
    };
  }
  if (score < target.min) {
    return { status: "BAJA", text: `Por debajo de su objetivo (${fmtScore(target.min)}-${fmtScore(target.max)}): necesita ganar condición poco a poco.` };
  }
  if (score > target.max) {
    return {
      status: "ALTA",
      text:
        score >= 7
          ? "Gordo: vigila la laminitis. Menos concentrado y más ejercicio; el forraje no se quita."
          : `Por encima de su objetivo (${fmtScore(target.min)}-${fmtScore(target.max)}): ajusta el concentrado.`,
    };
  }
  return { status: "OK", text: "En su condición objetivo." };
}

export function fmtScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toLocaleString("es-ES");
}

// ---------------------------------------------------------------------------
// Tendencia y recordatorios
// ---------------------------------------------------------------------------

export interface WeightPoint {
  date: Date;
  weightKg: number;
  method: WeightMethod;
}

export interface WeightTrend {
  fromDate: Date;
  fromKg: number;
  changeKg: number;
  changePct: number;
  days: number;
  /** Cambio de más del 5 % en un mes. */
  alert: "PIERDE" | "GANA" | null;
}

const DAY_MS = 24 * 3600 * 1000;

/** Un mes, con margen: se compara con un pesaje de hace 3 a 8 semanas. */
const TREND_WINDOW_DAYS = [21, 56] as const;
const TREND_ALERT_PCT = 5;

/**
 * Cambio de peso del último mes, solo entre pesajes con el mismo método:
 * comparar cinta con báscula daría cambios que no existen.
 */
export function weightTrend(points: WeightPoint[]): WeightTrend | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const last = sorted[sorted.length - 1];
  const candidates = sorted.filter((p) => {
    const days = (last.date.getTime() - p.date.getTime()) / DAY_MS;
    return p.method === last.method && days >= TREND_WINDOW_DAYS[0] && days <= TREND_WINDOW_DAYS[1];
  });
  // El más cercano a un mes.
  const ref = candidates.sort(
    (a, b) =>
      Math.abs((last.date.getTime() - a.date.getTime()) / DAY_MS - 30) -
      Math.abs((last.date.getTime() - b.date.getTime()) / DAY_MS - 30),
  )[0];
  if (!ref) return null;
  const changeKg = Math.round((last.weightKg - ref.weightKg) * 10) / 10;
  const changePct = Math.round((changeKg / ref.weightKg) * 1000) / 10;
  const days = Math.round((last.date.getTime() - ref.date.getTime()) / DAY_MS);
  let alert: WeightTrend["alert"] = null;
  if (changePct <= -TREND_ALERT_PCT) alert = "PIERDE";
  else if (changePct >= TREND_ALERT_PCT) alert = "GANA";
  return { fromDate: ref.date, fromKg: ref.weightKg, changeKg, changePct, days, alert };
}

/** Cada cuánto conviene pesar: una vez al mes. */
export const WEIGH_EVERY_DAYS = 30;

export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

/**
 * Desparasitantes: se dosifica para el peso redondeado hacia arriba (a la
 * siguiente marca de 50 kg de la jeringa). Quedarse corto es lo que crea
 * resistencias en los parásitos.
 */
export function dewormerDoseWeight(weightKg: number): number {
  return Math.ceil(weightKg / 50) * 50;
}

export function ageInMonths(birthDate: Date | null, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  const months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birthDate.getUTCMonth()) -
    (now.getUTCDate() < birthDate.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
}
