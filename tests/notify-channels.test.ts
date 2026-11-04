import { test } from "node:test";
import assert from "node:assert/strict";

import { deliverAt, planChannels, shouldDropSubscription } from "@/lib/notify-channels";

test("con suscripción push y preferencias por defecto, un vencimiento va solo por push", () => {
  assert.deepEqual(planChannels({ kind: "HEALTH_DUE", urgent: false, hasPush: true }), ["PUSH"]);
});

test("sin suscripción push, el aviso cae a email", () => {
  assert.deepEqual(planChannels({ kind: "HEALTH_DUE", urgent: false, hasPush: false }), ["EMAIL"]);
});

test("una incidencia grave va por push y por email a la vez", () => {
  assert.deepEqual(planChannels({ kind: "INCIDENT", urgent: true, hasPush: true }), ["PUSH", "EMAIL"]);
  // Sin push, la grave sigue llegando por email.
  assert.deepEqual(planChannels({ kind: "INCIDENT", urgent: true, hasPush: false }), ["EMAIL"]);
});

test("si el usuario desactiva el email de comunicados, no recibe email aunque no tenga push", () => {
  const preference = { push: true, email: false };
  assert.deepEqual(planChannels({ kind: "ANNOUNCEMENT", urgent: false, hasPush: false, preference }), []);
  // Las preferencias de un tipo no tocan los demás.
  assert.deepEqual(planChannels({ kind: "HEALTH_DUE", urgent: false, hasPush: false }), ["EMAIL"]);
});

test("en horas de silencio (22:00–07:00 de Madrid) un aviso no urgente se aplaza a las 07:00, también el día del cambio de hora", () => {
  // Invierno (UTC+1): 23:30 del 9 de diciembre → 07:00 del 10 = 06:00Z.
  assert.equal(deliverAt({ now: new Date("2026-12-09T22:30:00Z"), urgent: false }).toISOString(), "2026-12-10T06:00:00.000Z");
  // De madrugada: 03:00 → 07:00 del mismo día.
  assert.equal(deliverAt({ now: new Date("2026-12-10T02:00:00Z"), urgent: false }).toISOString(), "2026-12-10T06:00:00.000Z");
  // Fuera de silencio sale ya; urgente sale ya siempre.
  const day = new Date("2026-12-10T10:00:00Z");
  assert.equal(deliverAt({ now: day, urgent: false }).getTime(), day.getTime());
  const night = new Date("2026-12-09T22:30:00Z");
  assert.equal(deliverAt({ now: night, urgent: true }).getTime(), night.getTime());
  // Cambio a horario de verano (28 mar 2027, 02:00 → 03:00): 23:00 del 27 (UTC+1) → 07:00 del 28 (UTC+2) = 05:00Z.
  assert.equal(deliverAt({ now: new Date("2027-03-27T22:00:00Z"), urgent: false }).toISOString(), "2027-03-28T05:00:00.000Z");
  // Cambio a horario de invierno (31 oct 2027, 03:00 → 02:00): 22:30 del 30 (UTC+2) → 07:00 del 31 (UTC+1) = 06:00Z.
  assert.equal(deliverAt({ now: new Date("2027-10-30T20:30:00Z"), urgent: false }).toISOString(), "2027-10-31T06:00:00.000Z");
});

test("una suscripción que responde 404 o 410 se marca para borrar", () => {
  assert.equal(shouldDropSubscription(404), true);
  assert.equal(shouldDropSubscription(410), true);
  for (const code of [201, 400, 413, 429, 500, 503]) assert.equal(shouldDropSubscription(code), false, String(code));
});
