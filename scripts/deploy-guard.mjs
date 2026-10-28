// Guardián de `npm run deploy` (roadmap §1.4, cerrojo 3). Se niega a desplegar
// a producción salvo que todo esté en orden. Las reglas puras viven en
// scripts/lib/ y tienen tests; aquí solo se recogen los datos.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { isFrozen } from "./lib/freeze.mjs";
import { checksVerdict, migrationsPending, productionDbUrl } from "./lib/deploy-checks.mjs";

const sh = (cmd, env = process.env) =>
  execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env }).trim();
const fail = (msg) => {
  console.error(`deploy-guard: ${msg}`);
  process.exit(1);
};

// 1. Ventanas congeladas. Un hotfix necesita el OK de los dos socios.
const freeze = isFrozen();
if (freeze && process.env.DEPLOY_HOTFIX !== "1") {
  fail(`congelado por ${freeze.why} (${freeze.from} a ${freeze.to}). Hotfix: DEPLOY_HOTFIX=1.`);
}

// 2. Solo master, limpio e idéntico a origin/master.
if (sh("git rev-parse --abbrev-ref HEAD") !== "master") fail("despliega desde master.");
if (sh("git status --porcelain --untracked-files=no")) fail("hay cambios sin commitear.");
sh("git fetch origin master --quiet");
const head = sh("git rev-parse HEAD");
if (head !== sh("git rev-parse origin/master")) fail("HEAD no coincide con origin/master.");

// 3. Checks de GitHub en verde para ESTE commit.
let runs;
try {
  runs = JSON.parse(
    sh(`gh api repos/{owner}/{repo}/commits/${head}/check-runs --jq "[.check_runs[] | {name, status, conclusion}]"`),
  );
} catch {
  fail("no se pudieron leer los checks de GitHub (¿`gh auth login`?).");
}
const verdict = checksVerdict(runs);
if (verdict) fail(`${verdict} en ${head.slice(0, 7)}.`);

// 4. El build de Vercel aplica las migraciones pendientes en producción:
//    hay que haber revisado su SQL antes. Se consulta la BD de PRODUCCIÓN
//    (.env.production.local), no la local del .env.
const prodFile = ".env.production.local";
const prod = productionDbUrl(existsSync(prodFile) ? parse(readFileSync(prodFile)) : null);
if ("error" in prod) fail(prod.error);
let status = "";
try {
  // prisma.config.ts lee DIRECT_URL; dotenv no pisa una variable ya definida.
  status = sh("npx prisma migrate status", { ...process.env, DIRECT_URL: prod.url });
} catch (e) {
  status = `${e.stdout ?? ""}${e.stderr ?? ""}`;
}
if (migrationsPending(status) && process.env.DEPLOY_MIGRATIONS_OK !== "1") {
  fail("hay migraciones pendientes. Revisa el SQL y relanza con DEPLOY_MIGRATIONS_OK=1.");
}

console.log(`deploy-guard: OK ${head.slice(0, 7)}. Desplegando.`);
