import { NextRequest, NextResponse } from "next/server";
import { stripe, stripeConfigured, planForPriceId } from "@/lib/stripe";
import { prisma } from "@/server/db/prisma";
import {
  sendPaymentFailed,
  isEmailConfigured,
} from "@/server/services/notifications/email";
import { logEvent, reportError } from "@/lib/observability";
import type Stripe from "stripe";

export const runtime = "nodejs";

/** Suscripciones en estos estados siguen dando acceso al plan contratado. */
const KEEPS_PLAN = new Set(["active", "trialing", "past_due"]);

function subscriptionMetadataTenantId(sub: Stripe.Subscription): string | null {
  return sub.metadata?.tenantId ?? null;
}

function customerIdOf(value: Stripe.Subscription["customer"]): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Localiza la yeguada de una suscripcion. Primero por metadata (que llega
 * siempre porque la escribimos nosotros al crear el checkout) y solo despues
 * por el customer guardado: asi el orden de llegada de los eventos da igual.
 */
async function resolveTenantId(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscriptionMetadataTenantId(sub);
  if (fromMetadata) return fromMetadata;

  const customerId = customerIdOf(sub.customer);
  if (!customerId) return null;
  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return tenant?.id ?? null;
}

async function applySubscription(sub: Stripe.Subscription) {
  const tenantId = await resolveTenantId(sub);
  if (!tenantId) {
    await reportError("Suscripción sin yeguada a la que atribuirse", {
      scope: "stripe.webhook",
      subscriptionId: sub.id,
      status: sub.status,
    });
    return;
  }

  const item = sub.items.data[0];
  const priceId = item?.price.id ?? null;
  // Un impago no quita el acceso el primer dia: se mantiene el plan y se avisa.
  const plan = KEEPS_PLAN.has(sub.status) ? planForPriceId(priceId) : "starter";
  const periodEnd = (
    item as unknown as { current_period_end?: number } | undefined
  )?.current_period_end;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan,
      stripeStatus: sub.status,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      ...(customerIdOf(sub.customer)
        ? { stripeCustomerId: customerIdOf(sub.customer)! }
        : {}),
    },
  });

  logEvent("billing.subscription_synced", {
    tenantId,
    plan,
    status: sub.status,
  });
}

/** Avisa al responsable de la yeguada de que el cobro no ha pasado. */
async function notifyPaymentFailure(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  if (!customerId) return;

  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
    select: {
      id: true,
      name: true,
      slug: true,
      memberships: {
        where: { role: { in: ["OWNER", "MANAGER"] } },
        select: { user: { select: { email: true } } },
      },
    },
  });
  if (!tenant) return;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { stripeStatus: "past_due" },
  });

  const amountDue =
    invoice.amount_due != null
      ? `${(invoice.amount_due / 100).toFixed(2)} €`
      : null;

  if (!isEmailConfigured()) {
    logEvent("billing.payment_failed_no_email", { tenantId: tenant.id });
    return;
  }

  for (const membership of tenant.memberships) {
    if (!membership.user.email) continue;
    await sendPaymentFailed({
      to: membership.user.email,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      amountDue,
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  // Sin secretos no se puede verificar la firma. Se responde 500 a propósito:
  // es un fallo de configuración, y Stripe lo reintentará cuando esté arreglado.
  if (!stripeConfigured || !process.env.STRIPE_WEBHOOK_SECRET) {
    await reportError("Webhook de Stripe recibido sin configuración", {
      scope: "stripe.webhook",
    });
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = await resolveTenantId(subscription);
        if (tenantId) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              plan: "starter",
              stripeStatus: "canceled",
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            },
          });
          logEvent("billing.subscription_canceled", { tenantId });
        }
        break;
      }

      case "invoice.payment_failed": {
        await notifyPaymentFailure(event.data.object as Stripe.Invoice);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
        if (customerId) {
          await prisma.tenant.updateMany({
            where: { stripeCustomerId: customerId },
            data: { stripeStatus: "active" },
          });
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Pago de una factura desde el portal del propietario externo.
        // Este checkout se crea en `src/server/actions/portal-payment.ts` en
        // modo `payment` con metadata.kind === "portal_invoice_payment".
        if (session.metadata?.kind === "portal_invoice_payment") {
          const invoiceId = session.metadata.invoiceId;
          const tenantId = session.metadata.tenantId;
          if (!invoiceId || !tenantId) break;

          const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, tenantId },
            include: { payments: true },
          });
          if (!invoice) break;

          const reference = String(session.payment_intent);

          // Idempotencia: Stripe puede reintentar el webhook.
          if (invoice.payments.some((p) => p.reference === reference)) break;

          await prisma.payment.create({
            data: {
              invoiceId: invoice.id,
              amount: (session.amount_total ?? 0) / 100,
              method: "STRIPE",
              reference,
              date: new Date(),
            },
          });

          const paid =
            invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) +
            (session.amount_total ?? 0) / 100;
          if (paid >= Number(invoice.total)) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: "PAID" },
            });
          }
          break;
        }

        // Checkout de la suscripcion al SaaS (mode: "subscription"): enlazamos
        // el customer de Stripe con el tenant. El plan lo pone el evento de la
        // suscripcion, que puede haber llegado ya.
        const customerId = session.customer as string | null;
        const tenantId = session.metadata?.tenantId ?? session.client_reference_id;

        if (tenantId && customerId) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { stripeCustomerId: customerId },
          });
        }
        break;
      }
    }
  } catch (error) {
    // Stripe reintenta si respondemos 5xx, que es justo lo que queremos ante un
    // fallo pasajero de la base de datos.
    await reportError(error, { scope: "stripe.webhook", type: event.type });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
