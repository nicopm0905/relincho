import "server-only";

import type { PrismaClient } from "@prisma/client";
import { getAllCities } from "spanish-cities-info";
import { postalCodesByIneCode } from "spanish-cities-info/postal-codes";
import { inSequence, prisma, withTenant } from "@/server/db/prisma";
import { getBaseUrl } from "@/lib/utils";
import { analyzeHeatDay, type HeatDay } from "@/lib/heat";
import {
  findMunicipality,
  localDayKey,
  locationKey,
  mergeForecast,
  parseMetNo,
  pointsByLocalDay,
  timeZoneFor,
  truncateCoord,
  type ForecastPoint,
  type Municipality,
} from "@/lib/forecast";

/**
 * El tiempo de cada finca, sin que nadie lo apunte y sin suscripciones.
 *
 * Ubicación (sin llamar a nadie): las coordenadas de la explotación (libro de
 * explotación) o, si no hay, su municipio buscado en la lista del INE que va
 * dentro de la app (código postal, nombre y provincia). Solo si no hay nada se
 * usa Jerez.
 *
 * Previsión: MET Norway (api.met.no), gratis, sin clave y con uso comercial
 * permitido citando la fuente (CC BY 4.0). Sus condiciones piden identificarse
 * con el User-Agent, no pedir más de lo necesario y guardar la respuesta: se
 * guarda en la tabla WeatherForecast, compartida por las fincas del mismo km,
 * y solo se vuelve a pedir cuando caduca (cabecera Expires), con
 * If-Modified-Since. Si MET falla, se usa la última previsión guardada; si no
 * hay ninguna, el semáforo y la ración siguen sin el calor ese día.
 */

const JEREZ = { latitude: 36.6866, longitude: -6.1367, place: "Jerez de la Frontera" };

const MET_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";

/** No dejar colgada una página si el servicio tarda. */
const TIMEOUT_MS = 5000;

/** Si MET no dice cuándo caduca, se vuelve a pedir a la hora. */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/** Horas pasadas que se guardan (la ración de ayer, el calor de esta mañana). */
const KEEP_PAST_MS = 3 * 24 * 3600 * 1000;

export type LocationSource = "COORDENADAS" | "MUNICIPIO" | "POR_DEFECTO";

export interface FarmLocation {
  latitude: number;
  longitude: number;
  place: string;
  source: LocationSource;
}

export interface LocationInputs {
  latitude: number | null;
  longitude: number | null;
  municipality: string | null;
  province: string | null;
  postalCode: string | null;
}

type Tx = Pick<PrismaClient, "tenant" | "farmBookSettings">;

/** Lo que la cuenta sabe de dónde está la finca. */
export async function loadLocationInputs(tx: Tx, tenantId: string): Promise<LocationInputs> {
  const [tenant, settings] = await inSequence([
    () =>
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { city: true, province: true, postalCode: true },
      }),
    () =>
      tx.farmBookSettings.findUnique({
        where: { tenantId },
        select: { latitude: true, longitude: true, farmMunicipality: true, farmProvince: true },
      }),
  ]);
  return {
    latitude: settings?.latitude != null ? Number(settings.latitude) : null,
    longitude: settings?.longitude != null ? Number(settings.longitude) : null,
    municipality: settings?.farmMunicipality || tenant?.city || null,
    province: settings?.farmProvince || tenant?.province || null,
    // El código postal de la empresa solo vale si el municipio es el suyo.
    postalCode: settings?.farmMunicipality ? null : (tenant?.postalCode ?? null),
  };
}

let municipalities: Municipality[] | null = null;
function allMunicipalities(): Municipality[] {
  municipalities ??= getAllCities().map((c) => ({
    name: c.name,
    ineCode: c.ineCode,
    province: c.province,
    latitude: c.latitude,
    longitude: c.longitude,
  }));
  return municipalities;
}

export function resolveFarmLocation(inputs: LocationInputs): FarmLocation {
  if (inputs.latitude != null && inputs.longitude != null) {
    return {
      latitude: inputs.latitude,
      longitude: inputs.longitude,
      place: inputs.municipality ?? "la explotación",
      source: "COORDENADAS",
    };
  }
  if (inputs.municipality || inputs.postalCode) {
    const found = findMunicipality(allMunicipalities(), postalCodesByIneCode, {
      name: inputs.municipality,
      province: inputs.province,
      postalCode: inputs.postalCode,
    });
    if (found) {
      return { latitude: found.latitude, longitude: found.longitude, place: found.name, source: "MUNICIPIO" };
    }
  }
  return { ...JEREZ, source: "POR_DEFECTO" };
}

/** Ubicación de la finca de una cuenta. */
export async function getFarmLocation(tenantId: string): Promise<FarmLocation> {
  const inputs = await withTenant(tenantId, (tx) => loadLocationInputs(tx, tenantId));
  return resolveFarmLocation(inputs);
}

function userAgent(): string {
  // MET Norway bloquea las peticiones sin un User-Agent que identifique la app.
  return process.env.WEATHER_USER_AGENT?.trim() || `Relincho/1.0 (+${getBaseUrl()})`;
}

interface MetFetch {
  status: "ok" | "not-modified" | "error";
  points: ForecastPoint[];
  lastModified: string | null;
  expiresAt: Date;
}

