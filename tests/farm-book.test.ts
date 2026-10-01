import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAUSE_CODES,
  addBusinessDays,
  averageCensus,
  breedCode,
  censusAt,
  censusCategory,
  complianceAlerts,
  isAndalusia,
  missingMovementFields,
  presentAt,
  resolveCause,
  withRunningBalance,
  type AlertHorse,
  type AlertMovement,
  type BookMovement,
} from "@/lib/farm-book";

const d = (iso: string) => new Date(`${iso}T10:00:00Z`);

test("códigos oficiales de raza a partir de lo escrito en la ficha", () => {
  assert.equal(breedCode("PRE"), "PRE");
  assert.equal(breedCode("Pura Raza Española"), "PRE");
  assert.equal(breedCode("P.R.E."), "PRE");
  assert.equal(breedCode("Pura sangre inglés"), "PSI");
  assert.equal(breedCode("Anglo-árabe"), "A.a");
  assert.equal(breedCode("Hispano-árabe"), "Ha");
  assert.equal(breedCode("Anglohispanoárabe"), "AHa");
  assert.equal(breedCode("Árabe"), "Á");
  assert.equal(breedCode("Asno zamorano-leonés"), "Z");
  assert.equal(breedCode("Lusitano"), "X");
  assert.equal(breedCode(null), "X");
});

test("causas: códigos del anexo IV y deducción de los movimientos antiguos", () => {
  assert.equal(CAUSE_CODES.NACIMIENTO, "N");
  assert.equal(CAUSE_CODES.VENTA, "V");
  assert.equal(CAUSE_CODES.TRASLADO_PROVISIONAL, "TP");
  assert.deepEqual(resolveCause({ direction: "OUT", reason: "Venta · a Sevilla" }), {
    cause: "VENTA",
    inferred: true,
  });
  assert.equal(resolveCause({ direction: "OUT", reason: "Muerte" }).cause, "MUERTE");
  assert.equal(resolveCause({ direction: "IN", reason: "Nacimiento en la finca" }).cause, "NACIMIENTO");
  assert.equal(resolveCause({ direction: "IN", reason: null }).cause, "COMPRA");
  assert.deepEqual(resolveCause({ direction: "IN", cause: "RETORNO" }), { cause: "RETORNO", inferred: false });
});

const horses = [
  { id: "yegua", sex: "FEMALE" as const, birthDate: d("2015-04-01") },
  { id: "semental", sex: "MALE" as const, birthDate: d("2012-03-01") },
  { id: "potro", sex: "MALE" as const, birthDate: d("2026-03-10") },
  { id: "castrado", sex: "GELDING" as const, birthDate: d("2018-05-01") },
];

const movements: BookMovement[] = [
  { id: "1", horseId: "yegua", direction: "IN", date: d("2025-01-01"), cause: "APERTURA" },
  { id: "2", horseId: "semental", direction: "IN", date: d("2025-01-01"), cause: "APERTURA" },
  { id: "3", horseId: "castrado", direction: "IN", date: d("2025-06-15"), cause: "COMPRA" },
  { id: "4", horseId: "potro", direction: "IN", date: d("2026-03-10"), cause: "NACIMIENTO" },
  { id: "5", horseId: "semental", direction: "OUT", date: d("2026-05-01"), cause: "TRASLADO_PROVISIONAL" },
  { id: "6", horseId: "semental", direction: "IN", date: d("2026-05-12"), cause: "RETORNO" },
  { id: "7", horseId: "castrado", direction: "OUT", date: d("2026-07-01"), cause: "VENTA" },
];

test("animales presentes en una fecha", () => {
  assert.deepEqual([...presentAt(movements, d("2025-12-31"))].sort(), ["castrado", "semental", "yegua"]);
  assert.deepEqual([...presentAt(movements, d("2026-05-05"))].sort(), ["castrado", "potro", "yegua"]);
  assert.deepEqual([...presentAt(movements, d("2026-08-01"))].sort(), ["potro", "semental", "yegua"]);
});

test("balance de hembras y machos tras cada anotación", () => {
  const rows = withRunningBalance(movements, horses);
  assert.deepEqual(
    rows.map((r) => `${r.balance.females}/${r.balance.males}`),
    ["1/0", "1/1", "1/2", "1/3", "1/2", "1/3", "1/2"],
  );
});

test("censo a 31 de diciembre por categorías", () => {
  const c = censusAt(movements, horses, d("2025-12-31"));
  assert.equal(c.total, 3);
  assert.equal(c.byCategory.HEMBRA_REPRODUCTORA, 1);
  assert.equal(c.byCategory.MACHO_REPRODUCTOR, 1);
  assert.equal(c.byCategory.OTROS, 1); // castrado
  assert.equal(censusCategory(horses[2], d("2026-12-31")), "REPOSICION");
});

test("censo medio del año", () => {
  // 2025: 2 caballos todo el año y el castrado desde el 15 de junio (200 días).
  const avg = averageCensus(movements, 2025);
  assert.equal(avg, Math.round(((365 * 2 + 200) / 365) * 10) / 10);
});

