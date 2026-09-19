import { test } from "node:test";
import assert from "node:assert/strict";

import { PLANS, isPlanPurchasable, planForPriceId, planHorseLimit, planLabel } from "@/lib/stripe";

test("el plan gratuito no se vende y no lleva al checkout", () => {
  assert.equal(isPlanPurchasable("starter"), false);
  assert.equal(isPlanPurchasable("inventado"), false);
});

test("sin precio configurado no se ofrece el botón de pago", () => {
  // Es el estado real de producción hasta que se creen los precios en Stripe:
  // el botón debe desaparecer en vez de lanzar «Plan inválido».
  if (!PLANS.pro.priceId) {
    assert.equal(isPlanPurchasable("pro"), false);
  } else {
    assert.equal(isPlanPurchasable("pro"), true);
  }
});

test("un precio desconocido nunca asciende a un plan de pago", () => {
  assert.equal(planForPriceId(null), "starter");
  assert.equal(planForPriceId(undefined), "starter");
  assert.equal(planForPriceId("price_que_no_es_nuestro"), "starter");
});

test("cada precio configurado devuelve su propio plan", () => {
  for (const key of ["pro", "enterprise"] as const) {
    const priceId = PLANS[key].priceId;
    if (priceId) assert.equal(planForPriceId(priceId), key);
  }
});

test("los límites de caballos son los que ve el cliente", () => {
  assert.equal(planHorseLimit("starter"), 15);
  assert.equal(planHorseLimit("pro"), 60);
  assert.equal(planHorseLimit("desconocido"), 15);
});

test("el plan gratuito se anuncia como gratuito", () => {
  assert.equal(planLabel("starter"), "Starter (gratuito)");
  assert.equal(planLabel("pro"), "Pro");
});
