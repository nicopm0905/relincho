import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TRIAL_DAYS,
  TRIAL_PLAN,
  accessState,
  describeTrialValue,
  isTrialEnding,
  trialDaysLeft,
  trialEndFrom,
} from "@/lib/trial";

const now = new Date("2026-10-01T10:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 24 * 3600 * 1000);

test("la prueba dura 21 días y se hace en Rendimiento", () => {
  assert.equal(TRIAL_DAYS, 21);
  assert.equal(TRIAL_PLAN, "rendimiento");
  assert.equal(trialEndFrom(now).getTime(), inDays(21).getTime());
});

test("alta nueva: Rendimiento completo con los días que quedan", () => {
  const s = accessState({ plan: "cuaderno", stripeStatus: null, trialEndsAt: inDays(21) }, now);
  assert.equal(s.kind, "TRIAL");
  assert.equal(s.effectivePlan, "rendimiento");
  assert.equal(s.readOnly, false);
  assert.equal(s.daysLeft, 21);
  assert.equal(isTrialEnding(s), false);
});

test("últimos 5 días: aviso de fin de prueba", () => {
  const s = accessState({ plan: "cuaderno", stripeStatus: null, trialEndsAt: inDays(4.5) }, now);
  assert.equal(s.daysLeft, 5);
  assert.equal(isTrialEnding(s), true);
});

test("prueba terminada sin pagar: modo lectura, sin borrar nada", () => {
  const s = accessState({ plan: "cuaderno", stripeStatus: null, trialEndsAt: inDays(-1) }, now);
  assert.equal(s.kind, "TRIAL_ENDED");
  assert.equal(s.readOnly, true);
  assert.equal(s.daysLeft, 0);
});

test("con suscripción viva (también fundador en periodo gratis o impago reciente) no hay bloqueo", () => {
  for (const status of ["active", "trialing", "past_due"]) {
    const s = accessState({ plan: "cuadra", stripeStatus: status, trialEndsAt: inDays(-30) }, now);
    assert.equal(s.kind, "SUBSCRIBED");
    assert.equal(s.effectivePlan, "cuadra");
    assert.equal(s.readOnly, false);
  }
});

test("pagó y canceló después de la prueba: modo lectura", () => {
  const s = accessState({ plan: "cuaderno", stripeStatus: "canceled", trialEndsAt: inDays(-60) }, now);
  assert.equal(s.kind, "TRIAL_ENDED");
  assert.equal(s.readOnly, true);
});

test("yeguadas de antes de la prueba: se respetan", () => {
  const s = accessState({ plan: "starter", stripeStatus: null, trialEndsAt: null }, now);
  assert.equal(s.kind, "LEGACY");
  assert.equal(s.readOnly, false);
  assert.equal(s.effectivePlan, "cuaderno");
});

test("días que quedan: redondeo hacia arriba y nunca negativo", () => {
  assert.equal(trialDaysLeft(inDays(0.1), now), 1);
  assert.equal(trialDaysLeft(inDays(-3), now), 0);
});

test("resumen de lo construido en la prueba", () => {
  assert.equal(
    describeTrialValue({ horses: 14, healthEvents: 1, trainingSessions: 41, limbChecks: 0 }),
    "14 caballos, 1 registro de sanidad y 41 sesiones de trabajo",
  );
  assert.equal(describeTrialValue({ horses: 0, healthEvents: 0, trainingSessions: 0, limbChecks: 0 }), null);
  assert.equal(describeTrialValue({ horses: 1, healthEvents: 0, trainingSessions: 0, limbChecks: 0 }), "1 caballo");
});
