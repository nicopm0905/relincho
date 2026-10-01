/**
 * Semáforo de aptitud: ¿puede trabajar hoy este caballo?
 *
 * Junta dos fuentes que ningún otro software de cuadra cruza:
 *
 * 1. El chequeo de patas del mozo antes de sacar al caballo (30 segundos):
 *    calor, hinchazón o dolor al palpar en cada extremidad y si cojea.
 *    En tendón, el primer aviso de una lesión suele ser un calor sutil o una
 *    hinchazón en la cara palmar de la caña, antes de que haya cojera (Iimori
 *    et al., 2021: con engrosamiento o edema del tendón, ~26-28 % acabó en
 *    lesión grave frente al 4,9 % sin hallazgos).
 *
 * 2. La carga de las últimas semanas (sRPE × minutos, en UA): carga aguda
 *    (7 días) frente a crónica (media semanal de 28 días). Es el ratio
 *    agudo:crónico de las ciencias del deporte (Gabbett, 2016). En caballos la
 *    evidencia es aún escasa (Munsters et al., 2018, en completo: una carga
 *    crónica alta parece proteger), así que se usa como aviso orientativo y
 *    nunca pone un rojo por sí solo.
 *
 * 3. El calor del día en la finca (lib/heat), que se calcula solo con la
 *    previsión. El calor no pone rojo a un caballo sano: dice a qué hora
 *    trabajarlo. Solo si no hay ninguna hora asumible en todo el día pasa a
 *    ámbar ("trabajo suave").
 *
 * No diagnostica: ordena las prioridades del día y dice cuándo llamar al
 * veterinario. Módulo puro: sin Prisma, se usa en servidor y navegador.
 */

import { heatRank, type HeatDay } from "./heat";

// ---------------------------------------------------------------------------
// Extremidades
// ---------------------------------------------------------------------------

/** Manos = extremidades anteriores; pies = posteriores (como se dice en la cuadra). */
export const LEGS = ["MI", "MD", "PI", "PD"] as const;
export type Leg = (typeof LEGS)[number];

export const LEG_LABELS: Record<Leg, string> = {
  MI: "Mano izquierda",
  MD: "Mano derecha",
  PI: "Pie izquierdo",
  PD: "Pie derecho",
};

export const LEG_SHORT: Record<Leg, string> = {
  MI: "MI",
  MD: "MD",
  PI: "PI",
  PD: "PD",
};

export function isLeg(value: string): value is Leg {
  return (LEGS as readonly string[]).includes(value);
}

export type Lameness = "NO" | "DUDOSA" | "SI";

export interface LimbCheckData {
  /** Día del chequeo (se compara por fecha, sin hora). */
  date: Date;
  heatLegs: string[];
  swellingLegs: string[];
  painLegs: string[];
  lameness: Lameness;
}

/** Pata con algún hallazgo en el chequeo. */
export function legsWithFindings(check: LimbCheckData): Leg[] {
  const set = new Set<string>([
    ...check.heatLegs,
    ...check.swellingLegs,
    ...check.painLegs,
  ]);
  return LEGS.filter((leg) => set.has(leg));
}

export function isAllClear(check: LimbCheckData): boolean {
  return check.lameness === "NO" && legsWithFindings(check).length === 0;
}

// ---------------------------------------------------------------------------
// Carga aguda / crónica
// ---------------------------------------------------------------------------

export const WORKLOAD = {
  acuteDays: 7,
  chronicDays: 28,
  /** Días de historial mínimos para que el ratio signifique algo. */
  minHistoryDays: 21,
  /** Zona de progresión segura (Gabbett, 2016). */
  sweetSpot: [0.8, 1.3] as const,
  /** Por encima: pico de carga. */
  spike: 1.5,
} as const;

export type WorkloadZone =
  | "CALIBRANDO"
  | "BAJA"
  | "OPTIMA"
  | "SUBIENDO"
  | "PICO";

export const WORKLOAD_ZONE_LABELS: Record<WorkloadZone, string> = {
  CALIBRANDO: "Calibrando",
  BAJA: "Por debajo de su media",
  OPTIMA: "Progresión segura",
  SUBIENDO: "Subiendo rápido",
  PICO: "Pico de carga",
};

export interface SessionLoad {
  date: Date;
  /** Carga interna de la sesión en UA (intensidad × minutos). */
  loadUa: number;
}

