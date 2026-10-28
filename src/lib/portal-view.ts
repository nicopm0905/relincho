/**
 * Lógica de presentación del portal del cliente (E8a-2). Pura: sin Next ni
 * next-intl, para que la navegación y las etiquetas se puedan probar solas.
 */

export type PortalSection = "home" | "invoices" | "documents";

/**
 * Sección de la navegación que corresponde a una ruta. La ficha de un caballo
 * cuelga de "Mi caballo"; lo que no es del portal de ese centro no marca nada.
 */
export function portalSection(pathname: string, tenantSlug: string): PortalSection | null {
  const base = `/${tenantSlug}/portal`;
  const path = pathname.replace(/\/+$/, "");
  if (path === base || path.startsWith(`${base}/caballos/`)) return "home";
  if (path === `${base}/facturas` || path.startsWith(`${base}/facturas/`)) return "invoices";
  if (path === `${base}/documentos` || path.startsWith(`${base}/documentos/`)) return "documents";
  return null;
}

/**
 * Etiqueta de un vencimiento a partir de los días de calendario que faltan
 * (`calendarDayOffset`, negativo si ya pasó). Devuelve la clave del mensaje y
 * los días en positivo para el plural.
 */
export function relativeDue(offset: number): { key: "overdue" | "today" | "tomorrow" | "inDays"; days: number } {
  if (offset < 0) return { key: "overdue", days: -offset };
  if (offset === 0) return { key: "today", days: 0 };
  if (offset === 1) return { key: "tomorrow", days: 1 };
  return { key: "inDays", days: offset };
}

/** Día `YYYY-MM-DD` desplazado `offset` días de calendario. */
function shiftIsoDay(day: string, offset: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

export type ActivityBlock<T> =
  | { kind: "day"; day: string; items: T[] }
  | { kind: "empty"; from: string; to: string };

/**
 * Junta los días sin actividad seguidos en un solo tramo, para que una semana
 * tranquila no ocupe media pantalla. Recibe los días como los da `feedByDay`
 * (de hoy hacia atrás) y respeta ese orden; `from` es el día más antiguo del
 * tramo y `to` el más reciente. Vive aquí y no en `horse-feed.ts` porque es
 * presentación del portal: el motor del feed sigue dando un día por fila.
 */
export function groupEmptyDays<T>(days: { day: string; items: T[] }[]): ActivityBlock<T>[] {
  const blocks: ActivityBlock<T>[] = [];
  for (const { day, items } of days) {
    const last = blocks.at(-1);
    if (items.length > 0) blocks.push({ kind: "day", day, items });
    else if (last?.kind === "empty") last.from = day;
    else blocks.push({ kind: "empty", from: day, to: day });
  }
  return blocks;
}

/** Cómo leer un tramo vacío respecto a `today`: hoy, ayer, un día suelto o un rango. */
export function emptyRunLabel(
  run: { from: string; to: string },
  today: string,
):
  | { key: "today" }
  | { key: "yesterday" }
  | { key: "day"; date: string }
  | { key: "range"; from: string; to: string; sameMonth: boolean } {
  if (run.from === run.to) {
    if (run.from === today) return { key: "today" };
    if (run.from === shiftIsoDay(today, -1)) return { key: "yesterday" };
    return { key: "day", date: run.from };
  }
  return { key: "range", from: run.from, to: run.to, sameMonth: run.from.slice(0, 7) === run.to.slice(0, 7) };
}

/** Minúsculas, sin acentos ni espacios sobrantes: "Desparasitación" = "desparasitacion". */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/**
 * Detalle de un vencimiento sanitario: caballo, tipo y fecha. Si el nombre del
 * acto ya es la etiqueta de su tipo, el tipo no se repite.
 */
export function healthDueDetail(horseName: string, name: string, typeLabel: string, dateLabel: string): string {
  const parts = normalize(name) === normalize(typeLabel) ? [horseName, dateLabel] : [horseName, typeLabel, dateLabel];
  return parts.join(" · ");
}
