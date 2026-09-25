import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RETENTION_YEARS,
  bookPeriod,
  bookPeriodOptions,
  describeMissing,
  isMedicinal,
  lastAdministrationDate,
  missingBookFields,
  retentionStart,
  withdrawalEndDate,
  withdrawalStatus,
} from "@/lib/treatments";

const day = (iso: string) => new Date(`${iso}T12:00:00`);
const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : null;

const identified = { uelnCode: "724015240123456", microchip: null };

test("solo vacunas, desparasitaciones y tratamientos van al libro", () => {
  assert.equal(isMedicinal("VACCINE"), true);
  assert.equal(isMedicinal("DEWORMING"), true);
  assert.equal(isMedicinal("TREATMENT"), true);
  assert.equal(isMedicinal("FARRIER"), false);
  assert.equal(isMedicinal("DENTAL"), false);
});

test("un tratamiento de 5 días que empieza el 1 termina el 5", () => {
  assert.equal(ymd(lastAdministrationDate({ date: day("2026-10-01"), durationDays: 5 })), "2026-10-05");
  assert.equal(ymd(lastAdministrationDate({ date: day("2026-10-01"), durationDays: null })), "2026-10-01");
});

test("el tiempo de espera cuenta desde la última administración", () => {
  const end = withdrawalEndDate({ date: day("2026-10-01"), durationDays: 5, withdrawalDays: 28 });
  assert.equal(ymd(end), "2026-11-02");
});

test("tiempo de espera 0: libre el mismo día de la última dosis", () => {
  const end = withdrawalEndDate({ date: day("2026-10-01"), durationDays: 1, withdrawalDays: 0 });
  assert.equal(ymd(end), "2026-10-01");
});

test("el cambio de hora de octubre no descuadra la fecha", () => {
  const end = withdrawalEndDate({ date: day("2026-10-20"), durationDays: 1, withdrawalDays: 10 });
  assert.equal(ymd(end), "2026-10-30");
});

test("sin tiempo de espera anotado no se inventa uno", () => {
  assert.equal(withdrawalEndDate({ date: day("2026-10-01"), withdrawalDays: null }), null);
});

test("estado del tiempo de espera", () => {
  const record = {
    type: "TREATMENT",
    name: "Fenilbutazona",
    date: day("2026-10-01"),
    durationDays: 5,
    withdrawalDays: 28,
  };
  assert.equal(withdrawalStatus(record, identified, day("2026-10-20")).status, "active");
  assert.equal(withdrawalStatus(record, identified, day("2026-11-02")).status, "finished");
  assert.equal(
    withdrawalStatus(record, { ...identified, excludedFromFoodChain: true }, day("2026-10-20")).status,
    "not_applicable",
  );
  assert.equal(
    withdrawalStatus({ ...record, withdrawalDays: null }, identified, day("2026-10-20")).status,
    "unknown",
  );
  assert.equal(
    withdrawalStatus({ ...record, type: "FARRIER" }, identified, day("2026-10-20")).status,
    "not_medicinal",
  );
});

test("un tratamiento sin datos marca todo lo que falta", () => {
  const missing = missingBookFields(
    { type: "TREATMENT", name: "Antibiótico", date: day("2026-10-01") },
    { uelnCode: null, microchip: null },
  );
  assert.deepEqual(missing, [
    "horseIdentity",
    "dose",
    "withdrawalDays",
    "durationDays",
    "supplier",
    "purchaseReference",
  ]);
});

test("tiempo de espera 0 cuenta como anotado", () => {
  const missing = missingBookFields(
    {
      type: "DEWORMING",
      name: "Ivermectina",
      date: day("2026-10-01"),
      dose: "1 jeringa",
      withdrawalDays: 0,
      durationDays: 1,
      supplier: "Farmacia Veterinaria Jerez",
      purchaseReference: "FV-2026-118",
    },
    identified,
  );
  assert.deepEqual(missing, []);
});

test("con nº de receta basta con identificar al caballo", () => {
  const record = {
    type: "TREATMENT",
    name: "Antibiótico",
    date: day("2026-10-01"),
    prescriptionNumber: "RV-11-2026-0042",
  };
  assert.deepEqual(missingBookFields(record, identified), []);
  assert.deepEqual(missingBookFields(record, { microchip: null, uelnCode: " " }), ["horseIdentity"]);
});

test("el herrador no se exige en el libro", () => {
  assert.deepEqual(
    missingBookFields({ type: "FARRIER", name: "Herrado", date: day("2026-10-01") }, {}),
    [],
  );
});

test("aviso legible de lo que falta", () => {
  assert.equal(describeMissing([]), "");
  assert.equal(describeMissing(["supplier"]), "Falta proveedor");
  assert.equal(
    describeMissing(["dose", "withdrawalDays", "supplier"]),
    "Falta cantidad administrada, tiempo de espera y proveedor",
  );
});

test("el libro se conserva 5 años", () => {
  assert.equal(RETENTION_YEARS, 5);
  assert.equal(ymd(retentionStart(day("2026-09-26"))), "2021-09-26");
});

test("periodo del libro: año en curso por defecto y solo años conservables", () => {
  const now = day("2026-09-26");
  assert.equal(bookPeriod(undefined, now).key, "2026");
  assert.equal(bookPeriod("2023", now).key, "2023");
  assert.equal(ymd(bookPeriod("2023", now).from), "2023-01-01");
  assert.equal(ymd(bookPeriod("2023", now).to), "2023-12-31");
  // Fuera del plazo o valores raros: vuelve al año en curso.
  assert.equal(bookPeriod("2019", now).key, "2026");
  assert.equal(bookPeriod("2030", now).key, "2026");
  assert.equal(bookPeriod("abc", now).key, "2026");
  const five = bookPeriod("5a", now);
  assert.equal(ymd(five.from), "2021-09-26");
  assert.equal(ymd(five.to), "2026-12-31");
  assert.deepEqual(
    bookPeriodOptions(now).map((o) => o.key),
    ["2026", "2025", "2024", "2023", "2022", "5a"],
  );
});
