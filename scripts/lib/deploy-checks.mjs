/**
 * Reglas puras del guardián de despliegue (scripts/deploy-guard.mjs).
 * Se prueban en tests/deploy-guard.test.ts.
 */

/**
 * Checks de GitHub que tienen que estar en verde en el commit que se despliega.
 * Son los mismos que exige el ruleset de master y develop. "Integration
 * (Postgres)" llega con #32: hasta que esté en master, el guardián se niega.
 */
export const REQUIRED_CHECKS = ["Types, tests and accessibility", "Integration (Postgres)"];

/**
 * `null` si todos los checks requeridos han terminado en verde; si no, el
 * motivo. Los checks no requeridos (p. ej. la preview de Vercel) no cuentan.
 *
 * @param {{ name: string, status: string, conclusion: string | null }[]} runs
 */
export function checksVerdict(runs, required = REQUIRED_CHECKS) {
  for (const name of required) {
    const run = runs.find((r) => r.name === name);
    if (!run) return `falta el check "${name}"`;
    if (run.status !== "completed" || run.conclusion !== "success") {
      return `"${name}": ${run.status}/${run.conclusion ?? "-"}`;
    }
  }
  return null;
}

/**
 * Veredicto sobre la salida de `prisma migrate status` contra producción. Solo
 * hay dos salidas buenas:
 *  - "ok": la BD está al día;
 *  - "pending": hay migraciones sin aplicar y nada más (se despliegan solo con
 *    el SQL revisado, `DEPLOY_MIGRATIONS_OK=1`).
 * Cualquier otra cosa (migración fallida P3009, sin conexión P1001, salida
 * vacía o inesperada) es "error" y el guardián se niega siempre.
 *
 * @param {string} statusOutput
 * @returns {{ state: "ok" | "pending" } | { state: "error", detail: string }}
 */
export function migrationsVerdict(statusOutput) {
  const out = statusOutput ?? "";
  if (/have failed|P3009|P3018|Error:/i.test(out)) {
    return { state: "error", detail: "migrate status informa de un error o de una migración fallida" };
  }
  if (/Database schema is up to date/i.test(out)) return { state: "ok" };
  if (/not yet been applied/i.test(out)) return { state: "pending" };
  return { state: "error", detail: "salida inesperada de migrate status" };
}

/**
 * URL de la BD de producción para `prisma migrate status`. Sale de
 * `.env.production.local` (ya parseado; `null` si no existe), nunca del `.env`,
 * que apunta a la BD local de desarrollo (AGENTS.md §7).
 *
 * @param {Record<string, string> | null} prodEnv
 * @returns {{ url: string } | { error: string }}
 */
export function productionDbUrl(prodEnv) {
  if (!prodEnv) return { error: "falta .env.production.local con la BD de producción." };
  const url = prodEnv.DIRECT_URL;
  if (!url) return { error: "falta DIRECT_URL en .env.production.local." };
  if (/@(localhost|127\.0\.0\.1):/.test(url)) {
    return { error: "DIRECT_URL de .env.production.local apunta a una BD local, no a producción." };
  }
  return { url };
}
