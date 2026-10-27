import { test } from "node:test";
import assert from "node:assert/strict";

import { REQUIRED_CHECKS, checksVerdict, migrationsPending } from "../scripts/lib/deploy-checks.mjs";

const ok = (name: string) => ({ name, status: "completed", conclusion: "success" });

test("los checks requeridos para desplegar coinciden con los del ruleset", () => {
  assert.deepEqual(REQUIRED_CHECKS, ["Types, tests and accessibility"]);
});

test("checksVerdict acepta un commit con todos los checks requeridos en verde", () => {
  assert.equal(checksVerdict([ok("Types, tests and accessibility"), ok("Vercel")]), null);
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
  assert.equal(checksVerdict([ok("Types, tests and accessibility"), vercel]), null);
});

test("migrationsPending detecta la salida de prisma migrate status con migraciones sin aplicar", () => {
  assert.equal(migrationsPending("Database schema is up to date!"), false);
  assert.equal(
    migrationsPending("Following migration have not yet been applied:\n20261105000000_base"),
    true,
  );
});
