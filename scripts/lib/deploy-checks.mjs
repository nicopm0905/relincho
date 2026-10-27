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

/** true si la salida de `prisma migrate status` lista migraciones sin aplicar. */
export function migrationsPending(statusOutput) {
  return /not yet been applied/i.test(statusOutput);
}
