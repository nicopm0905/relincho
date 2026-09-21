"use server";

import { auth } from "@/server/auth";
import { requireTenantAccess } from "@/server/services/access";
import { prisma } from "@/server/db/prisma";
import { stripe, stripeConfigured, PLANS, isPlanPurchasable } from "@/lib/stripe";
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

export async function createCheckoutSession(tenantId: string, planKey: string) {
  const user = await requireBillingAccess(tenantId);

  if (!stripeConfigured) {
    throw new Error("El cobro no está configurado todavía");
  }
  if (!isPlanPurchasable(planKey)) {
    throw new Error("Ese plan no se puede contratar desde aquí");
  }

  const plan = PLANS[planKey as keyof typeof PLANS];
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Yeguada no encontrada");

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Managed Payments (activo por defecto en la cuenta) exige un tax_code
    // por producto para calcular el IVA solo; sin eso rechaza la sesion
    // entera. Se desactiva aqui y se vuelve al flujo clasico de Stripe hasta
    // que se configure Stripe Tax con calma.
    managed_payments: { enabled: false },
    payment_method_types: ["card", "sepa_debit"],
    line_items: [{ price: plan.priceId, quantity: 1 }],
    customer: tenant.stripeCustomerId ?? undefined,
    customer_email: !tenant.stripeCustomerId ? (user.email ?? undefined) : undefined,
    // Duplicamos el tenantId en los tres sitios donde puede leerse: el propio
    // checkout, la referencia del cliente y la suscripcion. Sin esto, si el
    // evento de la suscripcion llega antes que el de checkout, no hay customer
    // guardado al que atribuirla y la yeguada se queda sin plan.
    metadata: { tenantId },
    client_reference_id: tenantId,
    subscription_data: { metadata: { tenantId } },
    allow_promotion_codes: true,
    success_url: `${getBaseUrl()}/${tenant.slug}/ajustes?success=1`,
    cancel_url: `${getBaseUrl()}/${tenant.slug}/ajustes`,
    locale: "es",
  });

  logEvent("billing.checkout_started", { tenantId, planKey });
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
