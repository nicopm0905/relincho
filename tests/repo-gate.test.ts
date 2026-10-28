import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isFrozen } from "../scripts/lib/freeze.mjs";

/**
 * El gate es la garantía de "nada se sube en rojo" (roadmap §1.4). Estos tests
 * impiden que se desmonte sin querer: el hook, los scripts y el CI tienen que
 * seguir ejecutando lo mismo.
 */
const read = (path: string) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

test("el hook pre-push existe, empieza por #!/bin/sh, usa LF y llama a npm run gate", () => {
  const hook = read(".githooks/pre-push");
  assert.ok(hook.startsWith("#!/bin/sh\n"), "debe empezar por #!/bin/sh");
  assert.ok(!hook.includes("\r"), "debe usar LF: sh en Windows falla con CRLF");
  assert.match(hook, /npm run (--silent )?gate/);
});

test("package.json define gate con tipos, lint y tests y prepare activa .githooks", () => {
  const gate = pkg.scripts.gate ?? "";
  for (const step of ["check:types", "lint", "check:tests"]) {
    assert.match(gate, new RegExp(`npm run ${step}(\\s|$)`), `gate debe ejecutar ${step}`);
  }
  assert.match(pkg.scripts.prepare ?? "", /setup-hooks/);
  assert.match(read("scripts/setup-hooks.mjs"), /core\.hooksPath["',\s]+\.githooks/);
});

test("el lint tiene trinquete de avisos: --max-warnings no puede desaparecer", () => {
  assert.match(pkg.scripts.lint ?? "", /--max-warnings=\d+/);
});

test("el workflow de CI ejecuta npm run gate, el mismo comando que el hook", () => {
  const ci = read(".github/workflows/quality-gate.yml");
  assert.match(ci, /run: npm run gate\b/);
  // El ruleset de GitHub exige este nombre exacto: renombrarlo bloquea todas las PR.
  assert.match(ci, /name: Types, tests and accessibility\n/);
});

test("isFrozen devuelve true el 17 nov 2026 y false el 24 nov 2026 en hora de Madrid", () => {
  assert.equal(isFrozen(new Date("2026-11-17T12:00:00Z"))?.why, "SICAB 2026");
  assert.equal(isFrozen(new Date("2026-11-24T12:00:00Z")), null);
  // 23 nov a las 23:30 en Madrid sigue congelado aunque en UTC sean las 22:30.
  assert.ok(isFrozen(new Date("2026-11-23T22:30:00Z")));
  // 24 nov a las 00:30 en Madrid ya no, aunque en UTC aún sea día 23.
  assert.equal(isFrozen(new Date("2026-11-23T23:30:00Z")), null);
});
