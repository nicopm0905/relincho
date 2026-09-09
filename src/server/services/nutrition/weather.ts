import "server-only";

/**
 * Temperatura maxima prevista para el dia, usada como disparador de electrolitos.
 * Fuente: Open-Meteo (sin clave de API). Si falla, devuelve null y el motor de
 * nutricion sigue funcionando solo con el reporte de sudoracion del jinete.
 */

const DEFAULT_LAT = 36.6866; // Jerez de la Frontera
const DEFAULT_LON = -6.1367;

export async function getMaxTempC(params?: {
  latitude?: number;
  longitude?: number;
  date?: Date;
}): Promise<number | null> {
  const lat = params?.latitude ?? DEFAULT_LAT;
  const lon = params?.longitude ?? DEFAULT_LON;
  const day = (params?.date ?? new Date()).toISOString().slice(0, 10);

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max&timezone=Europe%2FMadrid&start_date=${day}&end_date=${day}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: { temperature_2m_max?: (number | null)[] };
    };
    const value = json.daily?.temperature_2m_max?.[0];
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Temperaturas maximas de un rango de dias en una sola llamada, para no
 * castigar la API cuando se proyecta la dieta de toda una semana.
 * Devuelve un mapa YYYY-MM-DD -> grados. Si falla, devuelve el mapa vacio.
 */
export async function getMaxTempRange(params: {
  from: Date;
  to: Date;
  latitude?: number;
  longitude?: number;
}): Promise<Map<string, number>> {
  const lat = params.latitude ?? DEFAULT_LAT;
  const lon = params.longitude ?? DEFAULT_LON;
  const start = params.from.toISOString().slice(0, 10);
  const end = params.to.toISOString().slice(0, 10);

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max&timezone=Europe%2FMadrid&start_date=${start}&end_date=${end}`;

  const result = new Map<string, number>();
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return result;
    const json = (await res.json()) as {
      daily?: { time?: string[]; temperature_2m_max?: (number | null)[] };
    };
    const days = json.daily?.time ?? [];
    const temps = json.daily?.temperature_2m_max ?? [];
    days.forEach((day, index) => {
      const value = temps[index];
      if (typeof value === "number") result.set(day, value);
    });
    return result;
  } catch {
    return result;
  }
}