export interface WorkloadSummary {
  /** UA de los últimos 7 días (hoy incluido). */
  acuteUa: number;
  /** Media semanal de los últimos 28 días (hoy incluido). */
  chronicWeeklyUa: number;
  /** acute / chronic; null si no hay carga crónica o falta historial. */
  ratio: number | null;
  zone: WorkloadZone;
  /** Días desde la primera sesión registrada dentro de la ventana. */
  historyDays: number;
  /**
   * Monotonía de Foster (media / desviación de la carga diaria de 7 días).
   * Por encima de 2, la semana es demasiado igual: poco descanso real.
   */
  monotony: number | null;
  /** Carga diaria de los últimos 28 días, del más antiguo a hoy. */
  daily: { date: Date; loadUa: number }[];
}

const DAY_MS = 24 * 3600 * 1000;

/** Medianoche UTC del día (misma convención que el motor de periodización). */
export function dayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function computeWorkload(
  sessions: SessionLoad[],
  today: Date = new Date(),
): WorkloadSummary {
  const end = dayKey(today);
  const start = end - (WORKLOAD.chronicDays - 1) * DAY_MS;

  const byDay = new Map<number, number>();
  let firstDay: number | null = null;
  for (const session of sessions) {
    const key = dayKey(session.date);
    if (key < start || key > end) continue;
    const load = Math.max(0, Math.round(session.loadUa));
    byDay.set(key, (byDay.get(key) ?? 0) + load);
    if (firstDay === null || key < firstDay) firstDay = key;
  }

  const daily = Array.from({ length: WORKLOAD.chronicDays }, (_, i) => {
    const key = start + i * DAY_MS;
    return { date: new Date(key), loadUa: byDay.get(key) ?? 0 };
  });

  const acuteDaily = daily.slice(-WORKLOAD.acuteDays).map((d) => d.loadUa);
  const acuteUa = acuteDaily.reduce((a, b) => a + b, 0);
  const chronicTotal = daily.reduce((a, d) => a + d.loadUa, 0);
  const chronicWeeklyUa = Math.round(
    chronicTotal / (WORKLOAD.chronicDays / WORKLOAD.acuteDays),
  );

  const historyDays = firstDay === null ? 0 : Math.round((end - firstDay) / DAY_MS) + 1;

  let ratio: number | null = null;
  let zone: WorkloadZone = "CALIBRANDO";
  if (historyDays >= WORKLOAD.minHistoryDays && chronicWeeklyUa > 0) {
    ratio = Math.round((acuteUa / chronicWeeklyUa) * 100) / 100;
    zone = zoneForRatio(ratio);
  }

  return {
    acuteUa,
    chronicWeeklyUa,
    ratio,
    zone,
    historyDays,
    monotony: monotonyOf(acuteDaily),
    daily,
  };
}

export function zoneForRatio(ratio: number): WorkloadZone {
  if (ratio < WORKLOAD.sweetSpot[0]) return "BAJA";
  if (ratio <= WORKLOAD.sweetSpot[1]) return "OPTIMA";
  if (ratio <= WORKLOAD.spike) return "SUBIENDO";
  return "PICO";
}

