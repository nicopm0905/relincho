import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import {
  BASELINE,
  enumValuesUsedInSameMigration,
  tablesWithoutRls,
} from "../scripts/lib/migration-rules.mjs";

/** Migraciones reales, en orden, con su SQL. */
const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .map((name) => ({ name, sql: readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8") }));

test("la migración base es la primera y las 15 antiguas están archivadas", () => {
  assert.equal(migrations[0]?.name, BASELINE);
  assert.equal(readdirSync("prisma/migrations-archivo").length, 15);
});

test("tablesWithoutRls detecta una tabla nueva sin ENABLE ROW LEVEL SECURITY", () => {
  const sql = `CREATE TABLE "Lesson" ("id" TEXT NOT NULL);\nCREATE TABLE "Arena" ("id" TEXT NOT NULL);\nALTER TABLE "Arena" ENABLE ROW LEVEL SECURITY;`;
  assert.deepEqual(tablesWithoutRls(sql), ["Lesson"]);
});

test("tablesWithoutRls acepta nombres con esquema y comillas", () => {
  const sql = `CREATE TABLE public."Lesson" (id text);\nALTER TABLE public."Lesson" ENABLE ROW LEVEL SECURITY;`;
  assert.deepEqual(tablesWithoutRls(sql), []);
});

test("toda migración posterior a la base que crea una tabla activa RLS en esa tabla", () => {
  for (const m of migrations.filter((m) => m.name !== BASELINE)) {
    assert.deepEqual(tablesWithoutRls(m.sql), [], `${m.name}: tablas sin RLS`);
  }
});

test("enumValuesUsedInSameMigration detecta un valor añadido y usado en la misma migración", () => {
  const sql = `ALTER TYPE "Role" ADD VALUE 'PROFESSIONAL';\nUPDATE "Membership" SET "role" = 'PROFESSIONAL' WHERE "role" = 'VET_EXTERNAL';`;
  assert.deepEqual(enumValuesUsedInSameMigration(sql), ["Role.PROFESSIONAL"]);
  assert.deepEqual(enumValuesUsedInSameMigration(`ALTER TYPE "Role" ADD VALUE 'RIDER';`), []);
});

test("ninguna migración usa un valor de enum en la misma migración que lo añade", () => {
  for (const m of migrations) {
    assert.deepEqual(enumValuesUsedInSameMigration(m.sql), [], m.name);
  }
});
