/**
 * Calor del día: ¿a qué hora se puede trabajar hoy sin riesgo para el caballo?
 *
 * Se calcula solo, con la previsión hora a hora de la finca (temperatura y
 * humedad). Nadie tiene que apuntar nada.
 *
 * Dos índices, y manda el peor:
 *
 * 1. WBGT estimado (temperatura de globo y bulbo húmedo). Es el que usan la
 *    FEI y los veterinarios para competir con calor. Umbrales de la Australian
 *    Veterinary Association: < 28 sin cambios; 28-30 algunas precauciones;
 *    30-32 precauciones adicionales; 32-33 peligroso; > 33 suspender.
 *    Como la previsión no da radiación de globo, se aproxima con la fórmula
 *    del Bureau of Meteorology australiano a partir de temperatura y humedad
 *    (supone sol y poco viento: es conservadora, mejor pasarse que quedarse).
 *
 * 2. Índice de la USEF: °F + % de humedad. Menos de 130, sin problema; 130-150,
 *    vigilar; 150-180, precaución; más de 180, no ejercitar. Sirve sobre todo
 *    en días húmedos, cuando el sudor no evapora y el caballo no se refresca.
 *    Solo sube un escalón (150-180) o dos (> 180): en calor seco de Jerez
 *    infravalora el riesgo (40 °C con 20 % da 124, "seguro"), y para eso está
 *    el WBGT.
 *
 * 3. Un suelo por temperatura: desde 32 °C, al menos "vigilar", aunque el aire
 *    sea muy seco. El caballo produce mucho calor al trabajar y con el aire a
 *    más de 32 °C apenas lo pierde por radiación y convección; solo le queda
 *    el sudor.
 *
 * Módulo puro: sin red ni base de datos.
 */

export type HeatLevel = "NORMAL" | "VIGILAR" | "PRECAUCION" | "PELIGRO";

export const HEAT_LEVELS: HeatLevel[] = ["NORMAL", "VIGILAR", "PRECAUCION", "PELIGRO"];

export const HEAT_LABELS: Record<HeatLevel, string> = {
  NORMAL: "Sin riesgo por calor",
  VIGILAR: "Vigilar",
  PRECAUCION: "Precaución",
  PELIGRO: "Peligro",
};

const RANK: Record<HeatLevel, number> = { NORMAL: 0, VIGILAR: 1, PRECAUCION: 2, PELIGRO: 3 };

export function heatRank(level: HeatLevel): number {
  return RANK[level];
}

function worst(a: HeatLevel, b: HeatLevel): HeatLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Horas en las que se trabaja en una cuadra: de 7:00 a 21:00. */
export const WORK_HOURS = { from: 7, to: 21 } as const;

/** Umbrales de WBGT (°C) de cada nivel. */
export const WBGT_THRESHOLDS = { vigilar: 28, precaucion: 30, peligro: 32 } as const;

/** Desde esta temperatura del aire, al menos "vigilar". */
export const HOT_AIR_C = 32;

/** Umbrales del índice de la USEF (°F + % humedad). */
export const USEF_THRESHOLDS = { precaucion: 150, peligro: 180 } as const;

