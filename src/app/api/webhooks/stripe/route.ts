import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/server/db/prisma";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id;
      const status = subscription.status;

      const plan = status === "active" ? getPlanByPriceId(priceId) : "starter";

      await prisma.tenant.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan, stripePriceId: priceId ?? null },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      await prisma.tenant.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan: "starter", stripePriceId: null },
      });
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

      // Checkout de la suscripción al SaaS (mode: "subscription"): sólo
      // enlazamos el customer de Stripe con el tenant.
      const customerId = session.customer as string;
      const tenantId = session.metadata?.tenantId;

      if (tenantId && customerId) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { stripeCustomerId: customerId },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function getPlanByPriceId(priceId: string | undefined): string {
  if (!priceId) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return "starter";
}
