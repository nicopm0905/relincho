/**
 * Previsión del tiempo y municipios: la parte pura (sin red ni base de datos),
 * para poder probarla.
 *
 * - Previsión: MET Norway (Instituto Meteorológico de Noruega), API
 *   Locationforecast 2.0. Gratis, sin clave y con uso comercial permitido
 *   (CC BY 4.0, hay que citar la fuente). Da horas en UTC; aquí se pasan a la
 *   hora local de la finca.
 * - Municipios: los 8.132 del INE con su centroide (paquete
 *   spanish-cities-info), sin llamar a ningún servicio.
 */
import type { HourWeather } from "./heat";

// ---------------------------------------------------------------------------
// Previsión
// ---------------------------------------------------------------------------

/** Una hora de previsión, en UTC. */
export interface ForecastPoint {
  /** ISO en UTC: "2026-07-14T13:00:00Z". */
  time: string;
  tempC: number;
  rh: number;
}

interface MetNoResponse {
  properties?: {
    timeseries?: {
      time?: string;
      data?: { instant?: { details?: { air_temperature?: number; relative_humidity?: number } } };
    }[];
  };
}

/** Horas de la respuesta de MET Norway (compact). */
export function parseMetNo(json: unknown): ForecastPoint[] {
  const series = (json as MetNoResponse)?.properties?.timeseries ?? [];
  const out: ForecastPoint[] = [];
  for (const entry of series) {
    const details = entry.data?.instant?.details;
    const tempC = details?.air_temperature;
    const rh = details?.relative_humidity;
    if (!entry.time || typeof tempC !== "number" || typeof rh !== "number") continue;
    out.push({ time: new Date(entry.time).toISOString(), tempC, rh });
  }
  return out;
}

/**
 * Junta la previsión guardada con la nueva. La nueva manda en las horas que
 * trae; de la guardada se conservan las horas ya pasadas (la previsión solo
 * mira hacia delante, y por la tarde hace falta saber cómo fue la mañana).
 */
