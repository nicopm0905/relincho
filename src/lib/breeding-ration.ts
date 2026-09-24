/**
 * Racion orientativa para caballos de cria, sin configurar nada: el estado
 * reproductivo sale del modulo de reproduccion y la etapa de crecimiento de la
 * fecha de nacimiento.
 *
 * Las cifras siguen las pautas habituales (NRC 2007, Nutrient Requirements of
 * Horses) expresadas como se dan de comer: materia seca total y concentrado en
 * % del peso vivo, y proteina bruta de la racion. Es una guia para ajustar con
 * el veterinario o el nutricionista, no una prescripcion.
 */

export type RationStage =
  | "MAINTENANCE"
  | "EARLY_GESTATION"
  | "LATE_GESTATION"
  | "EARLY_LACTATION"
  | "LATE_LACTATION"
  | "NURSING_FOAL"
  | "WEANLING"
  | "YEARLING"
  | "TWO_YEAR_OLD";

type StageGuide = {
  label: string;
  /** Materia seca total, % del peso vivo al dia (minimo y maximo). */
  dmPct: [number, number];
  /** Concentrado, % del peso vivo al dia. */
  concentratePct: [number, number];
  /** Proteina bruta de la racion total, %. */
  proteinPct: number;
  notes: string[];
};

const GUIDE: Record<RationStage, StageGuide> = {
  MAINTENANCE: {
    label: "Mantenimiento",
    dmPct: [1.8, 2.0],
    concentratePct: [0, 0.4],
    proteinPct: 10,
    notes: ["Con buen heno o pasto suele bastar; el concentrado, solo si pierde condición."],
  },
  EARLY_GESTATION: {
    label: "Gestación (meses 1-7)",
    dmPct: [1.8, 2.0],
    concentratePct: [0, 0.5],
    proteinPct: 10,
    notes: ["Las necesidades apenas cambian: evitar que engorde en exceso."],
  },
  LATE_GESTATION: {
    label: "Gestación, último tercio (meses 8-11)",
    dmPct: [1.5, 2.0],
    concentratePct: [0.5, 1.0],
    proteinPct: 12,
    notes: [
      "El potro crece sobre todo ahora: sube proteína, calcio y fósforo (pienso de yeguas).",
      "El útero comprime el estómago: repartir el concentrado en más tomas.",
    ],
  },
  EARLY_LACTATION: {
    label: "Lactación (meses 1-3)",
    dmPct: [2.5, 3.0],
    concentratePct: [1.0, 1.5],
    proteinPct: 13,
    notes: [
      "Es la etapa de más necesidades de la yegua: agua abundante siempre disponible.",
      "Vigilar la condición corporal cada semana.",
    ],
  },
  LATE_LACTATION: {
    label: "Lactación (desde el mes 4)",
    dmPct: [2.0, 2.5],
    concentratePct: [0.5, 1.0],
    proteinPct: 11,
    notes: ["La producción de leche baja: reducir el concentrado poco a poco hacia el destete."],
  },
  NURSING_FOAL: {
    label: "Potro lactante",
    dmPct: [0.5, 1.0],
    concentratePct: [0.5, 1.0],
    proteinPct: 16,
    notes: [
      "La leche materna es la base; el pienso de iniciación (creep) desde las 6-8 semanas.",
      "Regla práctica: unos 0,5 kg de pienso de iniciación por mes de edad.",
    ],
  },
  WEANLING: {
    label: "Destetado (hasta el año)",
    dmPct: [2.5, 3.0],
    concentratePct: [1.0, 1.5],
    proteinPct: 14,
    notes: [
      "Crecimiento rápido: pienso de crecimiento equilibrado en calcio y fósforo.",
      "Evitar excesos de energía (riesgo de problemas de desarrollo articular).",
    ],
  },
  YEARLING: {
    label: "Añojo (12-24 meses)",
    dmPct: [2.0, 2.5],
    concentratePct: [0.5, 1.0],
    proteinPct: 12,
    notes: ["El crecimiento se frena: ajustar el pienso a la condición corporal."],
  },
  TWO_YEAR_OLD: {
    label: "Dos años",
    dmPct: [2.0, 2.2],
    concentratePct: [0.4, 0.8],
    proteinPct: 11,
    notes: ["Si empieza la doma, la energía sube con el trabajo."],
  },
};

const DAY_MS = 86_400_000;
const MONTH_MS = 30.44 * DAY_MS;

/**
 * Peso orientativo de un PRE (adulto ~500 kg) por edad, para cuando el
 * veterinario aun no ha registrado el peso real.
 */
