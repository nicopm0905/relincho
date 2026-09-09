"use server";

import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Persiste el idioma elegido en la cookie que lee `src/i18n/request.ts`. */
export async function setLocale(next: string): Promise<Locale> {
  const locale = isLocale(next) ? next : DEFAULT_LOCALE;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  return locale;
}