/** Presión de vapor (hPa) con la fórmula de Magnus. */
function vaporPressure(tempC: number, rh: number): number {
  return (rh / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
}

/** WBGT aproximado (Bureau of Meteorology): 0,567·T + 0,393·e + 3,94. */
export function wbgtApprox(tempC: number, rh: number): number {
  const value = 0.567 * tempC + 0.393 * vaporPressure(tempC, rh) + 3.94;
  return Math.round(value * 10) / 10;
}

/** Índice de la USEF: grados Fahrenheit más humedad relativa. */
export function usefIndex(tempC: number, rh: number): number {
  return Math.round((tempC * 9) / 5 + 32 + rh);
}

export function heatLevelFor(tempC: number, rh: number): HeatLevel {
  const wbgt = wbgtApprox(tempC, rh);
  let level: HeatLevel = "NORMAL";
  if (wbgt >= WBGT_THRESHOLDS.peligro) level = "PELIGRO";
  else if (wbgt >= WBGT_THRESHOLDS.precaucion) level = "PRECAUCION";
  else if (wbgt >= WBGT_THRESHOLDS.vigilar) level = "VIGILAR";

  const usef = usefIndex(tempC, rh);
  if (usef > USEF_THRESHOLDS.peligro) level = worst(level, "PRECAUCION");
  else if (usef > USEF_THRESHOLDS.precaucion) level = worst(level, "VIGILAR");

  if (tempC >= HOT_AIR_C) level = worst(level, "VIGILAR");
  return level;
}

export interface HourWeather {
  /** Hora local de la finca, 0-23. */
  hour: number;
  tempC: number;
  /** Humedad relativa, %. */
  rh: number;
}

export interface HeatHour extends HourWeather {
  wbgt: number;
  usef: number;
  level: HeatLevel;
}

export interface HeatDay {
  /** El peor nivel en horas de trabajo. */
  level: HeatLevel;
  label: string;
  maxTempC: number | null;
  minTempC: number | null;
  /** Hora más dura dentro del horario de trabajo. */
  peak: HeatHour | null;
  /** Horas de trabajo (7:00-20:00), con su nivel. */
  hours: HeatHour[];
  /** Trabajar antes de esta hora (las primeras horas son seguras). */
  workBefore: number | null;
  /** Trabajar a partir de esta hora (la tarde vuelve a ser segura). */
  workFrom: number | null;
  /** Ninguna hora de trabajo con un nivel asumible. */
  allDayDanger: boolean;
  /** Mensaje corto para el semáforo y el inicio. */
  headline: string;
  /** Qué hacer, en lenguaje de cuadra. */
  tips: string[];
  /**
   * Hay estrés por calor en horas de trabajo: el motor de nutrición añade
   * electrolitos si el caballo trabaja.
   */
  heatStress: boolean;
}

const hh = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** Una hora es asumible para trabajar si como mucho hay que vigilar. */
function workable(level: HeatLevel): boolean {
  return RANK[level] <= RANK.VIGILAR;
}

export function analyzeHeatDay(input: HourWeather[]): HeatDay {
  const all = input
    .filter((h) => Number.isFinite(h.tempC) && Number.isFinite(h.rh))
    .sort((a, b) => a.hour - b.hour);

  const hours: HeatHour[] = all
    .filter((h) => h.hour >= WORK_HOURS.from && h.hour < WORK_HOURS.to)
    .map((h) => ({
      ...h,
      wbgt: wbgtApprox(h.tempC, h.rh),
      usef: usefIndex(h.tempC, h.rh),
      level: heatLevelFor(h.tempC, h.rh),
    }));

  const temps = all.map((h) => h.tempC);
  const maxTempC = temps.length ? Math.round(Math.max(...temps)) : null;
  const minTempC = temps.length ? Math.round(Math.min(...temps)) : null;

  let level: HeatLevel = "NORMAL";
  let peak: HeatHour | null = null;
  for (const h of hours) {
    level = worst(level, h.level);
    if (!peak || h.wbgt > peak.wbgt) peak = h;
  }

  const bad = hours.filter((h) => !workable(h.level));
  const allDayDanger = hours.length > 0 && bad.length === hours.length;

  let workBefore: number | null = null;
  let workFrom: number | null = null;
  if (bad.length > 0 && !allDayDanger) {
    const firstBad = bad[0].hour;
    const lastBad = bad[bad.length - 1].hour;
    if (firstBad > hours[0].hour) workBefore = firstBad;
    if (lastBad + 1 < WORK_HOURS.to && lastBad + 1 <= hours[hours.length - 1].hour) {
      workFrom = lastBad + 1;
    }
  }

  let headline: string;
  if (hours.length === 0) {
    headline = "Sin previsión para hoy.";
  } else if (level === "NORMAL") {
    headline = "Sin restricciones por calor.";
  } else if (allDayDanger) {
    headline = "Calor peligroso todo el día: nada de trabajo intenso.";
  } else if (workBefore != null && workFrom != null) {
    headline = `Trabaja antes de las ${hh(workBefore)} o a partir de las ${hh(workFrom)}.`;
  } else if (workBefore != null) {
    headline = `Trabaja antes de las ${hh(workBefore)}.`;
  } else if (workFrom != null) {
    headline = `Trabaja a partir de las ${hh(workFrom)}.`;
  } else {
    // Todo el día en "vigilar": se puede, pero mejor a la hora más fresca.
    const coolest = hours.reduce((a, b) => (b.wbgt < a.wbgt ? b : a));
    headline = `Se puede trabajar vigilando; lo más fresco, a las ${hh(coolest.hour)}.`;
  }

  const tips: string[] = [];
  if (RANK[level] >= RANK.VIGILAR) {
    tips.push("Agua fresca a voluntad antes y después del trabajo.");
    tips.push("Al terminar, duchas de agua fría por todo el cuerpo hasta que respire normal.");
  }
  if (RANK[level] >= RANK.PRECAUCION) {
    tips.push("Acorta lo intenso y haz pausas a la sombra.");
    tips.push("Electrolitos en la toma de después del trabajo (la ración ya los pone).");
  }
  if (level === "PELIGRO") {
    tips.push("En las horas de peligro, ni pista ni saltos: como mucho paso a la sombra o caminador.");
    tips.push(
      "Si tras 15 minutos de duchas sigue respirando muy rápido, deja de sudar o pasa de 40 °C, llama al veterinario.",
    );
  }

  return {
    level,
    label: HEAT_LABELS[level],
    maxTempC,
    minTempC,
    peak,
    hours,
    workBefore,
    workFrom,
    allDayDanger,
    headline,
    tips,
    heatStress: RANK[level] >= RANK.VIGILAR,
  };
}

/** Resumen corto del día para una tarjeta: "Máx. 36 °C · Precaución". */
export function heatSummary(day: Pick<HeatDay, "maxTempC" | "label">): string {
  return [day.maxTempC != null ? `Máx. ${day.maxTempC} °C` : null, day.label]
    .filter(Boolean)
    .join(" · ");
}
