"use server";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { stripe, PLANS } from "@/lib/stripe";
import { redirect } from "next/navigation";

export async function createCheckoutSession(tenantId: string, planKey: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const plan = PLANS[planKey];
  if (!plan?.priceId) throw new Error("Plan inválido");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) throw new Error("Finca no encontrada");

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card", "sepa_debit"],
    line_items: [{ price: plan.priceId, quantity: 1 }],
    customer: tenant.stripeCustomerId ?? undefined,
    customer_email: !tenant.stripeCustomerId ? session.user.email! : undefined,
    metadata: { tenantId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${tenant.slug}/ajustes?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${tenant.slug}/ajustes`,
    locale: "es",
  });

  redirect(stripeSession.url!);
}

export async function createPortalSession(tenantId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.stripeCustomerId) throw new Error("Sin suscripción activa");

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/${tenant.slug}/ajustes`,
  });

  redirect(portalSession.url);
}
