import Stripe from "stripe";

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

export type PlanKey = "starter" | "pro" | "enterprise";

export const PLANS: Record<
  PlanKey,
  { name: string; priceId: string; maxHorses: number }
> = {
  starter: {
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER ?? "",
    maxHorses: 15,
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    maxHorses: 60,
  },
  enterprise: {
    name: "Enterprise",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
    maxHorses: 999,
  },
};

/**
 * Traduce un precio de Stripe al plan de la yeguada. Un solo sitio donde vive
 * el mapeo, para que el webhook y la app no puedan discrepar.
 */
export function planForPriceId(priceId: string | null | undefined): PlanKey {
  if (!priceId) return "starter";
  const found = (Object.keys(PLANS) as PlanKey[]).find(
    (key) => PLANS[key].priceId && PLANS[key].priceId === priceId,
  );
  return found ?? "starter";
}

/**
 * El plan gratuito no se compra y el de empresa se habla por email. Solo hay
 * boton de pago cuando hay un precio configurado de verdad.
 */
export function isPlanPurchasable(key: string): boolean {
  if (key === "starter") return false;
  const plan = PLANS[key as PlanKey];
  return Boolean(plan?.priceId);
}

export function planHorseLimit(key: string): number {
  return PLANS[key as PlanKey]?.maxHorses ?? PLANS.starter.maxHorses;
}

export function planLabel(key: string): string {
  const plan = PLANS[key as PlanKey];
  if (!plan) return key;
  return key === "starter" ? `${plan.name} (gratuito)` : plan.name;
}
