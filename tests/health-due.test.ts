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

test("una vacuna no tapa el vencimiento de otra vacuna distinta del mismo caballo", () => {
  const events = [
    { id: "nilo", type: "VACCINE", name: "Nilo", date: "2026-04-10", nextDueDate: "2027-04-10", horse },
    { id: "gripe", type: "VACCINE", name: "Gripe y tétanos", date: "2026-10-08", nextDueDate: "2027-10-08", horse },
  ];
  // El Nilo vence dentro de ~6 meses; la gripe, dentro de casi un año.
  const due = pendingHealthDue(events, { withinDays: 200, now });
  assert.deepEqual(due.map((d) => d.event.id), ["nilo"]);
});

test("una revacunación del mismo nombre sustituye a la anterior aunque cambie la grafía", () => {
  const events = [
    { id: "old", type: "VACCINE", name: "Gripe y tétanos", date: "2025-10-08", nextDueDate: "2026-10-08", horse },
    { id: "new", type: "VACCINE", name: "  GRIPE y  Tetanos ", date: "2026-10-08", nextDueDate: "2027-10-08", horse },
  ];
  assert.deepEqual(pendingHealthDue(events, { withinDays: 7, now }), []);
});

test("en desparasitación un producto distinto sigue cubriendo al anterior", () => {
  const events = [
    { id: "pirantel", type: "DEWORMING", name: "Pirantel", date: "2026-07-10", nextDueDate: "2026-10-07", horse },
    { id: "ivermectina", type: "DEWORMING", name: "Ivermectina", date: "2026-10-05", nextDueDate: "2027-01-03", horse },
  ];
  assert.deepEqual(pendingHealthDue(events, { withinDays: 7, now }), []);
});