test("días hábiles: de viernes a viernes siguiente con 5", () => {
  // 2026-10-02 es viernes.
  assert.equal(addBusinessDays(d("2026-10-02"), 5).toISOString().slice(0, 10), "2026-10-09");
  assert.equal(addBusinessDays(d("2026-10-02"), 7).toISOString().slice(0, 10), "2026-10-13");
});

test("Andalucía por provincia o por el REGA", () => {
  assert.equal(isAndalusia("Cádiz"), true);
  assert.equal(isAndalusia(null, "ES110200000123"), true);
  assert.equal(isAndalusia("Madrid", "ES280790000001"), false);
});

test("datos que pide el anexo IV en cada anotación", () => {
  assert.deepEqual(
    missingMovementFields({ direction: "IN", cause: "COMPRA", originRega: "ES110200000123" }),
    ["nº de guía o documento", "transportista", "matrícula del vehículo"],
  );
  assert.deepEqual(missingMovementFields({ direction: "IN", cause: "NACIMIENTO" }), []);
  assert.deepEqual(
    missingMovementFields({ direction: "OUT", cause: "MUERTE", disposalMethod: "ENTERRAMIENTO" }),
    ["lugar de enterramiento", "fecha de comunicación de la baja"],
  );
  assert.deepEqual(
    missingMovementFields({ direction: "OUT", cause: "VENTA", destinationRega: "ES410910000001", documentNumber: "G-1" }),
    [],
  );
});

const farm = {
  regaCode: "ES110200000123",
  holderName: "Yeguada El Olivo",
  nif: "B11000000",
  address: "Ctra. Arcos km 5",
  city: "Jerez de la Frontera",
  province: "Cádiz",
};

const alertHorse = (h: Partial<AlertHorse> & { id: string }): AlertHorse => ({
  name: h.id,
  sex: "FEMALE",
  birthDate: null,
  status: "ACTIVE",
  uelnCode: "724015240123456",
  microchip: "941000012345678",
  ...h,
});

test("avisos: caballo sin alta, potro sin identificar, muerte sin comunicar", () => {
  const now = d("2026-10-02");
  const alerts = complianceAlerts({
    farm,
    now,
    horses: [
      alertHorse({ id: "yegua" }),
      alertHorse({ id: "nueva" }),
      alertHorse({ id: "potro", birthDate: d("2025-11-01"), uelnCode: null, microchip: null }),
      alertHorse({ id: "vieja", status: "DEAD" }),
    ],
    movements: [
      { id: "a", horseId: "yegua", direction: "IN", date: d("2025-01-01"), cause: "APERTURA" },
      { id: "b", horseId: "potro", direction: "IN", date: d("2025-11-01"), cause: "NACIMIENTO" },
      { id: "c", horseId: "vieja", direction: "IN", date: d("2025-01-01"), cause: "APERTURA" },
      {
        id: "m",
        horseId: "vieja",
        direction: "OUT",
        date: d("2026-09-21"),
        cause: "MUERTE",
        disposalMethod: "RECOGIDA",
      } as AlertMovement,
    ],
  });
  const keys = alerts.map((a) => a.key);
  assert.ok(keys.includes("not-in-book"));
  assert.ok(keys.includes("ident-potro"));
  assert.ok(keys.includes("death-m"));
  const death = alerts.find((a) => a.key === "death-m")!;
  // 21/09/2026 lunes + 7 hábiles = 30/09: ya vencido el 02/10.
  assert.equal(death.level, "critical");
  assert.equal(death.dueDate?.toISOString().slice(0, 10), "2026-09-30");
  const ident = alerts.find((a) => a.key === "ident-potro")!;
  assert.equal(ident.dueDate?.toISOString().slice(0, 10), "2026-11-01");
  assert.equal(ident.level, "warning");
  // Lo crítico, primero.
  assert.equal(alerts[0].level, "critical");
});

test("avisos: traslado provisional de más de 30 días y censo antes del 1 de marzo", () => {
  const alerts = complianceAlerts({
    farm,
    now: d("2027-02-20"),
    horses: [alertHorse({ id: "semental", sex: "MALE" })],
    movements: [
      { id: "a", horseId: "semental", direction: "IN", date: d("2025-01-01"), cause: "APERTURA" },
      {
        id: "t",
        horseId: "semental",
        direction: "OUT",
        date: d("2027-01-05"),
        cause: "TRASLADO_PROVISIONAL",
        destinationRega: "ES410910000001",
        documentNumber: "TME-1",
      } as AlertMovement,
    ],
  });
  const ret = alerts.find((a) => a.key === "return-t");
  assert.ok(ret);
  assert.equal(ret!.level, "critical");
  const census = alerts.find((a) => a.key === "census-2026");
  assert.ok(census);
  assert.equal(census!.level, "warning");
});

test("fuera de Andalucía no se pide el censo de la Orden andaluza", () => {
  const alerts = complianceAlerts({
    farm: { ...farm, province: "Madrid", regaCode: "ES280790000001" },
    now: d("2027-02-20"),
    horses: [],
    movements: [],
  });
  assert.equal(alerts.some((a) => a.key.startsWith("census")), false);
});
