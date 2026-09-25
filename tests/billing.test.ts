import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isPlanPurchasable,
  planForPriceId,
  planForPriceIdOrNull,
  planHorseLimit,
  planLabel,
  planPriceId,
} from "@/lib/stripe";

test("el plan gratuito no se vende y no lleva al checkout", () => {
  assert.equal(isPlanPurchasable("cuaderno"), false);
  assert.equal(isPlanPurchasable("starter"), false);
  assert.equal(isPlanPurchasable("inventado"), false);
});

test("sin precio configurado no se ofrece el botón de pago", () => {
  // Es el estado real de producción hasta que se creen los precios en Stripe:
  // el botón debe desaparecer en vez de lanzar un error.
  for (const key of ["cuadra", "rendimiento", "yeguada"] as const) {
    for (const interval of ["month", "year"] as const) {
      assert.equal(isPlanPurchasable(key, interval), Boolean(planPriceId(key, interval)));
    }
  }
});

test("un precio desconocido nunca asciende a un plan de pago", () => {
  assert.equal(planForPriceId(null), "cuaderno");
  assert.equal(planForPriceId(undefined), "cuaderno");
  assert.equal(planForPriceId("price_que_no_es_nuestro"), "cuaderno");
  assert.equal(planForPriceIdOrNull("price_que_no_es_nuestro"), null);
});

test("cada precio configurado devuelve su propio plan, mensual y anual", () => {
  for (const key of ["cuadra", "rendimiento", "yeguada"] as const) {
    for (const interval of ["month", "year"] as const) {
      const priceId = planPriceId(key, interval);
      if (priceId) assert.equal(planForPriceId(priceId), key);
    }
  }
});

test("los límites de caballos son los que ve el cliente", () => {
  assert.equal(planHorseLimit("cuaderno"), 5);
  assert.equal(planHorseLimit("cuadra"), 20);
  assert.equal(planHorseLimit("rendimiento"), 50);
  assert.equal(planHorseLimit("yeguada"), null);
  assert.equal(planHorseLimit("desconocido"), 5);
});

test("la beta conserva su límite: quien entró con 15 caballos no baja a 5", () => {
  assert.equal(planHorseLimit("starter"), 15);
  assert.equal(planHorseLimit("pro"), 60);
  assert.equal(planHorseLimit("enterprise"), null);
});

test("los bloques extra suman 10 caballos cada uno", () => {
  assert.equal(planHorseLimit("cuadra", 2), 40);
  assert.equal(planHorseLimit("yeguada", 3), null);
  assert.equal(planHorseLimit("starter", 1), 25);
});

test("el plan gratuito se anuncia como gratuito", () => {
  assert.equal(planLabel("cuaderno"), "Cuaderno (gratuito)");
  assert.equal(planLabel("starter"), "Cuaderno (beta)");
  assert.equal(planLabel("cuadra"), "Cuadra");
  assert.equal(planLabel("rendimiento"), "Rendimiento");
});