export function estimatedWeightKg(ageMonths: number | null, adultKg = 500) {
  if (ageMonths === null || ageMonths >= 36) return adultKg;
  // Curva de crecimiento tipica en % del peso adulto.
  const curve: [number, number][] = [[0, 10], [3, 30], [6, 46], [12, 66], [18, 80], [24, 90], [36, 100]];
  for (let i = 1; i < curve.length; i++) {
    const [m1, p1] = curve[i];
    const [m0, p0] = curve[i - 1];
    if (ageMonths <= m1) {
      const pct = p0 + ((p1 - p0) * (ageMonths - m0)) / (m1 - m0);
      return Math.round((adultKg * pct) / 100);
    }
  }
  return adultKg;
}

export type RationInput = {
  sex: string;
  birthDate: Date | null;
  weightKg: number | null;
  /** Estado de la yegua ahora (ver `mareState`) y fechas de su ultima cubricion/parto. */
  mare?: {
    pregnant: boolean;
    coveringDate: Date | null;
    lastFoalingDate: Date | null;
  };
  now?: Date;
};

export function stageFor(input: RationInput): { stage: RationStage; detail: string | null; ageMonths: number | null } {
  const now = input.now ?? new Date();
  const ageMonths = input.birthDate ? Math.max(0, (now.getTime() - input.birthDate.getTime()) / MONTH_MS) : null;

  if (ageMonths !== null && ageMonths < 36) {
    const detail = `${Math.floor(ageMonths)} meses`;
    if (ageMonths < 6) return { stage: "NURSING_FOAL", detail, ageMonths };
    if (ageMonths < 12) return { stage: "WEANLING", detail, ageMonths };
    if (ageMonths < 24) return { stage: "YEARLING", detail, ageMonths };
    return { stage: "TWO_YEAR_OLD", detail, ageMonths };
  }

  if (input.sex === "FEMALE" && input.mare) {
    const { pregnant, coveringDate, lastFoalingDate } = input.mare;
    if (lastFoalingDate) {
      const sinceFoaling = (now.getTime() - lastFoalingDate.getTime()) / MONTH_MS;
      if (sinceFoaling < 3) return { stage: "EARLY_LACTATION", detail: `${Math.floor(sinceFoaling) + 1}º mes de lactación`, ageMonths };
      if (sinceFoaling < 6) return { stage: "LATE_LACTATION", detail: `${Math.floor(sinceFoaling) + 1}º mes de lactación`, ageMonths };
    }
    if (pregnant && coveringDate) {
      const month = Math.floor((now.getTime() - coveringDate.getTime()) / MONTH_MS) + 1;
      return {
        stage: month >= 8 ? "LATE_GESTATION" : "EARLY_GESTATION",
        detail: `${Math.min(month, 11)}º mes de gestación`,
        ageMonths,
      };
    }
  }
  return { stage: "MAINTENANCE", detail: null, ageMonths };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function breedingRation(input: RationInput) {
  const { stage, detail, ageMonths } = stageFor(input);
  const guide = GUIDE[stage];
  const weightEstimated = input.weightKg == null || input.weightKg <= 0;
  const weightKg = weightEstimated ? estimatedWeightKg(ageMonths) : input.weightKg!;

  const dm: [number, number] = [round1((weightKg * guide.dmPct[0]) / 100), round1((weightKg * guide.dmPct[1]) / 100)];
  let concentrate: [number, number] = [
    round1((weightKg * guide.concentratePct[0]) / 100),
    round1((weightKg * guide.concentratePct[1]) / 100),
  ];
  // Potro lactante: la regla de 0,5 kg por mes de edad manda sobre el %.
  if (stage === "NURSING_FOAL" && ageMonths !== null) {
    const byAge = round1(Math.max(0, ageMonths - 1.5) * 0.5);
    concentrate = [round1(byAge * 0.8), round1(byAge)];
  }
  // El forraje es lo que falta hasta la materia seca total, nunca menos de lo minimo.
  const forage: [number, number] = [
    round1(Math.max(dm[0] - concentrate[1], (weightKg * (stage === "NURSING_FOAL" ? 0.3 : 1.2)) / 100)),
    round1(Math.max(dm[1] - concentrate[0], 0)),
  ];

  return {
    stage,
    label: guide.label,
    detail,
    weightKg,
    weightEstimated,
    dryMatterKg: dm,
    forageKg: forage,
    concentrateKg: concentrate,
    proteinPct: guide.proteinPct,
    notes: guide.notes,
  };
}
