import { test } from "node:test";
import assert from "node:assert/strict";

import { portalHome, type PortalHomeInput } from "@/lib/portal-home";

const now = new Date("2026-12-10T09:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
const lucero = { id: "h-lucero", name: "Lucero" };

const base = (over: Partial<PortalHomeInput> = {}): PortalHomeInput => ({
  now,
  horses: [lucero],
  incidents: [],
  invoices: [],
  health: [],
  ...over,
});

test("la portada ordena: incidencias sin confirmar, facturas vencidas y luego vencimientos", () => {
  const home = portalHome(
    base({
      incidents: [
        { id: "inc-leve", horseId: lucero.id, category: "EQUIPMENT", severity: "LOW", occurredAt: day(-1), acknowledgedByMe: false },
        { id: "inc-grave", horseId: lucero.id, category: "LAMENESS", severity: "HIGH", occurredAt: day(-2), acknowledgedByMe: false },
        { id: "inc-vista", horseId: lucero.id, category: "OTHER", severity: "HIGH", occurredAt: day(0), acknowledgedByMe: true },
      ],
      invoices: [
        { id: "f-pendiente", number: "2026-0042", status: "ISSUED", dueDate: day(10), pending: 450 },
        { id: "f-vencida", number: "2026-0031", status: "OVERDUE", dueDate: day(-5), pending: 450 },
        { id: "f-pagada", number: "2026-0020", status: "PAID", dueDate: day(-40), pending: 0 },
      ],
      health: [
        { id: "vacuna", type: "VACCINE", name: "Gripe", date: day(-358), nextDueDate: day(7), horse: lucero },
        { id: "herraje", type: "FARRIER", name: "Herraje", date: day(-40), nextDueDate: day(2), horse: lucero },
      ],
    }),
  );
  assert.deepEqual(
    home.items.map((i) => [i.kind, i.id]),
    [
      ["INCIDENT", "inc-grave"],
      ["INCIDENT", "inc-leve"],
      ["INVOICE_OVERDUE", "f-vencida"],
      ["HEALTH_DUE", "herraje"],
      ["HEALTH_DUE", "vacuna"],
    ],
  );
  assert.deepEqual(home.pendingInvoices.map((f) => f.id), ["f-pendiente"]);
  assert.deepEqual(home.lastFarrier, [{ horseId: lucero.id, horseName: "Lucero", date: day(-40) }]);
  assert.equal(home.emptyState, null);
});

test("sin caballos, la portada muestra el estado vacío de alumno y no el de propietario", () => {
  const alumno = portalHome(base({ horses: [] }));
  assert.equal(alumno.audience, "STUDENT");
  assert.equal(alumno.emptyState, "STUDENT_NO_HORSE");
  assert.deepEqual(alumno.lastFarrier, []);

  const propietarioSinNovedades = portalHome(base());
  assert.equal(propietarioSinNovedades.audience, "OWNER");
  assert.equal(propietarioSinNovedades.emptyState, "OWNER_ALL_CLEAR");
});

test("un vencimiento ya pasado aparece primero entre los vencimientos y uno lejano no aparece", () => {
  const home = portalHome(
    base({
      health: [
        { id: "pronto", type: "DEWORMING", name: "Desparasitación", date: day(-80), nextDueDate: day(3), horse: lucero },
        { id: "vencido", type: "VACCINE", name: "Tétanos", date: day(-400), nextDueDate: day(-2), horse: lucero },
        { id: "lejano", type: "DENTAL", name: "Dentista", date: day(-200), nextDueDate: day(90), horse: lucero },
      ],
    }),
  );
  assert.deepEqual(home.items.map((i) => i.id), ["vencido", "pronto"]);
});
