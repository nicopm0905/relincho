import type { NotificationKind } from "@/lib/notify-channels";

/**
 * Payload de un aviso push (E4). Viaja cifrado, pero por el servicio push del
 * navegador (Google, Apple, Mozilla) y se ve en la pantalla de bloqueo: no
 * lleva nombres de caballos ni datos clínicos. Solo un título genérico por
 * tipo y la URL de la app, donde el usuario ya ve el detalle con su sesión.
 */
export const MAX_PUSH_BYTES = 4096;
const MAX_URL_CHARS = 1024;

const GENERIC_TITLE: Record<NotificationKind, string> = {
  HEALTH_DUE: "Tienes un recordatorio sanitario",
  INCIDENT: "Hay una incidencia con tu caballo",
  INCIDENT_ESCALATION: "Una incidencia espera tu confirmación",
  ANNOUNCEMENT: "Tienes un comunicado nuevo",
  VISIT: "Hay una visita registrada",
  BOOKING: "Hay novedades en tus reservas",
  INVOICE: "Tienes una factura nueva",
  STOCK: "Hay un aviso de stock",
};

/** Solo rutas de la app ("/…"), sin dominio ni "//" y de largo razonable. */
function safeUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.length > MAX_URL_CHARS) return "/";
  return url;
}

export function buildPushPayload(n: {
  kind: NotificationKind;
  /** Texto de la Notification: no viaja, se recibe solo para dejarlo claro. */
  title: string;
  body: string;
  url: string | null;
}): string {
  return JSON.stringify({ title: GENERIC_TITLE[n.kind], url: safeUrl(n.url) });
}
