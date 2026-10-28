import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FARRIER_WEEKS,
  planVisit,
  proposeNextVisit,
} from "@/lib/professional-visit";
import { healthTypesFor } from "@/lib/permissions";

const DAY = 24 * 60 * 60 * 1000;
const visit = new Date("2026-12-10T09:30:00Z");
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

test("el herraje propone la próxima cita a 6 semanas por defecto", () => {
  assert.equal(DEFAULT_FARRIER_WEEKS, 6);
  assert.equal(daysBetween(visit, proposeNextVisit({ visitDate: visit })), 42);
  assert.equal(daysBetween(visit, proposeNextVisit({ visitDate: visit, intervalWeeks: null })), 42);
});

test("si el caballo tiene un intervalo propio de 8 semanas, se usa ese", () => {
  assert.equal(daysBetween(visit, proposeNextVisit({ visitDate: visit, intervalWeeks: 8 })), 56);
});

test("una visita a 8 caballos genera 8 actos sanitarios con el mismo autor y fecha", () => {
  const horses = Array.from({ length: 8 }, (_, i) => ({ id: `h${i}`, farrierIntervalWeeks: null }));
  const events = planVisit({
    horses: [...horses, horses[0]!],
    type: "FARRIER",
    name: "Herraje",
    date: visit,
    authorMembershipId: "m-herrador",
  });

  assert.equal(events.length, 8);
  assert.deepEqual(
    events.map((e) => e.horseId),
    horses.map((h) => h.id),
  );
  for (const e of events) {
    assert.equal(e.authorMembershipId, "m-herrador");
    assert.equal(e.date.getTime(), visit.getTime());
    assert.equal(e.type, "FARRIER");
  }
});

test("la próxima fecha propuesta nunca es anterior a la visita", () => {
  for (const intervalWeeks of [0, -3, Number.NaN]) {
    const next = proposeNextVisit({ visitDate: visit, intervalWeeks });
    assert.ok(next.getTime() > visit.getTime(), String(intervalWeeks));
  }
  // Una fecha elegida a mano anterior a la visita se corrige a la propuesta.
  const [event] = planVisit({
    horses: [{ id: "h1", farrierIntervalWeeks: 8 }],
    type: "FARRIER",
    name: "Herraje",
    date: visit,
    nextDueDate: new Date("2026-11-01T00:00:00Z"),
    authorMembershipId: "m-herrador",
  });
  assert.equal(daysBetween(visit, event!.nextDueDate!), 56);
});

test("en un herraje cada caballo lleva su intervalo; otro tipo sin fecha no la inventa", () => {
  const farrier = planVisit({
    horses: [
      { id: "corto", farrierIntervalWeeks: 5 },
      { id: "normal", farrierIntervalWeeks: null },
    ],
    type: "FARRIER",
    name: "Herraje",
    date: visit,
    authorMembershipId: "m",
  });
  assert.deepEqual(
    farrier.map((e) => daysBetween(visit, e.nextDueDate!)),
    [35, 42],
  );

  const [dental] = planVisit({
    horses: [{ id: "h1", farrierIntervalWeeks: 5 }],
    type: "DENTAL",
    name: "Limado",
    date: visit,
    authorMembershipId: "m",
  });
  assert.equal(dental!.nextDueDate, null);
});

test("healthTypesFor da los actos que registra cada especialidad", () => {
  assert.deepEqual(healthTypesFor({ role: "PROFESSIONAL", specialty: "FARRIER" }), ["FARRIER"]);
  assert.deepEqual(healthTypesFor({ role: "PROFESSIONAL", specialty: null }), []);
  assert.deepEqual(healthTypesFor({ role: "OWNER_EXTERNAL" }), []);
  assert.ok(healthTypesFor({ role: "VET_EXTERNAL" }).includes("VACCINE"));
});
