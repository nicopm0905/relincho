import { test } from "node:test";
import assert from "node:assert/strict";
import { coveringResult, gestation, mareState, nextCheckpoint } from "../src/lib/reproduction";

test("gemelos cuenta como preñada, no como vacía", () => {
  const covering = { pregnancyChecks: [{ date: "2026-04-01", result: "TWINS" }] };
  assert.equal(mareState(covering), "TWINS");
});

test("manda la última ecografía por fecha, no la última en darse de alta", () => {
  const checks = [
    { date: "2026-04-20", result: "POSITIVE" },
    { date: "2026-04-05", result: "NEGATIVE" }, // eco atrasada metida después
  ];
  assert.equal(coveringResult(checks), "POSITIVE");
});

test("reabsorción y aborto son pérdida, sin ecos es cubierta y con parto es parida", () => {
  assert.equal(mareState({ pregnancyChecks: [{ date: "2026-05-01", result: "REABSORBED" }] }), "LOST");
  assert.equal(mareState({ pregnancyChecks: [{ date: "2026-05-01", result: "ABORTION" }] }), "LOST");
  assert.equal(mareState({ pregnancyChecks: [] }), "COVERED");
  assert.equal(mareState({ foaling: {}, pregnancyChecks: [] }), "FOALED");
  assert.equal(mareState(null), "EMPTY");
});

test("la fecha probable de parto es a 340 días con ventana ±10 y rango normal 320-365", () => {
  const g = gestation(new Date(2026, 2, 1), new Date(2026, 2, 11));
  assert.equal(g.days, 10);
  assert.equal(g.expected.toDateString(), new Date(2027, 1, 4).toDateString());
  // Ventana probable ±10 dias sobre la media; rango normal 320-365.
  assert.equal(g.windowFrom.toDateString(), new Date(2027, 0, 25).toDateString());
  assert.equal(g.windowTo.toDateString(), new Date(2027, 1, 14).toDateString());
  assert.equal(g.normalFrom.toDateString(), new Date(2027, 0, 15).toDateString());
  assert.equal(g.prolonged, false);
});

test("la gestación usa la media propia de la yegua si se da", () => {
  const g = gestation(new Date(2026, 2, 1), new Date(2026, 2, 11), { gestationDays: 350 });
  assert.equal(g.expected.toDateString(), new Date(2027, 1, 14).toDateString());
});

test("la siguiente eco depende de las hechas y avisa cuando va tarde", () => {
  const covered = new Date(2026, 3, 1);
  const first = nextCheckpoint(covered, 0, new Date(2026, 3, 10))!;
  assert.equal(first.key, "detection");
  assert.equal(first.overdue, false);
  assert.equal(nextCheckpoint(covered, 0, new Date(2026, 3, 25))!.overdue, true);
  assert.equal(nextCheckpoint(covered, 1, new Date(2026, 3, 20))!.key, "heartbeat");
  assert.equal(nextCheckpoint(covered, 3), null);
});
