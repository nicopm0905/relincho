import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { createServerCaller } from "@/lib/trpc/server";
import { invoicePdfInclude, renderInvoicePdf } from "@/server/services/billing/invoice-pdf";

export const dynamic = "force-dynamic";

/**
 * `/api` queda fuera del middleware de sesion: esta ruta tiene que decidir por
 * si misma. Antes servia el PDF de cualquier factura a quien tuviera el enlace,
 * con NIF, importes y datos del cliente.
 *
 * Se apoya en los mismos procedimientos de tRPC que las pantallas, para no
 * duplicar reglas: el personal de la yeguada ve sus facturas
 * (`invoices.byId`), el propietario externo solo las suyas (`portal.myInvoices`)
 * y la demo publica sigue abierta en solo lectura.
 */
async function canReadInvoice(id: string) {
  if (!z.string().uuid().safeParse(id).success) return false;
  const found = await prisma.invoice.findUnique({
    where: { id },
    select: { tenant: { select: { slug: true } } },
  });
  if (!found) return false;

  const caller = await createServerCaller(found.tenant.slug);
  const staff = await caller.invoices.byId({ id }).then(
    () => true,
    () => false,
  );
  if (staff) return true;

  const mine = await caller.portal.myInvoices().catch(() => []);
  return mine.some((invoice) => invoice.id === id);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!(await canReadInvoice(id))) {
      // 404 y no 403: a quien no tiene acceso no le confirmamos que exista.
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoicePdfInclude });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { buffer: pdfBuffer, label } = await renderInvoicePdf(invoice);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="factura-${label}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
