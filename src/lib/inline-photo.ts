/**
 * Foto del caballo guardada DENTRO de la base de datos (provisional).
 *
 * Mientras no haya bucket de R2 configurado en producción, la foto se reduce
 * en el navegador a un JPEG pequeño y se guarda como `data:image/jpeg;base64,…`
 * en `Horse.photoUrl`. No hace falta migración ni variables nuevas, y
 * `next/image` y el PDF de la ficha la leen igual que una URL. Cuando se
 * configure R2, las fotos nuevas pasan a R2 solas y estas siguen valiendo.
 * Motor puro: lo usan el formulario, el router y los tests.
 */

/** Tope de la foto en línea (base64 incluido): unos 90 KB. */
export const INLINE_PHOTO_MAX_CHARS = 120_000;

/** Lados y calidades que se prueban, de mayor a menor, hasta que quepa. */
export const INLINE_PHOTO_ATTEMPTS = [
  { maxSide: 480, quality: 0.7 },
  { maxSide: 360, quality: 0.6 },
  { maxSide: 256, quality: 0.5 },
] as const;

const PREFIX = "data:image/jpeg;base64,";
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function isInlinePhoto(value: string): boolean {
  if (!value.startsWith(PREFIX) || value.length >= INLINE_PHOTO_MAX_CHARS) return false;
  const body = value.slice(PREFIX.length);
  return body.length > 0 && BASE64.test(body);
}

/**
 * Lo que se admite al guardar `Horse.photoUrl`: una URL https (R2), una ruta
 * de la app (subida local de desarrollo) o una foto en línea válida. Cualquier
 * otro `data:` o esquema se rechaza.
 */
export function isValidStoredPhotoUrl(value: string): boolean {
  if (value.startsWith("data:")) return isInlinePhoto(value);
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
