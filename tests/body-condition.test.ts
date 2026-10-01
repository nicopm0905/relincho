import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ageInMonths,
  assessCondition,
  conditionTarget,
  dewormerDoseWeight,
  formulaDivisor,
  weightFromMeasurements,
  weightTrend,
} from "@/lib/body-condition";

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

test("peso por medidas (Carroll y Huntington): adulto, potro de un año y destete", () => {
  // 190 cm de perímetro y 165 de longitud, adulto:
  // (74,8 in)² × 65 in / 330 = 1102 lb = 500 kg.
  assert.equal(weightFromMeasurements(190, 165), 500);
  assert.equal(formulaDivisor(null), 330);
  assert.equal(formulaDivisor(18), 301);
  assert.equal(formulaDivisor(7), 280);
  // El mismo tamaño pesa más con el divisor de potro (más denso a igual medida).
  assert.ok(weightFromMeasurements(150, 120, 8) > weightFromMeasurements(150, 120, 60));
});

test("objetivo de condición según el caballo", () => {
  assert.deepEqual(
    [conditionTarget({ sex: "FEMALE", ageYears: 9, broodmare: true }).ideal],
    [6],
  );
  assert.equal(conditionTarget({ sex: "MALE", ageYears: 12, breedingStallion: true }).ideal, 6);
  assert.equal(conditionTarget({ sex: "GELDING", ageYears: 8, discipline: "RAID" }).max, 5);
  assert.equal(conditionTarget({ sex: "GELDING", ageYears: 8, discipline: "SALTO" }).ideal, 5);
  assert.equal(conditionTarget({ sex: "MALE", ageYears: 1 }).max, 6);
  assert.equal(conditionTarget({ sex: "GELDING", ageYears: 24 }).ideal, 5.5);
});

test("valoración de la condición", () => {
  const sport = conditionTarget({ sex: "GELDING", ageYears: 8, discipline: "SALTO" });
  assert.equal(assessCondition(5, sport).status, "OK");
  assert.equal(assessCondition(3, sport).status, "MUY_BAJA");
  assert.equal(assessCondition(7, sport).status, "ALTA");
  assert.match(assessCondition(7, sport).text, /laminitis/);
  assert.equal(assessCondition(8, sport).status, "MUY_ALTA");
  const mare = conditionTarget({ sex: "FEMALE", ageYears: 9, broodmare: true });
  // Una yegua de cría con 4 está flaca para quedarse preñada.
  assert.equal(assessCondition(4, mare).status, "BAJA");
  assert.equal(assessCondition(7, mare).status, "OK");
});

test("tendencia: solo con el mismo método y en torno a un mes", () => {
  const trend = weightTrend([
    { date: d("2026-08-01"), weightKg: 540, method: "CINTA" },
    { date: d("2026-08-20"), weightKg: 560, method: "BASCULA" },
    { date: d("2026-09-01"), weightKg: 535, method: "CINTA" },
    { date: d("2026-10-01"), weightKg: 505, method: "CINTA" },
  ]);
  assert.ok(trend);
  // Compara con el de cinta del 1 de septiembre (30 días), no con la báscula.
  assert.equal(trend!.fromKg, 535);
  assert.equal(trend!.days, 30);
  assert.equal(trend!.changeKg, -30);
  assert.equal(trend!.changePct, -5.6);
  assert.equal(trend!.alert, "PIERDE");

  // Sin pesaje comparable, no hay tendencia (mejor nada que una falsa).
  assert.equal(
    weightTrend([
      { date: d("2026-09-01"), weightKg: 535, method: "BASCULA" },
      { date: d("2026-10-01"), weightKg: 505, method: "CINTA" },
    ]),
    null,
  );
  // Pocos kilos: sin aviso.
  assert.equal(
    weightTrend([
      { date: d("2026-09-01"), weightKg: 500, method: "CINTA" },
      { date: d("2026-10-01"), weightKg: 510, method: "CINTA" },
    ])!.alert,
    null,
  );
});

test("dosis de desparasitante: su peso redondeado hacia arriba", () => {
  assert.equal(dewormerDoseWeight(520), 550);
  assert.equal(dewormerDoseWeight(550), 550);
  assert.equal(dewormerDoseWeight(551), 600);
});

test("edad en meses", () => {
  assert.equal(ageInMonths(d("2026-03-10"), d("2026-10-01")), 6);
  assert.equal(ageInMonths(d("2025-10-02"), d("2026-10-01")), 11);
  assert.equal(ageInMonths(null), null);
});