/** Monotonía de Foster; null si la semana no tiene carga o no varía nada. */
export function monotonyOf(dailyLoads: number[]): number | null {
  const n = dailyLoads.length;
  if (n === 0) return null;
  const mean = dailyLoads.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return null;
  const variance = dailyLoads.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  if (sd === 0) return null;
  return Math.round((mean / sd) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Semáforo
// ---------------------------------------------------------------------------

export type ReadinessLevel = "VERDE" | "AMBAR" | "ROJO" | "SIN_CHEQUEO";

export const READINESS_LABELS: Record<ReadinessLevel, string> = {
  VERDE: "Apto",
  AMBAR: "Trabajo suave",
  ROJO: "No trabaja hoy",
  SIN_CHEQUEO: "Sin chequear hoy",
};

export const READINESS_ADVICE: Record<ReadinessLevel, string> = {
  VERDE: "Puede hacer el trabajo previsto.",
  AMBAR:
    "Solo paso y trote suave en suelo blando: nada de saltos, galope fuerte ni pista dura. Repite el chequeo mañana.",
  ROJO: "Que no trabaje. Avisa al veterinario y repite el chequeo mañana.",
  SIN_CHEQUEO: "Palpa las cuatro patas y míralo al trote antes de sacarlo.",
};

export interface ReadinessInput {
  /** Chequeo de hoy, si lo hay. */
  today: LimbCheckData | null;
  /** Chequeo de ayer, para detectar hallazgos que se repiten. */
  yesterday?: LimbCheckData | null;
  workload?: Pick<WorkloadSummary, "ratio" | "zone" | "monotony"> | null;
  tendonHistory?: boolean;
  /** Calor del día en la finca; null si no hay previsión. */
  heat?: ReadinessHeat | null;
}

export type ReadinessHeat = Pick<HeatDay, "level" | "headline" | "allDayDanger">;

export interface ReadinessResult {
  level: ReadinessLevel;
  label: string;
  advice: string;
  /** Motivos en lenguaje de cuadra, del más grave al más leve. */
  reasons: string[];
  /** Observaciones que no cambian el color. */
  notes: string[];
}

function legList(legs: readonly string[]): string {
  const names = LEGS.filter((l) => legs.includes(l)).map((l) =>
    LEG_LABELS[l].toLowerCase(),
  );
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export function assessReadiness(input: ReadinessInput): ReadinessResult {
  const red: string[] = [];
  const amber: string[] = [];
  const check = input.today;

  if (check) {
    if (check.lameness === "SI") red.push("Cojea.");
    if (check.painLegs.length > 0)
      red.push(`Dolor al palpar en ${legList(check.painLegs)}.`);

    const heatAndSwelling = check.heatLegs.filter((l) =>
      check.swellingLegs.includes(l),
    );
    if (heatAndSwelling.length > 0)
      red.push(`Calor e hinchazón a la vez en ${legList(heatAndSwelling)}.`);

    // Mismo hallazgo en la misma pata dos días seguidos: ya no es casualidad.
    const prev = input.yesterday;
    if (prev) {
      const prevFindings = new Set([...prev.heatLegs, ...prev.swellingLegs]);
      const repeated = [...new Set([...check.heatLegs, ...check.swellingLegs])]
        .filter((l) => prevFindings.has(l))
        .filter((l) => !heatAndSwelling.includes(l));
      if (repeated.length > 0)
        red.push(`Segundo día seguido con calor o hinchazón en ${legList(repeated)}.`);
    }

    const onlyHeat = check.heatLegs.filter(
      (l) => !check.swellingLegs.includes(l),
    );
    const onlySwelling = check.swellingLegs.filter(
      (l) => !check.heatLegs.includes(l),
    );
    if (onlyHeat.length > 0) amber.push(`Calor en ${legList(onlyHeat)}.`);
    if (onlySwelling.length > 0)
      amber.push(`Hinchazón en ${legList(onlySwelling)}.`);
    if (check.lameness === "DUDOSA") amber.push("Movimiento dudoso al trote.");
  }

  const workload = input.workload;
  if (workload?.ratio != null) {
    const times = workload.ratio.toLocaleString("es-ES", {
      maximumFractionDigits: 2,
    });
    if (workload.zone === "PICO") {
      amber.push(
        `Pico de carga: esta semana lleva ${times} veces su media de las últimas cuatro.`,
      );
    } else if (workload.zone === "SUBIENDO" && input.tendonHistory) {
      amber.push(
        `La carga sube rápido (${times} veces su media) y tiene historial de tendón.`,
      );
    }
  }
  // Solo matiza: se explica, pero no cambia el color.
  const notes: string[] = [];
  if (workload?.monotony != null && workload.monotony > 2) {
    notes.push("Semana muy monótona: le faltan días de descanso de verdad.");
  }

  if (input.tendonHistory && check && legsWithFindings(check).length > 0 && red.length === 0) {
    amber.push("Tiene historial de tendón: cualquier hallazgo cuenta doble.");
  }

  // Calor: la hora de trabajo cambia; el color, solo si no hay hora buena.
  const heat = input.heat;
  if (heat?.allDayDanger) {
    amber.push("Calor peligroso todo el día en la finca: como mucho paso a la sombra.");
  } else if (heat && heatRank(heat.level) >= heatRank("PRECAUCION")) {
    notes.push(`Calor: ${heat.headline}`);
  }

  let level: ReadinessLevel;
  if (red.length > 0) level = "ROJO";
  else if (!check) level = "SIN_CHEQUEO";
  else if (amber.length > 0) level = "AMBAR";
  else level = "VERDE";

  // Sin chequeo, los avisos de carga se enseñan igual, pero el color lo pone
  // el chequeo: no hay semáforo verde sin haber tocado las patas.
  return {
    level,
    label: READINESS_LABELS[level],
    advice: READINESS_ADVICE[level],
    reasons: [...red, ...amber],
    notes,
  };
}

/** Orden para listar: primero lo que más urge. */
export const READINESS_ORDER: Record<ReadinessLevel, number> = {
  ROJO: 0,
  AMBAR: 1,
  SIN_CHEQUEO: 2,
  VERDE: 3,
};
