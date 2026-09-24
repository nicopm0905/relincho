import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { createServerCaller } from "@/lib/trpc/server";
import QRCode from "qrcode";
import { invoiceLabel } from "@/lib/invoice-label";

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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        lines: true,
        tenant: true,
        invoiceSeries: true,
        rectifies: { select: { series: true, number: true, issueDate: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Uint8Array[] = [];

    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const euro = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
    const draft = invoice.status === "DRAFT";
    const label = invoiceLabel(invoice);
    const t = invoice.tenant;

    // Emisor
    doc.fontSize(18).font("Helvetica-Bold").text(t.fiscalName || t.name, { align: "right" });
    doc.fontSize(9).font("Helvetica");
    doc.text(`NIF: ${t.nif ?? "—"}`, { align: "right" });
    const issuerAddress = [t.address, [t.postalCode, t.city].filter(Boolean).join(" "), t.province]
      .filter(Boolean)
      .join(", ");
    if (issuerAddress) doc.text(issuerAddress, { align: "right" });
    doc.moveDown();

    // Titulo segun el tipo
    const title = invoice.rectifiesId
      ? "FACTURA RECTIFICATIVA"
      : invoice.invoiceType === "F2"
        ? "FACTURA SIMPLIFICADA"
        : "FACTURA";
    doc.fontSize(22).font("Helvetica-Bold").text(title);
    doc.fontSize(11).font("Helvetica");
    doc.text(`Nº ${label}`);
    doc.text(`Fecha de expedición: ${draft ? "se asigna al emitir" : invoice.issueDate.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}`);
    if (invoice.dueDate && !draft) {
      doc.text(`Vencimiento: ${invoice.dueDate.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}`);
    }
    if (invoice.rectifies) {
      doc.moveDown(0.5);
      doc.fontSize(10).text(
        `Rectifica la factura ${invoiceLabel(invoice.rectifies)} del ${invoice.rectifies.issueDate.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}` +
          ` (${invoice.rectificationKind === "S" ? "por sustitución" : "por diferencias"}).`,
      );
      if (invoice.rectificationReason) doc.text(`Motivo: ${invoice.rectificationReason}`);
    }
    if (draft) {
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#b45309").font("Helvetica-Bold").text("BORRADOR — sin validez fiscal hasta su emisión");
      doc.fillColor("#000000").font("Helvetica");
    }
    doc.moveDown(1.5);

    // Destinatario
    doc.fontSize(12).font("Helvetica-Bold").text("Destinatario");
    doc.fontSize(10).font("Helvetica").text(invoice.client.name);
    if (invoice.client.nif) doc.text(`NIF: ${invoice.client.nif}`);
    if (invoice.client.address) doc.text(invoice.client.address);
    doc.moveDown(1.5);

    // Lineas
    const tableTop = doc.y;
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Descripción", 50, tableTop);
    doc.text("Cant.", 290, tableTop, { width: 40, align: "right" });
    doc.text("Precio", 335, tableTop, { width: 65, align: "right" });
    doc.text("IVA", 405, tableTop, { width: 40, align: "right" });
    doc.text("Base", 450, tableTop, { width: 80, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(530, tableTop + 15).stroke();

    let y = tableTop + 25;
    doc.font("Helvetica");
    const byRate = new Map<number, { base: number; vat: number }>();
    for (const line of invoice.lines) {
      const base = Math.round(Number(line.quantity) * Number(line.unitPrice) * 100) / 100;
      const rate = Number(line.vatRate);
      const acc = byRate.get(rate) ?? { base: 0, vat: 0 };
      acc.base += base;
      acc.vat += Math.round(base * rate) / 100;
      byRate.set(rate, acc);
      const height = doc.heightOfString(line.description, { width: 235 });
      doc.text(line.description, 50, y, { width: 235 });
      doc.text(Number(line.quantity).toString(), 290, y, { width: 40, align: "right" });
      doc.text(euro(Number(line.unitPrice)), 335, y, { width: 65, align: "right" });
      doc.text(`${rate}%`, 405, y, { width: 40, align: "right" });
      doc.text(euro(base), 450, y, { width: 80, align: "right" });
      y += Math.max(18, height + 6);
    }
    doc.moveTo(50, y + 4).lineTo(530, y + 4).stroke();

    // Desglose por tipo de IVA (obligatorio si hay varios) y totales
    y += 16;
    doc.font("Helvetica").fontSize(10);
    for (const [rate, v] of [...byRate.entries()].sort((a, b) => b[0] - a[0])) {
      doc.text(`Base al ${rate}%: ${euro(v.base)}  ·  Cuota: ${euro(v.vat)}`, 250, y, { width: 280, align: "right" });
      y += 16;
    }
    y += 4;
    doc.font("Helvetica-Bold");
    doc.text("Base imponible:", 330, y, { width: 110, align: "right" });
    doc.text(euro(Number(invoice.subtotal)), 450, y, { width: 80, align: "right" });
    y += 16;
    doc.text("Cuota IVA:", 330, y, { width: 110, align: "right" });
    doc.text(euro(Number(invoice.vatTotal)), 450, y, { width: 80, align: "right" });
    y += 20;
    doc.fontSize(13).text("Total:", 330, y, { width: 110, align: "right" });
    doc.text(euro(Number(invoice.total)), 440, y, { width: 90, align: "right" });

    // QR tributario (Veri*Factu): solo en facturas emitidas con registro.
    if (!draft && invoice.verifactuQrUrl) {
      const qr = await QRCode.toBuffer(invoice.verifactuQrUrl, { errorCorrectionLevel: "M", margin: 1, width: 240 });
      const qrY = Math.max(y + 40, 600);
      doc.image(qr, 50, qrY, { width: 90 });
      doc.font("Helvetica-Bold").fontSize(10).text("QR tributario", 150, qrY + 8);
      doc.font("Helvetica").fontSize(9).text("VERI*FACTU", 150, qrY + 24);
      doc.fontSize(8).fillColor("#555555").text(
        "Factura verificable en la sede electrónica de la AEAT",
        150,
        qrY + 40,
        { width: 300 },
      );
      doc.fillColor("#000000");
    }

    doc.end();

    const pdfBuffer = await pdfPromise;

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
