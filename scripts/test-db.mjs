// Base de datos local para tests de integración y desarrollo (S0-0.4).
//
//   node scripts/test-db.mjs up      arranca el contenedor Docker "relincho-db"
//                                    (Postgres 17, puerto 54329) con las BD
//                                    relincho_test y relincho_dev, y migra la de dev
//   node scripts/test-db.mjs reset   vacía la BD de TEST_DATABASE_URL y aplica las
//                                    migraciones reales desde cero
//   node scripts/test-db.mjs test    ejecuta tests/integration/*.int.test.ts
//   node scripts/test-db.mjs e2e-reset  crea si falta la BD de E2E_DATABASE_URL
//                                    (por defecto relincho_e2e) y la migra desde cero
//
// Se niega a tocar cualquier BD que no sea local: producción vive en Supabase.
import { spawnSync } from "node:child_process";
import pg from "pg";

const PORT = 54329;
const CONTAINER = "relincho-db";
const IMAGE = "postgres:17"; // producción es 17.6
const LOCAL = (db) => `postgresql://postgres:postgres@localhost:${PORT}/${db}`;

const fail = (msg) => {
  console.error(`test-db: ${msg}`);
  process.exit(1);
};

/** Corta si la URL no es de una BD local. */
export function assertLocal(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    fail("URL de BD no válida.");
  }
  if (!["localhost", "127.0.0.1"].includes(host) || /supabase/i.test(url)) {
    fail(`"${host}" no es una BD local. Me niego a usarla.`);
  }
}

const run = (cmd, env = process.env) => {
  const r = spawnSync(cmd, { shell: true, stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

/** Ejecuta SQL con `pg` (sin depender de psql). */
async function sql(url, statements) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const s of statements) await client.query(s);
  } finally {
    await client.end();
  }
}

/**
 * Roles que Supabase trae de serie y que la migración base menciona en sus
 * GRANT. En un Postgres normal no existen. Son globales al servidor.
 */
const SUPABASE_ROLES = [
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
   END $$;`,
];

/** Vacía `public` y aplica las migraciones reales (no `db push`: se prueban ellas). */
async function reset(url) {
  assertLocal(url);
  await sql(url, [
    ...SUPABASE_ROLES,
    "DROP SCHEMA IF EXISTS public CASCADE",
    "CREATE SCHEMA public",
  ]);
  run("npx prisma migrate deploy", { ...process.env, DATABASE_URL: url, DIRECT_URL: url });
}

async function up() {
  const exists = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], {
    encoding: "utf8",
  });
  if (exists.status !== 0) {
    run(`docker run -d --name ${CONTAINER} -e POSTGRES_PASSWORD=postgres -p ${PORT}:5432 ${IMAGE}`);
  } else if (exists.stdout.trim() !== "true") {
    run(`docker start ${CONTAINER}`);
  }
  // Espera a que acepte conexiones.
  for (let i = 0; ; i++) {
    try {
      await sql(LOCAL("postgres"), ["SELECT 1"]);
      break;
    } catch {
      if (i > 30) fail("Postgres no arranca en el contenedor.");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const client = new pg.Client({ connectionString: LOCAL("postgres") });
  await client.connect();
  for (const db of ["relincho_test", "relincho_dev", "relincho_e2e"]) {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
    if (!rowCount) await client.query(`CREATE DATABASE ${db}`);
  }
  await client.end();
  await sql(LOCAL("relincho_dev"), SUPABASE_ROLES);
  run("npx prisma migrate deploy", {
    ...process.env,
    DATABASE_URL: LOCAL("relincho_dev"),
    DIRECT_URL: LOCAL("relincho_dev"),
  });
  console.log(`\ntest-db: listo.
  Tests:       TEST_DATABASE_URL=${LOCAL("relincho_test")}
  Desarrollo:  DATABASE_URL y DIRECT_URL=${LOCAL("relincho_dev")}  (en tu .env; ver AGENTS.md §7)`);
}

/**
 * BD del E2E (Playwright): la crea en el mismo servidor si no existe y la deja
 * migrada desde cero. Es aparte de relincho_test para que los dos no se pisen.
 */
async function resetE2e(url) {
  assertLocal(url);
  const target = new URL(url);
  const db = target.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(db)) fail(`nombre de BD no válido: "${db}".`);
  target.pathname = "/postgres";
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
    if (!rowCount) await client.query(`CREATE DATABASE ${db}`);
  } finally {
    await client.end();
  }
  await reset(url);
}

const mode = process.argv[2];
if (mode === "up") {
  await up();
} else if (mode === "e2e-reset") {
  await resetE2e(process.env.E2E_DATABASE_URL || LOCAL("relincho_e2e"));
} else if (mode === "reset" || mode === "test") {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) fail(`define TEST_DATABASE_URL (local: ${LOCAL("relincho_test")}). Arráncala con "npm run db:local".`);
  assertLocal(url);
  if (mode === "reset") {
    await reset(url);
  } else {
    // prisma.config.ts lee DIRECT_URL y src/server/db/prisma.ts DATABASE_URL:
    // los dos apuntan a la BD de tests (dotenv no pisa variables ya definidas).
    run('npx tsx --conditions=react-server --test "tests/integration/*.int.test.ts"', {
      ...process.env,
      DATABASE_URL: url,
      DIRECT_URL: url,
      NODE_ENV: "test",
    });
  }
} else {
  fail("uso: node scripts/test-db.mjs up|reset|test|e2e-reset");
}
