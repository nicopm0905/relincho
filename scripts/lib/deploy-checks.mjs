/**
 * Reglas puras del guardián de despliegue (scripts/deploy-guard.mjs).
 * Se prueban en tests/deploy-guard.test.ts.
 */

/**
 * Checks de GitHub que tienen que estar en verde en el commit que se despliega.
 * Son los mismos que exige el ruleset de master y develop. Al añadir el job de
 * integración (S0-0.4) se suma aquí "Integration (Postgres)" y en el ruleset.
 */
export const REQUIRED_CHECKS = ["Types, tests and accessibility"];

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

export function migrationsVerdict() {
  throw new Error("no implementado");
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
