// Guardián de `npm run deploy` (roadmap §1.4, cerrojo 3). Se niega a desplegar
// a producción salvo que todo esté en orden. Las reglas puras viven en
// scripts/lib/ y tienen tests; aquí solo se recogen los datos.
import { execSync } from "node:child_process";
import { isFrozen } from "./lib/freeze.mjs";
import { checksVerdict, migrationsPending } from "./lib/deploy-checks.mjs";

const sh = (cmd) =>
  execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
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
//    hay que haber revisado su SQL antes.
let status = "";
try {
  status = sh("npx prisma migrate status");
} catch (e) {
  status = `${e.stdout ?? ""}${e.stderr ?? ""}`;
}
if (migrationsPending(status) && process.env.DEPLOY_MIGRATIONS_OK !== "1") {
  fail("hay migraciones pendientes. Revisa el SQL y relanza con DEPLOY_MIGRATIONS_OK=1.");
}

console.log(`deploy-guard: OK ${head.slice(0, 7)}. Desplegando.`);
