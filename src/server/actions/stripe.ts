"use server";

import { auth } from "@/server/auth";
import { requireTenantAccess } from "@/server/services/access";
import { prisma } from "@/server/db/prisma";
import {
  stripe,
  stripeConfigured,
  planPriceId,
  billingAddonPriceId,
  extraHorsesPriceId,
  migrationPriceId,
  founderCouponId,
  isPlanPurchasable,
} from "@/lib/stripe";
import {
  ADDONS,
  FOUNDER,
  PLAN_DEFINITIONS,
  isFounderOfferOpen,
  isMigrationFree,
  isPlanKey,
  type BillingInterval,
} from "@/lib/pricing";
import { getBaseUrl } from "@/lib/utils";
import { logEvent, reportError } from "@/lib/observability";
import { redirect } from "next/navigation";

/**
 * El `tenantId` llega como argumento desde el navegador, asi que no basta con
 * tener sesion: hay que comprobar que quien pulsa el boton manda en esa
 * yeguada. Solo el propietario gestiona el cobro.
 */
async function requireBillingAccess(tenantId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const access = await requireTenantAccess(session.user.id, tenantId, ["OWNER"]);
  if (!access) {
    throw new Error("Solo el propietario puede gestionar la suscripción");
  }
  return session.user;
}

export interface CheckoutOptions {
  interval?: BillingInterval;
  /** Añade el módulo de Pupilaje y Facturación (no hace falta en Yeguada). */
  billingModule?: boolean;
  /** Bloques de 10 caballos extra sobre el límite del plan. */
  extraHorseBlocks?: number;
  /** Migración "Trae tu Excel" (149 € una vez; gratis en anual y en Yeguada). */
  migration?: boolean;
  /** Pide el precio de fundador si la oferta sigue abierta. */
  founder?: boolean;
}

export async function createCheckoutSession(
  tenantId: string,
  planKey: string,
  options: CheckoutOptions = {},
) {
  const user = await requireBillingAccess(tenantId);

  if (!stripeConfigured) {
    throw new Error("El cobro no está configurado todavía");
  }

  const interval: BillingInterval = options.interval === "year" ? "year" : "month";
  if (!isPlanKey(planKey) || !isPlanPurchasable(planKey, interval)) {
    throw new Error("Ese plan no se puede contratar desde aquí");
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Yeguada no encontrada");

  const plan = planPriceId(planKey, interval);
  const lineItems: { price: string; quantity: number }[] = [
    { price: plan, quantity: 1 },
  ];

  // Modulo de facturacion: solo se cobra donde no viene incluido.
  const definition = PLAN_DEFINITIONS[planKey];
  if (options.billingModule && !definition.includesBilling) {
    if (!(ADDONS.billing.availableOn as readonly string[]).includes(planKey)) {
      throw new Error("Ese plan no admite el módulo de facturación");
    }
    const price = billingAddonPriceId(interval);
    if (!price) throw new Error("El módulo de facturación no está disponible todavía");
    lineItems.push({ price, quantity: 1 });
  }

  // Bloques de caballos extra: solo en planes con limite.
  const blocks = Math.min(20, Math.max(0, Math.floor(options.extraHorseBlocks ?? 0)));
  if (blocks > 0) {
    if (!(ADDONS.extraHorses.availableOn as readonly string[]).includes(planKey)) {
      throw new Error("Ese plan no admite caballos extra");
    }
    const price = extraHorsesPriceId(interval);
    if (!price) throw new Error("Los caballos extra no están disponibles todavía");
    lineItems.push({ price, quantity: blocks });
  }

  // Migracion: pago unico, salvo que vaya incluida.
  if (options.migration && !isMigrationFree(planKey, interval)) {
    const price = migrationPriceId();
    if (!price) throw new Error("La migración no está disponible todavía");
    lineItems.push({ price, quantity: 1 });
  }

  // Precio de fundador: -40 % de por vida y gratis hasta el 1 ene 2027. Las
  // plazas son las yeguadas fundadoras vivas; una cancelada libera la suya.
  const coupon = founderCouponId();
  let founder = tenant.founder;
  if (!founder && options.founder && coupon) {
    const taken = await prisma.tenant.count({ where: { founder: true } });
    founder = isFounderOfferOpen(taken);
    if (!founder) {
      throw new Error("La oferta de fundador ya no está disponible");
    }
  }
  const trialEnd = Math.floor(new Date(FOUNDER.freeUntil).getTime() / 1000);
  const trialUsable = founder && trialEnd - Date.now() / 1000 > 3 * 24 * 3600;

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Managed Payments (activo por defecto en la cuenta) exige un tax_code
    // por producto para calcular el IVA solo; sin eso rechaza la sesion
    // entera. Se desactiva aqui y se vuelve al flujo clasico de Stripe hasta
    // que se configure Stripe Tax con calma.
    managed_payments: { enabled: false },
    // SEPA convierte mejor que la tarjeta en yeguadas tradicionales.
    payment_method_types: ["card", "sepa_debit"],
    line_items: lineItems,
    customer: tenant.stripeCustomerId ?? undefined,
    customer_email: !tenant.stripeCustomerId ? (user.email ?? undefined) : undefined,
    // Duplicamos el tenantId en los tres sitios donde puede leerse: el propio
    // checkout, la referencia del cliente y la suscripcion. Sin esto, si el
    // evento de la suscripcion llega antes que el de checkout, no hay customer
    // guardado al que atribuirla y la yeguada se queda sin plan.
    metadata: { tenantId },
    client_reference_id: tenantId,
    subscription_data: {
      metadata: { tenantId, ...(founder ? { founder: "1" } : {}) },
      ...(trialUsable ? { trial_end: trialEnd } : {}),
    },
    // Stripe no admite a la vez un descuento fijo y codigos promocionales.
    ...(founder && coupon
      ? { discounts: [{ coupon }] }
      : { allow_promotion_codes: true }),
    success_url: `${getBaseUrl()}/${tenant.slug}/ajustes?success=1`,
    cancel_url: `${getBaseUrl()}/${tenant.slug}/ajustes`,
    locale: "es",
  });

  logEvent("billing.checkout_started", {
    tenantId,
    planKey,
    interval,
    founder,
    extraHorseBlocks: blocks,
  });
  redirect(stripeSession.url!);
}

export async function createPortalSession(tenantId: string) {
  await requireBillingAccess(tenantId);

  if (!stripeConfigured) {
    throw new Error("El cobro no está configurado todavía");
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.stripeCustomerId) {
    await reportError("Portal de facturación sin cliente de Stripe", {
      scope: "billing.portal",
      tenantId,
    });
    throw new Error("Todavía no hay una suscripción que gestionar");
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${getBaseUrl()}/${tenant.slug}/ajustes`,
  });

  redirect(portalSession.url);
}
