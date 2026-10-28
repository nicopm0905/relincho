// Copia de producción en SOLO LECTURA (roadmap §1.7, pasos 1 y 2).
//
//   node scripts/db/prod-snapshot.mjs [carpeta]     (por defecto ~/relincho-backups)
//   Lee DIRECT_URL de .env.production.local.
//
// Usa Docker (imagen postgres:17) para no depender de psql/pg_dump locales y
// genera, fuera del repo (contiene datos personales):
//   prod-<fecha>.dump              copia completa del esquema public (pg_restore)
//   prod-schema-<fecha>.sql        solo esquema de public, sin _prisma_migrations
//   prod-meta-<fecha>.txt          versión, roles de Supabase y migraciones aplicadas
// No escribe nada en la base de datos. Nunca imprime la URL de conexión.
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

// Producción vive en .env.production.local (sin versionar); el .env normal
// apunta a la BD local de desarrollo (AGENTS.md §7).
config({ path: ".env.production.local", quiet: true });
const url = process.env.DIRECT_URL;
if (!url) {
  console.error("prod-snapshot: falta DIRECT_URL en .env.production.local");
  process.exit(1);
}
if (/@(localhost|127\.0\.0\.1):/.test(url)) {
  console.error("prod-snapshot: DIRECT_URL apunta a una BD local, no a producción.");
  process.exit(1);
}

const outDir = path.resolve(process.argv[2] ?? path.join(homedir(), "relincho-backups"));
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const IMAGE = "postgres:17";

/** Ejecuta un comando dentro del contenedor con la carpeta montada en /out. */
function inDocker(cmd, { capture = false } = {}) {
  const r = spawnSync(
    "docker",
    ["run", "--rm", "-e", "PGURL", "-v", `${outDir}:/out`, IMAGE, "sh", "-c", cmd],
    { env: { ...process.env, PGURL: url }, encoding: "utf8", stdio: capture ? "pipe" : "inherit" },
  );
  if (r.status !== 0) {
    console.error(`prod-snapshot: falló: ${cmd.split(" ")[0]}\n${r.stderr ?? ""}`);
    process.exit(1);
  }
  return r.stdout ?? "";
}

const meta = inDocker(
  `psql "$PGURL" -At -c "select version()" ` +
    `-c "select 'roles: ' || string_agg(rolname, ',' order by rolname) from pg_roles where rolname in ('anon','authenticated','service_role','supabase_admin','authenticator','supabase_auth_admin','supabase_storage_admin')" ` +
    `-c "select 'migracion: ' || migration_name from _prisma_migrations where finished_at is not null order by migration_name"`,
  { capture: true },
);
const metaFile = path.join(outDir, `prod-meta-${stamp}.txt`);
writeFileSync(metaFile, meta);

const dumpFile = `prod-${stamp}.dump`;
inDocker(`pg_dump "$PGURL" --schema=public --format=custom --no-owner --file=/out/${dumpFile}`);

const schemaFile = `prod-schema-${stamp}.sql`;
inDocker(
  `pg_dump "$PGURL" --schema=public --schema-only --no-owner ` +
    `--exclude-table=public._prisma_migrations --file=/out/${schemaFile}`,
);

const size = (f) => `${(statSync(path.join(outDir, f)).size / 1024).toFixed(0)} KB`;
console.log(`prod-snapshot: OK en ${outDir}`);
console.log(`  ${dumpFile}  ${size(dumpFile)}  (copia completa de public)`);
console.log(`  ${schemaFile}  ${size(schemaFile)}`);
console.log(`  ${path.basename(metaFile)}`);
console.log(meta.split("\n").slice(0, 2).join("\n"));
