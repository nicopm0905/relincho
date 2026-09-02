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
