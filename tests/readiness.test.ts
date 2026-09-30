import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assessReadiness,
  computeWorkload,
  isAllClear,
  legsWithFindings,
  monotonyOf,
  zoneForRatio,
  type LimbCheckData,
} from "@/lib/readiness";

const utc = (iso: string) => new Date(`${iso}T10:00:00Z`);
const today = utc("2026-10-01");
const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 3600 * 1000);

const clear = (date = today): LimbCheckData => ({
  date,
  heatLegs: [],
  swellingLegs: [],
  painLegs: [],
  lameness: "NO",
});

test("chequeo limpio: apto", () => {
  const r = assessReadiness({ today: clear() });
  assert.equal(r.level, "VERDE");
  assert.deepEqual(r.reasons, []);
  assert.ok(isAllClear(clear()));
});

test("sin chequeo no hay verde, aunque la carga esté bien", () => {
  const r = assessReadiness({
    today: null,
    workload: { ratio: 1, zone: "OPTIMA", monotony: 1.2 },
  });
  assert.equal(r.level, "SIN_CHEQUEO");
});

test("cojera, dolor o calor + hinchazón en la misma pata: rojo", () => {
  assert.equal(assessReadiness({ today: { ...clear(), lameness: "SI" } }).level, "ROJO");
  assert.equal(assessReadiness({ today: { ...clear(), painLegs: ["MI"] } }).level, "ROJO");
  const both = assessReadiness({
    today: { ...clear(), heatLegs: ["MD"], swellingLegs: ["MD"] },
  });
  assert.equal(both.level, "ROJO");
  assert.match(both.reasons[0], /mano derecha/);
});

test("calor solo, hinchazón sola o movimiento dudoso: ámbar", () => {
  assert.equal(assessReadiness({ today: { ...clear(), heatLegs: ["MI"] } }).level, "AMBAR");
  assert.equal(assessReadiness({ today: { ...clear(), swellingLegs: ["PD"] } }).level, "AMBAR");
  assert.equal(assessReadiness({ today: { ...clear(), lameness: "DUDOSA" } }).level, "AMBAR");
  // Calor en una pata e hinchazón en otra: dos ámbar, no rojo.
  assert.equal(
    assessReadiness({ today: { ...clear(), heatLegs: ["MI"], swellingLegs: ["MD"] } }).level,
    "AMBAR",
  );
});

test("mismo hallazgo en la misma pata dos días seguidos: rojo", () => {
  const r = assessReadiness({
    today: { ...clear(), heatLegs: ["MI"] },
    yesterday: { ...clear(daysAgo(1)), swellingLegs: ["MI"] },
  });
  assert.equal(r.level, "ROJO");
  assert.match(r.reasons.join(" "), /Segundo día seguido/);
  // En otra pata no cuenta como repetición.
  assert.equal(
    assessReadiness({
      today: { ...clear(), heatLegs: ["MI"] },
      yesterday: { ...clear(daysAgo(1)), heatLegs: ["PD"] },
    }).level,
    "AMBAR",
  );
});

test("pico de carga pone ámbar; nunca rojo por sí solo", () => {
  const r = assessReadiness({
    today: clear(),
    workload: { ratio: 1.8, zone: "PICO", monotony: 1 },
  });
  assert.equal(r.level, "AMBAR");
  assert.match(r.reasons[0], /1,8 veces/);
});

test("subida rápida solo avisa si hay historial de tendón", () => {
  const workload = { ratio: 1.4, zone: "SUBIENDO" as const, monotony: 1 };
  assert.equal(assessReadiness({ today: clear(), workload }).level, "VERDE");
  assert.equal(
    assessReadiness({ today: clear(), workload, tendonHistory: true }).level,
    "AMBAR",
  );
});

test("la monotonía se explica pero no cambia el color", () => {
  const r = assessReadiness({
    today: clear(),
    workload: { ratio: 1, zone: "OPTIMA", monotony: 2.6 },
  });
  assert.equal(r.level, "VERDE");
  assert.equal(r.notes.length, 1);
});

test("patas con hallazgos, en orden manos → pies", () => {
  assert.deepEqual(
    legsWithFindings({ ...clear(), painLegs: ["PD"], heatLegs: ["MI"], swellingLegs: ["MI"] }),
    ["MI", "PD"],
  );
});

test("carga aguda (7 días) y crónica (media semanal de 28)", () => {
  // 4 semanas a 1.200 UA/semana (3 sesiones de 400) y esta semana igual.
  const sessions = [];
  for (let d = 0; d < 28; d++) {
    if (d % 7 === 0 || d % 7 === 2 || d % 7 === 4) {
      sessions.push({ date: daysAgo(d), loadUa: 400 });
    }
  }
  const w = computeWorkload(sessions, today);
  assert.equal(w.acuteUa, 1200);
  assert.equal(w.chronicWeeklyUa, 1200);
  assert.equal(w.ratio, 1);
  assert.equal(w.zone, "OPTIMA");
  assert.equal(w.daily.length, 28);
  assert.equal(w.daily[27].loadUa, 400); // hoy es el último
});

test("pico de carga: esta semana el doble que las anteriores", () => {
  const sessions = [];
  for (let d = 7; d < 28; d += 2) sessions.push({ date: daysAgo(d), loadUa: 200 });
  for (let d = 0; d < 7; d++) sessions.push({ date: daysAgo(d), loadUa: 300 });
  const w = computeWorkload(sessions, today);
  assert.equal(w.zone, "PICO");
  assert.ok((w.ratio ?? 0) > 1.5);
});

test("con menos de 21 días de historial, calibrando", () => {
  const w = computeWorkload(
    [
      { date: daysAgo(10), loadUa: 300 },
      { date: daysAgo(3), loadUa: 300 },
    ],
    today,
  );
  assert.equal(w.zone, "CALIBRANDO");
  assert.equal(w.ratio, null);
  assert.equal(w.historyDays, 11);
});

test("sesiones fuera de la ventana de 28 días no cuentan; varias el mismo día se suman", () => {
  const w = computeWorkload(
    [
      { date: daysAgo(40), loadUa: 999 },
      { date: daysAgo(0), loadUa: 100 },
      { date: daysAgo(0), loadUa: 150 },
    ],
    today,
  );
  assert.equal(w.acuteUa, 250);
  assert.equal(w.historyDays, 1);
});

test("zonas del ratio y monotonía de Foster", () => {
  assert.equal(zoneForRatio(0.6), "BAJA");
  assert.equal(zoneForRatio(1.3), "OPTIMA");
  assert.equal(zoneForRatio(1.45), "SUBIENDO");
  assert.equal(zoneForRatio(1.6), "PICO");
  assert.equal(monotonyOf([0, 0, 0]), null);
  assert.equal(monotonyOf([300, 300, 300]), null);
  // Semana con dos días de descanso: monotonía moderada.
  const m = monotonyOf([300, 300, 0, 300, 300, 0, 300]) ?? 0;
  assert.ok(m > 1 && m < 2);
});
