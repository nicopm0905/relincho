import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAction, pipelineStage } from "../src/lib/repro-board";
import type { ReproAction } from "../src/lib/repro-engine";

const action = (kind: ReproAction["kind"], from: string, overdue = false): ReproAction => ({
  kind,
  label: kind,
  from: new Date(from),
  to: new Date(from),
  overdue,
});

test("cada fase del motor cae en uno de los cinco pasos", () => {
  assert.equal(pipelineStage("UNTRACKED"), "empty");
  assert.equal(pipelineStage("DIESTRUS"), "heat");
  assert.equal(pipelineStage("FOALING_SOON"), "pregnant");
  assert.equal(pipelineStage("POSTPARTUM"), "foaled");
});

test("lo vencido va antes que lo próximo y los hitos no abren diálogo", () => {
  const next = nextAction("PREGNANT", [
    action("milestone", "2026-10-01", true),
    action("pregnancy_check", "2026-10-20"),
    action("pregnancy_check", "2026-10-10", true),
  ]);
  assert.equal(next?.action, "eco");
  assert.equal(next?.window?.overdue, true);
});

test("sin nada pendiente: explorar, salvo una gestante", () => {
  assert.equal(nextAction("UNTRACKED", [])?.action, "exploracion");
  assert.equal(nextAction("PREGNANT", []), null);
  assert.equal(nextAction("FOALING_SOON", [])?.action, "vigilancia");
  assert.equal(nextAction("IN_HEAT", [action("breed", "2026-10-13")])?.action, "cubricion");
});
