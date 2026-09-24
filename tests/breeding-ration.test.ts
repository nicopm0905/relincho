import { test } from "node:test";
import assert from "node:assert/strict";
import { breedingRation, estimatedWeightKg, stageFor } from "../src/lib/breeding-ration";

const NOW = new Date(2026, 8, 24);
const monthsAgo = (m: number) => new Date(NOW.getTime() - m * 30.44 * 86_400_000);

test("la etapa de la yegua sale de la reproducción, sin configurar nada", () => {
  const adult = monthsAgo(120);
  const base = { sex: "FEMALE", birthDate: adult, weightKg: 520, now: NOW };
  assert.equal(stageFor({ ...base, mare: { pregnant: true, coveringDate: monthsAgo(3), lastFoalingDate: null } }).stage, "EARLY_GESTATION");
  assert.equal(stageFor({ ...base, mare: { pregnant: true, coveringDate: monthsAgo(9), lastFoalingDate: null } }).stage, "LATE_GESTATION");
  assert.equal(stageFor({ ...base, mare: { pregnant: false, coveringDate: null, lastFoalingDate: monthsAgo(1) } }).stage, "EARLY_LACTATION");
  assert.equal(stageFor({ ...base, mare: { pregnant: false, coveringDate: null, lastFoalingDate: monthsAgo(4) } }).stage, "LATE_LACTATION");
  assert.equal(stageFor({ ...base, mare: { pregnant: false, coveringDate: null, lastFoalingDate: monthsAgo(9) } }).stage, "MAINTENANCE");
});

test("preñada y recién parida a la vez: manda la lactación (la potra mama ahora)", () => {
  const r = stageFor({
    sex: "FEMALE",
    birthDate: monthsAgo(120),
    weightKg: 520,
    now: NOW,
    mare: { pregnant: true, coveringDate: monthsAgo(1), lastFoalingDate: monthsAgo(2) },
  });
  assert.equal(r.stage, "EARLY_LACTATION");
});

test("los potros van por edad", () => {
  assert.equal(stageFor({ sex: "MALE", birthDate: monthsAgo(3), weightKg: null, now: NOW }).stage, "NURSING_FOAL");
  assert.equal(stageFor({ sex: "MALE", birthDate: monthsAgo(8), weightKg: null, now: NOW }).stage, "WEANLING");
  assert.equal(stageFor({ sex: "FEMALE", birthDate: monthsAgo(15), weightKg: null, now: NOW }).stage, "YEARLING");
});

test("números con sentido: yegua de 500 kg en lactación temprana", () => {
  const r = breedingRation({
    sex: "FEMALE",
    birthDate: monthsAgo(120),
    weightKg: 500,
    now: NOW,
    mare: { pregnant: false, coveringDate: null, lastFoalingDate: monthsAgo(1) },
  });
  assert.deepEqual(r.dryMatterKg, [12.5, 15]); // 2,5-3 % del peso vivo
  assert.deepEqual(r.concentrateKg, [5, 7.5]);
  assert.ok(r.forageKg[0] >= 6, `forraje mínimo ${r.forageKg[0]}`); // nunca por debajo del 1,2 %
  assert.equal(r.proteinPct, 13);
});

test("sin peso registrado se estima por edad y se avisa", () => {
  const r = breedingRation({ sex: "MALE", birthDate: monthsAgo(6), weightKg: null, now: NOW });
  assert.equal(r.weightEstimated, true);
  assert.equal(r.weightKg, estimatedWeightKg(6.0));
  assert.ok(r.weightKg > 200 && r.weightKg < 260, `${r.weightKg} kg`);
});

test("potro lactante: el pienso de iniciación crece con la edad", () => {
  const young = breedingRation({ sex: "MALE", birthDate: monthsAgo(1), weightKg: null, now: NOW });
  const older = breedingRation({ sex: "MALE", birthDate: monthsAgo(5), weightKg: null, now: NOW });
  assert.equal(young.concentrateKg[1], 0);
  assert.ok(older.concentrateKg[1] > 1.5 && older.concentrateKg[1] <= 2, `${older.concentrateKg[1]}`);
});
