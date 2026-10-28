import { test } from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_CHECKS,
  checksVerdict,
  migrationsVerdict,
  productionDbUrl,
} from "../scripts/lib/deploy-checks.mjs";

const ok = (name: string) => ({ name, status: "completed", conclusion: "success" });

test("los checks requeridos para desplegar coinciden con los del ruleset", () => {
  assert.deepEqual(REQUIRED_CHECKS, ["Types, tests and accessibility", "Integration (Postgres)"]);
});

test("checksVerdict acepta un commit con todos los checks requeridos en verde", () => {
  assert.equal(checksVerdict([ok("Types, tests and accessibility"), ok("Integration (Postgres)"), ok("Vercel")]), null);
});

test("checksVerdict rechaza si falta un check requerido", () => {
  assert.match(checksVerdict([ok("Vercel")]) ?? "", /falta el check "Types, tests and accessibility"/);
});

test("checksVerdict rechaza un check en curso o fallido", () => {
  const running = { name: "Types, tests and accessibility", status: "in_progress", conclusion: null };
  assert.match(checksVerdict([running]) ?? "", /in_progress/);
  const failed = { name: "Types, tests and accessibility", status: "completed", conclusion: "failure" };
  assert.match(checksVerdict([failed]) ?? "", /failure/);
});

test("checksVerdict ignora checks no requeridos aunque fallen (la preview de Vercel)", () => {
  const vercel = { name: "Vercel", status: "completed", conclusion: "failure" };
  assert.equal(checksVerdict([ok("Types, tests and accessibility"), ok("Integration (Postgres)"), vercel]), null);
});

test("migrationsVerdict solo da por buena la BD si migrate status dice up to date", () => {
  assert.deepEqual(migrationsVerdict("Database schema is up to date!"), { state: "ok" });
});

test("migrationsVerdict marca pendientes las migraciones sin aplicar (se despliegan solo revisadas)", () => {
  const out = ["Following migration have not yet been applied:", "20261201120000_roles"].join("\n");
  assert.deepEqual(migrationsVerdict(out), { state: "pending" });
});

test("migrationsVerdict se niega con una migración fallida aunque además haya pendientes (P3009)", () => {
  const out = [
    "Following migration have failed:",
    "20261201120000_roles",
    "Following migration have not yet been applied:",
    "20261202120000_avisos",
    "Error: P3009",
  ].join("\n");
  assert.equal(migrationsVerdict(out).state, "error");
});

test("migrationsVerdict se niega si no hay conexión o la salida es inesperada", () => {
  assert.equal(migrationsVerdict("Error: P1001: Can't reach database server").state, "error");
  assert.equal(migrationsVerdict("").state, "error");
});

test("productionDbUrl toma DIRECT_URL de .env.production.local, no del .env local", () => {
  const prod = "postgresql://u:p@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";
  assert.deepEqual(productionDbUrl({ DIRECT_URL: prod }), { url: prod });
});

test("productionDbUrl se niega si falta el fichero o si apunta a una BD local", () => {
  const errorOf = (r: ReturnType<typeof productionDbUrl>) => ("error" in r ? r.error : "");
  assert.match(errorOf(productionDbUrl(null)), /\.env\.production\.local/);
  assert.match(errorOf(productionDbUrl({})), /DIRECT_URL/);
  const local = productionDbUrl({ DIRECT_URL: "postgresql://postgres:postgres@localhost:54329/relincho_dev" });
  assert.match(errorOf(local), /local/);
});
