/**
 * Por dónde y cuándo sale un aviso (roadmap §4 E4). Motor puro: el servicio
 * de notificaciones le pregunta y él decide, sin BD ni red.
 *
 * - Push es el canal principal; el email es el respaldo si no hay push.
 * - Lo urgente (una incidencia grave, un escalado) va por los dos a la vez.
 * - Cada usuario puede apagar push o email por tipo de aviso
 *   (`NotificationPreference`); sin fila, los dos encendidos.
 * - Entre las 22:00 y las 07:00 de Madrid, lo no urgente espera a las 07:00.
 */

export type NotificationKind =
  | "HEALTH_DUE"
  | "INCIDENT"
  | "INCIDENT_ESCALATION"
  | "ANNOUNCEMENT"
  | "VISIT"
  | "BOOKING"
  | "INVOICE"
  | "STOCK";

export type Channel = "PUSH" | "EMAIL";

export interface ChannelPreference {
  push: boolean;
  email: boolean;
}

export const DEFAULT_PREFERENCE: ChannelPreference = { push: true, email: true };

export function planChannels(o: {
  kind: NotificationKind;
  urgent: boolean;
  hasPush: boolean;
  /** La del usuario para este tipo; sin ella, la de por defecto. */
  preference?: ChannelPreference;
}): Channel[] {
  const pref = o.preference ?? DEFAULT_PREFERENCE;
  const push = o.hasPush && pref.push;
  const email = pref.email && (o.urgent || !push);
  return [...(push ? (["PUSH"] as const) : []), ...(email ? (["EMAIL"] as const) : [])];
}

const TIME_ZONE = "Europe/Madrid";
export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 7;

/** Hora, fecha y desfase (ms) de Madrid en ese instante. */
function madrid(at: Date): { y: number; m: number; d: number; hour: number; offsetMs: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return { y: parts.year, m: parts.month, d: parts.day, hour: parts.hour, offsetMs: asUtc - (at.getTime() - at.getMilliseconds()) };
}

/** El instante en que en Madrid son las `hour`:00 de ese día (y, m, d), con el desfase de ese día. */
function madridWallTime(y: number, m: number, d: number, hour: number): Date {
  const guess = Date.UTC(y, m - 1, d, hour);
  // El desfase del propio instante buscado: tras un cambio de hora no es el de ahora.
  const first = guess - madrid(new Date(guess)).offsetMs;
  return new Date(guess - madrid(new Date(first)).offsetMs);
}

/** Cuándo enviar: ya, o a las 07:00 de Madrid si es de noche y no es urgente. */
export function deliverAt({ now, urgent }: { now: Date; urgent: boolean }): Date {
  if (urgent) return now;
  const { y, m, d, hour } = madrid(now);
  if (hour >= QUIET_UNTIL_HOUR && hour < QUIET_FROM_HOUR) return now;
  if (hour < QUIET_UNTIL_HOUR) return madridWallTime(y, m, d, QUIET_UNTIL_HOUR);
  // Después de las 22:00: las 07:00 del día siguiente (mediodía UTC + 1 día evita líos de desfase).
  const next = new Date(Date.UTC(y, m - 1, d, 12) + 86_400_000);
  return madridWallTime(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), QUIET_UNTIL_HOUR);
}

/** El servicio push dice que la suscripción ya no existe: hay que borrarla. */
export function shouldDropSubscription(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410;
}
