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
