"use server";

import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/utils";

/**
 * Pago online de una factura desde el portal del propietario externo.
 *
 * Crea una Stripe Checkout Session en modo `payment` por el importe `total` de
 * la factura y redirige a Stripe. Si Stripe no está configurado
 * (`STRIPE_SECRET_KEY` ausente) lanza un error legible y el botón del portal se
 * muestra deshabilitado (ver PayInvoiceButton).
 *
 * TODO(fase0): la verificación de rol/acceso es un guard ligero propio;
 * sustituir por el helper de acceso por caballo / roleProcedure(OWNER_EXTERNAL)
 * cuando esté disponible.
 */
export async function createInvoiceCheckoutSession(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const tenantSlug = String(formData.get("tenantSlug") ?? "");
  if (!invoiceId || !tenantSlug) throw new Error("Datos de pago incompletos");

  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) throw new Error("Finca no encontrada");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: { userId: session.user.id, tenantId: tenant.id },
    },
    select: { id: true, role: true },
  });
  if (!membership || membership.role !== Role.OWNER_EXTERNAL) {
    throw new Error("No autorizado");
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: tenant.id },
    include: { lines: { select: { horseId: true } } },
  });
  if (!invoice) throw new Error("Factura no encontrada");
  if (invoice.status !== "ISSUED" && invoice.status !== "OVERDUE") {
    throw new Error("Esta factura no admite pago");
  }

  // Comprobación de propiedad: la factura es de un caballo del miembro, o su
  // cliente es un Contact con el email del usuario.
  const myHorses = await prisma.horse.findMany({
    where: {
      tenantId: tenant.id,
      horseAccess: { some: { membershipId: membership.id } },
    },
    select: { id: true },
  });
  const myHorseIds = new Set(myHorses.map((h) => h.id));
  const ownedByHorse = invoice.lines.some(
    (l) => l.horseId && myHorseIds.has(l.horseId),
  );
  const ownedByContact = session.user.email
    ? Boolean(
        await prisma.contact.findFirst({
          where: {
            tenantId: tenant.id,
            id: invoice.clientId,
            email: session.user.email,
          },
          select: { id: true },
        }),
      )
    : false;
  if (!ownedByHorse && !ownedByContact) throw new Error("No autorizado");

  if (!process.env.STRIPE_SECRET_KEY) {
    // TODO(stripe): configurar STRIPE_SECRET_KEY para habilitar el pago online
    throw new Error("El pago online todavía no está disponible");
  }

  const amountCents = Math.round(Number(invoice.total) * 100);
  const invoiceRef = `${invoice.series}-${String(invoice.number).padStart(4, "0")}`;

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: { name: `Factura ${invoiceRef}` },
        },
      },
    ],
    customer_email: session.user.email ?? undefined,
    metadata: {
      kind: "portal_invoice_payment",
      invoiceId: invoice.id,
      tenantId: tenant.id,
    },
    success_url: `${getBaseUrl()}/${tenantSlug}/portal/facturas?pago=ok`,
    cancel_url: `${getBaseUrl()}/${tenantSlug}/portal/facturas?pago=cancelado`,
    locale: "es",
  });

  redirect(checkout.url!);
}
