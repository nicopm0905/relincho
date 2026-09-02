import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

export const PLANS: Record<string, { name: string; priceId: string; maxHorses: number }> = {
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
