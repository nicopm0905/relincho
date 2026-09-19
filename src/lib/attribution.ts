/**
 * De dónde vino cada yeguada.
 *
 * Se apunta el **primer toque**: quien escanea el QR de un flyer en una feria y
 * se da de alta tres semanas después sigue contando como flyer. Sin esto, la
 * decisión de dónde gastar el próximo dinero en imprenta se toma a ciegas.
 *
 * No es una herramienta de analítica: es un dato por yeguada que se lee con
 * `npm run db:studio` o con una consulta a `Tenant.acquisitionSource`.
 */
export const ATTRIBUTION_SOURCE_COOKIE = "relincho_src";
export const ATTRIBUTION_REFERRER_COOKIE = "relincho_ref";

/** 90 días: cubre de sobra el tiempo entre ver el flyer y decidirse. */
export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const MAX_SOURCE_LENGTH = 40;

/**
 * Convierte `?src=Carta Jerez!!` en `carta-jerez`. Devuelve null cuando no
 * queda nada usable, para no guardar basura ni valores arbitrariamente largos.
 *
 * Todo lo que no sea letra o número se convierte en un único guion: así
 * `carta___jerez`, `carta--jerez` y `carta jerez` acaban siendo la misma marca
 * y agrupar por canal en la base de datos no da sorpresas.
 */
export function normalizeSource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SOURCE_LENGTH);
  return clean.length >= 2 ? clean : null;
}

/** Solo el dominio del referrer: una URL entera no aporta nada más. */
export function referrerHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "").slice(0, 100) || null;
  } catch {
    return null;
  }
}
