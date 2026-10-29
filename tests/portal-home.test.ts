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
  trainings: [],
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

test("la portada incluye la actividad de los últimos 7 días y los entrenamientos programados de los próximos 7", () => {
  const home = portalHome(
    base({
      trainings: [
        { id: "t-ayer", horseId: lucero.id, date: day(-1), minutes: 45, type: "Doma", notes: "Nota interna del entrenador" },
        { id: "t-viejo", horseId: lucero.id, date: day(-9), minutes: 30, type: "Doma", notes: null },
        { id: "t-lejano", horseId: lucero.id, date: day(10), minutes: 40, type: "Salto", notes: null },
        { id: "t-pasado-manana", horseId: lucero.id, date: day(2), minutes: 50, type: "Salto", notes: null },
        { id: "t-manana", horseId: lucero.id, date: day(1), minutes: 30, type: "Cuerda", notes: "Otra nota interna" },
      ],
      health: [
        { id: "herraje", type: "FARRIER", name: "Herraje", date: day(-2), nextDueDate: day(40), horse: lucero },
        { id: "vacuna-futura", type: "VACCINE", name: "Gripe", date: day(3), nextDueDate: null, horse: lucero },
      ],
    }),
  );

  // Siete días, de hoy hacia atrás en hora de Madrid.
  assert.equal(home.activity.length, 7);
  assert.equal(home.activity[0]?.day, "2026-12-10");
  assert.equal(home.activity[6]?.day, "2026-12-04");
  const done = home.activity.flatMap((d) => d.items);
  assert.deepEqual(done.map((i) => i.id), ["t-ayer", "herraje"]);
  assert.deepEqual(
    { horseName: done[0]?.horseName, kind: done[0]?.kind, durationMin: done[0]?.durationMin },
    { horseName: "Lucero", kind: "RIDDEN", durationMin: 45 },
  );

  // Programados: los de los próximos 7 días, del más próximo al más lejano.
  assert.deepEqual(home.scheduledTrainings.map((t) => t.id), ["t-manana", "t-pasado-manana"]);
  assert.deepEqual(
    { horseName: home.scheduledTrainings[0]?.horseName, minutes: home.scheduledTrainings[0]?.minutes },
    { horseName: "Lucero", minutes: 30 },
  );

  // Vista de propietario: las notas del entrenador no salen en ninguna parte.
  assert.doesNotMatch(JSON.stringify(home), /nota interna/i);
});

test("un día sin registros dice \"Sin actividad registrada\" y no inventa nada", () => {
  const vacia = portalHome(base());
  assert.equal(vacia.activity.length, 7);
  for (const d of vacia.activity) {
    assert.deepEqual(d.items, []);
    // El motor solo marca el día vacío: "Sin actividad registrada" sale de messages (portal.home).
    assert.equal(d.empty, true);
  }
  assert.deepEqual(vacia.scheduledTrainings, []);

  const conAyer = portalHome(
    base({ trainings: [{ id: "t-ayer", horseId: lucero.id, date: day(-1), minutes: 45, type: "Doma", notes: null }] }),
  );
  assert.equal(conAyer.activity[0]?.empty, true);
  assert.equal(conAyer.activity[1]?.empty, false);
  assert.ok(conAyer.activity.every((d) => !("emptyLabel" in d)), "el motor no lleva textos en castellano");
  assert.deepEqual(conAyer.activity.flatMap((d) => d.items).map((i) => i.id), ["t-ayer"]);

  // El alumno no tiene caballo: ni siete días vacíos de "su caballo".
  assert.deepEqual(portalHome(base({ horses: [] })).activity, []);
});

test("un herraje registrado hoy cuenta en el último herraje y en la actividad de hoy aunque aún no sea mediodía", () => {
  // El formulario del profesional guarda la visita a mediodía (un día de
  // calendario). A las 10:00 de Madrid, la visita de esta mañana ya está hecha.
  const visitaDeHoy = new Date("2026-12-10T11:00:00Z"); // 12:00 en Madrid; `now` son las 10:00
  const home = portalHome(
    base({
      health: [
        { id: "herraje-hoy", type: "FARRIER", name: "Herraje", date: visitaDeHoy, nextDueDate: day(42), horse: lucero },
        { id: "vacuna-manana", type: "VACCINE", name: "Gripe", date: day(1), nextDueDate: null, horse: lucero },
      ],
    }),
  );

  assert.deepEqual(home.lastFarrier, [{ horseId: lucero.id, horseName: "Lucero", date: visitaDeHoy }]);
  assert.equal(home.activity[0]?.day, "2026-12-10");
  assert.deepEqual(home.activity[0]?.items.map((i) => i.id), ["herraje-hoy"]);
  // Lo de mañana sigue sin contar como hecho.
  assert.ok(home.activity.every((d) => d.items.every((i) => i.id !== "vacuna-manana")));
});
