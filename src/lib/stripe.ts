import Stripe from "stripe";
import {
  FREE_PLAN,
  LEGACY_PLANS,
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  horseLimitFor,
  isPlanKey,
  normalizePlanKey,
  type BillingInterval,
  type PlanKey,
} from "@/lib/pricing";

/**
 * Sin clave no se puede cobrar: quien lo intente recibe un aviso claro.
 *
 * Ojo con `??`: una variable definida pero vacía (`STRIPE_SECRET_KEY=""`, que es
 * como viene el `.env` de desarrollo) no es nullish, así que llegaría una clave
 * vacía al constructor de Stripe y reventaría al importar el módulo — y con él,
 * el build entero. Por eso se comprueba el valor ya recortado.
 */
const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

export const stripeConfigured = Boolean(secretKey);

export const stripe = new Stripe(secretKey || "sk_test_dummy", {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

export type { PlanKey, BillingInterval } from "@/lib/pricing";

/**
 * Los precios de Stripe se crean a mano en el panel (una vez, en modo real) y
 * sus ids se pasan por entorno. Se leen al usarlos, no al importar, para que
 * un `.env` a medio rellenar no rompa el build.
 *
 * Planes (uno por intervalo):
 *   STRIPE_PRICE_CUADRA_MONTH        69 €/mes      STRIPE_PRICE_CUADRA_YEAR        690 €/año
 *   STRIPE_PRICE_RENDIMIENTO_MONTH  149 €/mes      STRIPE_PRICE_RENDIMIENTO_YEAR  1490 €/año
 *   STRIPE_PRICE_YEGUADA_MONTH      349 €/mes      STRIPE_PRICE_YEGUADA_YEAR      3490 €/año
 * Módulos:
 *   STRIPE_PRICE_ADDON_BILLING_MONTH  39 €/mes     STRIPE_PRICE_ADDON_BILLING_YEAR  390 €/año
 *   STRIPE_PRICE_ADDON_HORSES_MONTH   25 €/mes por bloque de 10 (cantidad = bloques)
 *   STRIPE_PRICE_ADDON_HORSES_YEAR   250 €/año por bloque de 10
 *   STRIPE_PRICE_MIGRATION           149 € pago único
 * Fundador:
 *   STRIPE_COUPON_FOUNDER            40 % de descuento, duración "forever"
 * Heredados (yeguadas de la beta que ya pagaban): STRIPE_PRICE_PRO.
 */
const suffix = (interval: BillingInterval) => (interval === "year" ? "YEAR" : "MONTH");

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function planPriceId(key: PlanKey, interval: BillingInterval): string {
  if (!PLAN_DEFINITIONS[key].selfServe) return "";
  return env(`STRIPE_PRICE_${key.toUpperCase()}_${suffix(interval)}`);
}

export function billingAddonPriceId(interval: BillingInterval): string {
  return env(`STRIPE_PRICE_ADDON_BILLING_${suffix(interval)}`);
}

export function extraHorsesPriceId(interval: BillingInterval): string {
  return env(`STRIPE_PRICE_ADDON_HORSES_${suffix(interval)}`);
}

export function migrationPriceId(): string {
  return env("STRIPE_PRICE_MIGRATION");
}

export function founderCouponId(): string {
  return env("STRIPE_COUPON_FOUNDER");
}

/** Todos los precios de plan conocidos, incluido el heredado de la beta. */
function planPriceEntries(): { priceId: string; plan: string }[] {
  const entries: { priceId: string; plan: string }[] = [];
  for (const key of PLAN_ORDER) {
    for (const interval of ["month", "year"] as const) {
      const priceId = planPriceId(key, interval);
      if (priceId) entries.push({ priceId, plan: key });
    }
  }
  const legacyPro = env("STRIPE_PRICE_PRO");
  if (legacyPro) entries.push({ priceId: legacyPro, plan: "pro" });
  return entries;
}

/**
 * Traduce un precio de Stripe al plan de la yeguada. Un solo sitio donde vive
 * el mapeo, para que el webhook y la app no puedan discrepar. Devuelve `null`
 * si el precio no es de un plan (p. ej. es un módulo o un precio ajeno), para
 * que quien llame decida qué hacer en vez de ascender a alguien por error.
 */
export function planForPriceIdOrNull(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  return planPriceEntries().find((e) => e.priceId === priceId)?.plan ?? null;
}

export function planForPriceId(priceId: string | null | undefined): string {
  return planForPriceIdOrNull(priceId) ?? FREE_PLAN;
}

/** ¿Es un precio de módulo? Sirve para leer cantidades en el webhook. */
export function addonKindForPriceId(
  priceId: string | null | undefined,
): "billing" | "extraHorses" | null {
  if (!priceId) return null;
  for (const interval of ["month", "year"] as const) {
    if (priceId === billingAddonPriceId(interval)) return "billing";
    if (priceId === extraHorsesPriceId(interval)) return "extraHorses";
  }
  return null;
}

/**
 * Solo hay botón de pago cuando el plan es de autoservicio y hay un precio
 * configurado de verdad. El gratuito no se compra.
 */
export function isPlanPurchasable(
  key: string,
  interval: BillingInterval = "month",
): boolean {
  if (!isPlanKey(key)) return false;
  return Boolean(planPriceId(key, interval));
}

export function planHorseLimit(key: string, extraBlocks = 0): number | null {
  return horseLimitFor(key, extraBlocks);
}

export function planLabel(key: string): string {
  if (LEGACY_PLANS[key]) return LEGACY_PLANS[key].label;
  const plan = normalizePlanKey(key);
  const name = plan.charAt(0).toUpperCase() + plan.slice(1);
  return plan === FREE_PLAN ? `${name} (gratuito)` : name;
}
