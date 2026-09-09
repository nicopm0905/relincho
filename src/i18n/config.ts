/**
 * Configuración de idiomas compartida. Sin dependencias de Next para que la
 * puedan importar tanto `request.ts` como las server actions y los componentes.
 * El locale vive en la cookie NEXT_LOCALE, no en el segmento de URL.
 */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}