export function mergeForecast(
  stored: ForecastPoint[],
  fresh: ForecastPoint[],
  keepFrom: Date,
): ForecastPoint[] {
  if (fresh.length === 0) return stored.filter((p) => new Date(p.time) >= keepFrom);
  const firstFresh = Math.min(...fresh.map((p) => new Date(p.time).getTime()));
  const past = stored.filter((p) => {
    const t = new Date(p.time).getTime();
    return t < firstFresh && t >= keepFrom.getTime();
  });
  return [...past, ...fresh].sort((a, b) => a.time.localeCompare(b.time));
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** Día ("YYYY-MM-DD") y hora (0-23) locales de un instante. */
export function localParts(date: Date, timeZone: string): { day: string; hour: number } {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/** Día local de la finca ("YYYY-MM-DD"). */
export function localDayKey(now: Date, timeZone: string): string {
  return localParts(now, timeZone).day;
}

/** Horas de cada día local ("YYYY-MM-DD" → horas 0-23). */
export function pointsByLocalDay(points: ForecastPoint[], timeZone: string): Map<string, HourWeather[]> {
  const out = new Map<string, HourWeather[]>();
  for (const p of points) {
    const { day, hour } = localParts(new Date(p.time), timeZone);
    const list = out.get(day) ?? [];
    // Si dos instantes caen en la misma hora local (cambio de hora), vale el último.
    const existing = list.findIndex((h) => h.hour === hour);
    const value = { hour, tempC: p.tempC, rh: p.rh };
    if (existing >= 0) list[existing] = value;
    else list.push(value);
    out.set(day, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.hour - b.hour);
  return out;
}

/** Canarias va una hora por detrás de la península. */
export function timeZoneFor(latitude: number, longitude: number): string {
  if (latitude < 30 && longitude < -12) return "Atlantic/Canary";
  return "Europe/Madrid";
}

/** MET Norway pide como mucho 4 decimales (unos 11 m). */
export function truncateCoord(value: number): number {
  return Math.trunc(value * 10000) / 10000;
}

/** Clave de caché: dos decimales, ~1 km. Fincas vecinas comparten previsión. */
export function locationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Municipios
// ---------------------------------------------------------------------------

export interface Municipality {
  name: string;
  ineCode: string;
  province: string;
  latitude: number;
  longitude: number;
}

/** Sin tildes, mayúsculas ni signos: "Cádiz" = "cadiz". */
export function normalizePlace(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Código INE de cada provincia (los dos primeros dígitos del código de
 * municipio y del código postal), con los nombres que la gente escribe.
 */
const PROVINCES: [string, string[]][] = [
  ["01", ["alava", "araba"]],
  ["02", ["albacete"]],
  ["03", ["alicante", "alacant"]],
  ["04", ["almeria"]],
  ["05", ["avila"]],
  ["06", ["badajoz"]],
  ["07", ["baleares", "illes balears", "islas baleares", "balears"]],
  ["08", ["barcelona"]],
  ["09", ["burgos"]],
  ["10", ["caceres"]],
  ["11", ["cadiz"]],
  ["12", ["castellon", "castello"]],
  ["13", ["ciudad real"]],
  ["14", ["cordoba"]],
  ["15", ["a coruna", "la coruna", "coruna"]],
  ["16", ["cuenca"]],
  ["17", ["girona", "gerona"]],
  ["18", ["granada"]],
  ["19", ["guadalajara"]],
  ["20", ["gipuzkoa", "guipuzcoa"]],
  ["21", ["huelva"]],
  ["22", ["huesca"]],
  ["23", ["jaen"]],
  ["24", ["leon"]],
  ["25", ["lleida", "lerida"]],
  ["26", ["la rioja", "rioja"]],
  ["27", ["lugo"]],
  ["28", ["madrid"]],
  ["29", ["malaga"]],
  ["30", ["murcia"]],
  ["31", ["navarra", "nafarroa"]],
  ["32", ["ourense", "orense"]],
  ["33", ["asturias"]],
  ["34", ["palencia"]],
  ["35", ["las palmas"]],
  ["36", ["pontevedra"]],
  ["37", ["salamanca"]],
  ["38", ["santa cruz de tenerife", "tenerife"]],
  ["39", ["cantabria"]],
  ["40", ["segovia"]],
  ["41", ["sevilla"]],
  ["42", ["soria"]],
  ["43", ["tarragona"]],
  ["44", ["teruel"]],
  ["45", ["toledo"]],
  ["46", ["valencia"]],
  ["47", ["valladolid"]],
  ["48", ["bizkaia", "vizcaya"]],
  ["49", ["zamora"]],
  ["50", ["zaragoza"]],
  ["51", ["ceuta"]],
  ["52", ["melilla"]],
];

/** "Provincia de Cádiz", "CADIZ", "Cádiz" → "11". */
export function provinceCode(province: string | null | undefined): string | null {
  const value = normalizePlace(province).replace(/^(provincia de|province of) /, "");
  if (!value) return null;
  for (const [code, names] of PROVINCES) {
    if (names.includes(value)) return code;
  }
  for (const [code, names] of PROVINCES) {
    if (names.some((n) => value.includes(n))) return code;
  }
  return null;
}

/** "Puerto de Santa María, El" → "el puerto de santa maria". */
function canonicalName(value: string): string {
  const n = normalizePlace(value);
  const m = n.match(/^(.*) (el|la|los|las|o|a|os|as|l|els|les)$/);
  return m ? `${m[2]} ${m[1]}` : n;
}

/**
 * El municipio de la finca: primero por código postal, después por nombre
 * dentro de su provincia. Hay muchos "Villanueva" y "San José" en España.
 */
export function findMunicipality(
  all: Municipality[],
  postalCodesByIne: Record<string, string[]>,
  hints: { name?: string | null; province?: string | null; postalCode?: string | null },
): Municipality | null {
  const postal = hints.postalCode?.trim();
  const validPostal = postal && /^\d{5}$/.test(postal) ? postal : null;
  const prov = validPostal?.slice(0, 2) ?? provinceCode(hints.province);
  const name = hints.name ? canonicalName(hints.name) : "";

  const inProvince = prov ? all.filter((m) => m.ineCode.startsWith(prov)) : all;

  if (name) {
    const exact = inProvince.filter((m) => canonicalName(m.name) === name);
    if (exact.length > 0) return exact[0];
    const partial = inProvince.filter((m) => {
      const n = canonicalName(m.name);
      return n.startsWith(name) || name.startsWith(n) || n.includes(name);
    });
    if (partial.length === 1) return partial[0];
    if (partial.length > 1 && validPostal) {
      const byPostal = partial.find((m) => postalCodesByIne[m.ineCode]?.includes(validPostal));
      if (byPostal) return byPostal;
    }
    if (partial.length > 0) return partial[0];
  }

  if (validPostal) {
    const byPostal = inProvince.filter((m) => postalCodesByIne[m.ineCode]?.includes(validPostal));
    if (byPostal.length > 0) return byPostal[0];
  }
  return null;
}
