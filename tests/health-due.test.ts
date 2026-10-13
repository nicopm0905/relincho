import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingHealthDue } from "../src/lib/health-due";

const horse = { id: "h1", name: "Galante" };
const now = new Date("2026-10-13T10:00:00Z");

test("un acto renovado no cuenta como vencido", () => {
  const events = [
    { id: "old", type: "VACCINE", name: "Gripe", date: "2026-04-01", nextDueDate: "2026-10-01", horse },
    { id: "new", type: "VACCINE", name: "Gripe", date: "2026-09-25", nextDueDate: "2027-03-25", horse },
  ];
  assert.deepEqual(pendingHealthDue(events, { withinDays: 7, now }), []);
});

test("vencidos y próximos, ordenados por fecha", () => {
  const events = [
    { id: "a", type: "DEWORMING", name: "Ivermectina", date: "2026-07-10", nextDueDate: "2026-10-07", horse },
    { id: "b", type: "FARRIER", name: "Herraje", date: "2026-09-01", nextDueDate: "2026-10-15", horse },
    { id: "c", type: "DENTAL", name: "Limado", date: "2026-01-01", nextDueDate: "2026-12-01", horse },
    { id: "d", type: "INJURY", name: "Cojera", date: "2026-10-01", nextDueDate: null, horse },
  ];
  const due = pendingHealthDue(events, { withinDays: 7, now });
  assert.deepEqual(due.map((d) => [d.event.id, d.offset]), [["a", -6], ["b", 2]]);
});
