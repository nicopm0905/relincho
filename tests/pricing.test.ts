import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ADDONS,
  ANNUAL_MONTHS_CHARGED,
  FOUNDER,
  PLAN_DEFINITIONS,
  PLAN_FEATURES,
  PLAN_ORDER,
  annualMonthlyEquivalent,
  annualPrice,
  billingAddonPrice,
  extraHorsesPrice,
  formatEuro,
  founderMonthly,
  founderPrice,
  horseLimitFor,
  isFounderOfferOpen,
  isMigrationFree,
  isNearHorseLimit,
  newFeaturesOf,
  normalizePlanKey,
  planPrice,
  pricePerHorseMonth,
  qrPrintPrice,
} from "@/lib/pricing";

test("los precios de lista son los de la arquitectura de precios del 19 sep", () => {
  assert.equal(PLAN_DEFINITIONS.cuaderno.monthly, 0);
  assert.equal(PLAN_DEFINITIONS.cuadra.monthly, 69);
  assert.equal(PLAN_DEFINITIONS.rendimiento.monthly, 149);
  assert.equal(PLAN_DEFINITIONS.yeguada.monthly, 349);
  assert.equal(PLAN_DEFINITIONS.yeguada.startsAt, true);
});

test("anual = 10 mensualidades: 690 / 1.490 / 3.490 €", () => {
  assert.equal(ANNUAL_MONTHS_CHARGED, 10);
  assert.equal(planPrice("cuadra", "year"), 690);
  assert.equal(planPrice("rendimiento", "year"), 1490);
  assert.equal(planPrice("yeguada", "year"), 3490);
  assert.equal(planPrice("cuadra", "month"), 69);
  assert.equal(annualPrice(100), 1000);
  assert.equal(annualMonthlyEquivalent(69), 57.5);
});

test("Rendimiento es el único plan destacado y el precio escala con el plan", () => {
  const highlighted = PLAN_ORDER.filter((k) => PLAN_DEFINITIONS[k].highlighted);
  assert.deepEqual(highlighted, ["rendimiento"]);
  const prices = PLAN_ORDER.map((k) => PLAN_DEFINITIONS[k].monthly);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test("coste por caballo: Cuadra 3,45 € (ancla de venta)", () => {
  assert.equal(pricePerHorseMonth("cuadra"), 3.45);
  assert.equal(pricePerHorseMonth("rendimiento"), 2.98);
  assert.equal(pricePerHorseMonth("cuaderno"), null);
  assert.equal(pricePerHorseMonth("yeguada"), null);
});

test("nunca se cobra por usuario: todos los planes de pago incluyen equipo", () => {
  assert.ok((PLAN_DEFINITIONS.cuadra.maxUsers ?? 0) >= 3);
  assert.ok((PLAN_DEFINITIONS.rendimiento.maxUsers ?? 0) >= 10);
  assert.equal(PLAN_DEFINITIONS.yeguada.maxUsers, null);
});

test("precio de fundador: -40 % → 41 / 89 / 209 € al mes", () => {
  assert.equal(FOUNDER.discount, 0.4);
  assert.equal(founderMonthly("cuadra"), 41);
  assert.equal(founderMonthly("rendimiento"), 89);
  assert.equal(founderMonthly("yeguada"), 209);
  assert.equal(founderPrice("cuadra", "year"), 410);
});

test("la oferta de fundador se cierra por plazas o por fecha", () => {
  const before = new Date("2026-10-01T10:00:00+02:00");
  const after = new Date("2027-01-02T10:00:00+01:00");
  assert.equal(isFounderOfferOpen(0, before), true);
  assert.equal(isFounderOfferOpen(FOUNDER.slots - 1, before), true);
  assert.equal(isFounderOfferOpen(FOUNDER.slots, before), false);
  assert.equal(isFounderOfferOpen(0, after), false);
});

test("módulos: facturación 39 €/mes, caballos extra 25 €/mes por bloque de 10", () => {
  assert.equal(billingAddonPrice("month"), 39);
  assert.equal(billingAddonPrice("year"), 390);
  assert.equal(ADDONS.extraHorses.blockSize, 10);
  assert.equal(extraHorsesPrice(1, "month"), 25);
  assert.equal(extraHorsesPrice(3, "month"), 75);
  assert.equal(extraHorsesPrice(2, "year"), 500);
  assert.equal(extraHorsesPrice(-4, "month"), 0);
});

test("la facturación viene incluida solo en Yeguada", () => {
  assert.deepEqual(ADDONS.billing.includedIn, ["yeguada"]);
  assert.equal(PLAN_DEFINITIONS.yeguada.includesBilling, true);
  assert.equal(PLAN_DEFINITIONS.rendimiento.includesBilling, false);
  assert.ok(PLAN_FEATURES.yeguada.includes("pupilajeFacturacion"));
  assert.ok(!PLAN_FEATURES.rendimiento.includes("pupilajeFacturacion"));
});

test("migración: 149 € una vez, gratis en anual y en Yeguada", () => {
  assert.equal(ADDONS.migration.oneTime, 149);
  assert.equal(isMigrationFree("cuadra", "month"), false);
  assert.equal(isMigrationFree("cuadra", "year"), true);
  assert.equal(isMigrationFree("yeguada", "month"), true);
});

test("carteles QR a 3 € por caballo", () => {
  assert.equal(qrPrintPrice(20), 60);
  assert.equal(qrPrintPrice(0), 0);
});

test("se avisa al 80 % del límite y nunca si no hay límite", () => {
  assert.equal(isNearHorseLimit(15, 20), false);
  assert.equal(isNearHorseLimit(16, 20), true);
  assert.equal(isNearHorseLimit(500, null), false);
});

test("el gratis baja a 5 caballos y no incluye voz, rendimiento ni facturación", () => {
  assert.equal(PLAN_DEFINITIONS.cuaderno.maxHorses, 5);
  const free = PLAN_FEATURES.cuaderno;
  assert.ok(!free.includes("voz"));
  assert.ok(!free.includes("periodizacion"));
  assert.ok(!free.includes("pupilajeFacturacion"));
});

test("cada plan incluye todo lo del anterior", () => {
  for (let i = 1; i < PLAN_ORDER.length; i++) {
    const previous = new Set(PLAN_FEATURES[PLAN_ORDER[i - 1]]);
    const current = new Set(PLAN_FEATURES[PLAN_ORDER[i]]);
    for (const feature of previous) assert.ok(current.has(feature));
    assert.ok(newFeaturesOf(PLAN_ORDER[i]).length > 0);
  }
});

test("los planes heredados de la beta se normalizan y respetan su límite", () => {
  assert.equal(normalizePlanKey("starter"), "cuaderno");
  assert.equal(normalizePlanKey("pro"), "rendimiento");
  assert.equal(normalizePlanKey("enterprise"), "yeguada");
  assert.equal(normalizePlanKey("cuadra"), "cuadra");
  assert.equal(normalizePlanKey(null), "cuaderno");
  assert.equal(horseLimitFor("starter"), 15);
});

test("formato de euros sin decimales inútiles", () => {
  assert.equal(formatEuro(69).replace(/\s/g, " "), "69 €");
  assert.equal(formatEuro(3.45).replace(/\s/g, " "), "3,45 €");
});
