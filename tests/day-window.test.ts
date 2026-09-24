import { test } from "node:test";
import assert from "node:assert/strict";
import { dayWindowUtc } from "../src/lib/day-window";

test("la ventana es un día natural completo, sea cual sea la hora del cron", () => {
  for (const hour of ["06:00", "08:00", "21:30"]) {
    const { start, end } = dayWindowUtc(7, new Date(`2026-09-24T${hour}:00Z`));
    assert.equal(start.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-10-02T00:00:00.000Z");
  }
});

test("usa la fecha de España: a las 23:30 UTC ya es el día siguiente en Madrid", () => {
  const { start } = dayWindowUtc(0, new Date("2026-09-24T23:30:00Z"));
  assert.equal(start.toISOString(), "2026-09-25T00:00:00.000Z");
});

test("cubre tanto fechas a medianoche UTC como a mediodía local", () => {
  const { start, end } = dayWindowUtc(0, new Date("2026-03-10T08:00:00Z"));
  for (const due of ["2026-03-10T00:00:00Z", "2026-03-10T11:00:00Z"]) {
    const t = new Date(due).getTime();
    assert.ok(t >= start.getTime() && t < end.getTime(), due);
  }
});