async function fetchMetNo(latitude: number, longitude: number, lastModified: string | null): Promise<MetFetch> {
  const base = process.env.WEATHER_BASE_URL?.replace(/\/$/, "") || MET_URL;
  const url = `${base}?lat=${truncateCoord(latitude)}&lon=${truncateCoord(longitude)}`;
  const fallbackExpiry = new Date(Date.now() + DEFAULT_TTL_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        ...(lastModified ? { "If-Modified-Since": lastModified } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const expiresHeader = res.headers.get("expires");
    const expires = expiresHeader ? new Date(expiresHeader) : fallbackExpiry;
    const expiresAt = Number.isNaN(expires.getTime()) || expires.getTime() < Date.now() ? fallbackExpiry : expires;
    if (res.status === 304) return { status: "not-modified", points: [], lastModified, expiresAt };
    if (!res.ok) return { status: "error", points: [], lastModified, expiresAt: fallbackExpiry };
    return {
      status: "ok",
      points: parseMetNo(await res.json()),
      lastModified: res.headers.get("last-modified"),
      expiresAt,
    };
  } catch {
    return { status: "error", points: [], lastModified, expiresAt: fallbackExpiry };
  }
}

/**
 * Previsión hora a hora de un punto, de la tabla si sigue vigente y si no de
 * MET Norway. Devuelve las horas (UTC) y la zona horaria de la finca.
 */
type Forecast = { points: ForecastPoint[]; timeZone: string } | null;

/** Una página pide el tiempo desde varios sitios a la vez: una sola consulta. */
const inFlight = new Map<string, Promise<Forecast>>();

export function getForecast(
  location: Pick<FarmLocation, "latitude" | "longitude">,
  now: Date = new Date(),
): Promise<Forecast> {
  const key = locationKey(location.latitude, location.longitude);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = loadForecast(location, key, now).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function loadForecast(
  location: Pick<FarmLocation, "latitude" | "longitude">,
  key: string,
  now: Date,
): Promise<Forecast> {
  const timeZone = timeZoneFor(location.latitude, location.longitude);
  const stored = await prisma.weatherForecast.findUnique({ where: { locationKey: key } }).catch(() => null);
  const storedPoints = (stored?.points as ForecastPoint[] | undefined) ?? [];

  if (stored && stored.expiresAt > now) return { points: storedPoints, timeZone: stored.timeZone };

  const result = await fetchMetNo(location.latitude, location.longitude, stored?.lastModified ?? null);
  const keepFrom = new Date(now.getTime() - KEEP_PAST_MS);

  if (result.status === "error") {
    // Mejor una previsión de hace unas horas que ninguna.
    return storedPoints.length > 0 ? { points: storedPoints, timeZone } : null;
  }

  const points =
    result.status === "ok" ? mergeForecast(storedPoints, result.points, keepFrom) : storedPoints;
  const data = {
    latitude: location.latitude,
    longitude: location.longitude,
    timeZone,
    points: points as unknown as object,
    lastModified: result.lastModified,
    fetchedAt: now,
    expiresAt: result.expiresAt,
  };
  await prisma.weatherForecast
    .upsert({ where: { locationKey: key }, update: data, create: { locationKey: key, ...data } })
    .catch(() => null);
  return points.length > 0 ? { points, timeZone } : null;
}

export interface FarmHeatDay {
  /** Día local de la finca, "YYYY-MM-DD". */
  date: string;
  heat: HeatDay;
}

export interface FarmHeat {
  location: FarmLocation;
  today: FarmHeatDay;
  /** Mañana y pasado. */
  upcoming: FarmHeatDay[];
}

/** Calor de hoy y de los dos días siguientes en la finca. */
export async function getFarmHeat(tenantId: string, now: Date = new Date()): Promise<FarmHeat | null> {
  const location = await getFarmLocation(tenantId);
  const forecast = await getForecast(location, now);
  if (!forecast) return null;
  const byDay = pointsByLocalDay(forecast.points, forecast.timeZone);
  const todayKey = localDayKey(now, forecast.timeZone);
  const days = [...byDay.keys()].filter((d) => d >= todayKey).sort().slice(0, 3);
  if (days[0] !== todayKey) return null;
  const [first, ...rest] = days.map((date) => ({ date, heat: analyzeHeatDay(byDay.get(date)!) }));
  return { location, today: first, upcoming: rest };
}

export interface DailyHeat {
  maxTempC: number | null;
  heatStress: boolean;
}

/**
 * Calor de un rango de días, para la ración de la semana: "YYYY-MM-DD" →
 * máxima y si hay estrés por calor en horas de trabajo. Lo que la previsión no
 * cubre (más de 9 días, o días pasados que no se guardaron) no aparece.
 */
export async function getDailyHeatRange(params: {
  tenantId: string;
  from: Date;
  to: Date;
  now?: Date;
}): Promise<Map<string, DailyHeat>> {
  const result = new Map<string, DailyHeat>();
  const location = await getFarmLocation(params.tenantId);
  const forecast = await getForecast(location, params.now ?? new Date());
  if (!forecast) return result;
  // Las fechas de la ración son medianoche UTC del día: se comparan por la fecha.
  const from = params.from.toISOString().slice(0, 10);
  const to = params.to.toISOString().slice(0, 10);
  for (const [date, hours] of pointsByLocalDay(forecast.points, forecast.timeZone)) {
    if (date < from || date > to) continue;
    const heat = analyzeHeatDay(hours);
    result.set(date, { maxTempC: heat.maxTempC, heatStress: heat.heatStress });
  }
  return result;
}

/** Calor de un día concreto (la ración del día). */
export async function getDailyHeat(params: { tenantId: string; date: Date }): Promise<DailyHeat | null> {
  const map = await getDailyHeatRange({ tenantId: params.tenantId, from: params.date, to: params.date });
  return map.get(params.date.toISOString().slice(0, 10)) ?? null;
}
