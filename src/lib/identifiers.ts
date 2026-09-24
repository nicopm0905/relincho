/**
 * Formatos oficiales de los identificadores del caballo y de la explotacion.
 * Se normalizan (sin espacios ni guiones, en mayusculas) antes de validar:
 * se teclean copiando del pasaporte o de la guia, con separadores.
 */

export function normalizeCode(value: string) {
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

/**
 * UELN (Universal Equine Life Number): 15 caracteres alfanumericos. Los tres
 * primeros son el pais (724 = España) y los tres siguientes la base de datos
 * que lo emitio.
 */
export function isValidUeln(value: string) {
  return /^[0-9A-Z]{15}$/.test(normalizeCode(value));
}

/** Microchip ISO 11784/11785 (FDX-B): 15 digitos. */
export function isValidMicrochip(value: string) {
  return /^\d{15}$/.test(normalizeCode(value));
}

/**
 * Codigo REGA de explotacion: "ES" + 12 digitos (provincia, municipio y
 * numero de explotacion).
 */
export function isValidRega(value: string) {
  return /^ES\d{12}$/.test(normalizeCode(value));
}
