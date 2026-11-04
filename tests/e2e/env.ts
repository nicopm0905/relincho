/**
 * Constantes del E2E que comparten `playwright.config.ts` (para arrancar la
 * app) y los specs (para sembrar la BD, firmar la sesión y llamar al cron).
 * Son valores de test, no secretos: solo valen contra la app que arranca
 * Playwright y la BD local `relincho_e2e`.
 */
export const E2E_PORT = Number(process.env.E2E_PORT || 3100);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** BD propia del E2E (`npm run db:e2e:reset`), en el contenedor relincho-db. */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL || "postgresql://postgres:postgres@localhost:54329/relincho_e2e";

export const E2E_AUTH_SECRET = "e2e-auth-secret-solo-para-tests-no-es-de-ningun-entorno";
export const E2E_CRON_SECRET = "e2e-cron-secret-solo-para-tests";

/** Cookie de sesión de Auth.js v5 en http (en https lleva el prefijo `__Secure-`). */
export const SESSION_COOKIE = "authjs.session-token";

/** Misma guardia que `scripts/test-db.mjs`: el E2E nunca toca una BD remota. */
export function assertLocalDatabase(url: string): void {
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1"].includes(host) || /supabase/i.test(url)) {
    throw new Error(`E2E: "${host}" no es una BD local. Me niego a usarla.`);
  }
}
