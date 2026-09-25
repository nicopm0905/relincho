import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { Prisma } from "@prisma/client";
import { invoiceLabel } from "@/lib/invoice-label";
import { EXEMPTION_CAUSES, breakdownByRate, isExemptionCause } from "@/lib/invoice-rules";
import { formatIban } from "@/lib/iban";

/** Lo que hace falta de la factura para dibujarla. Lo comparten la ruta del PDF y el envio por email. */
export const invoicePdfInclude = {
  client: true,
  lines: true,
  tenant: true,
  invoiceSeries: true,
  rectifies: { select: { series: true, number: true, issueDate: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceForPdf = Prisma.InvoiceGetPayload<{ include: typeof invoicePdfInclude }>;

const PAGE_BOTTOM = 730;
const PAGE_TOP = 60;

const euro = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const day = (d: Date) => d.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });

export async function renderInvoicePdf(invoice: InvoiceForPdf): Promise<{ buffer: Buffer; label: string }> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Uint8Array[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const draft = invoice.status === "DRAFT";
  const label = invoiceLabel(invoice);
  const t = invoice.tenant;

  // Marca de agua: un borrador no se puede confundir con una factura.
  const watermark = () => {
    if (!draft) return;
    doc.save();
    doc.rotate(-40, { origin: [300, 420] });
    doc.fillColor("#b45309").fillOpacity(0.09).font("Helvetica-Bold").fontSize(110);
    doc.text("BORRADOR", 40, 370, { width: 520, align: "center", lineBreak: false });
    doc.restore();
    doc.fillOpacity(1).fillColor("#000000");
    // Dibujar el texto mueve el cursor: hay que devolverlo al inicio de la pagina.
    doc.x = 50;
    doc.y = 50;
  };
  watermark();
  doc.on("pageAdded", watermark);

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
  doc.text(`Fecha de expedición: ${draft ? "se asigna al emitir" : day(invoice.issueDate)}`);
  if (invoice.dueDate && !draft) doc.text(`Vencimiento: ${day(invoice.dueDate)}`);
  if (invoice.status === "CANCELLED") {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#b91c1c").font("Helvetica-Bold").text("FACTURA ANULADA");
    doc.fillColor("#000000").font("Helvetica");
  }
  if (invoice.rectifies) {
    doc.moveDown(0.5);
    doc.fontSize(10).text(
      `Rectifica la factura ${invoiceLabel(invoice.rectifies)} del ${day(invoice.rectifies.issueDate)}` +
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
  const header = (top: number) => {
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Descripción", 50, top);
    doc.text("Cant.", 290, top, { width: 40, align: "right" });
    doc.text("Precio", 335, top, { width: 65, align: "right" });
    doc.text("IVA", 405, top, { width: 40, align: "right" });
    doc.text("Base", 450, top, { width: 80, align: "right" });
    doc.moveTo(50, top + 15).lineTo(530, top + 15).stroke();
    doc.font("Helvetica");
  };
  const tableTop = doc.y;
  header(tableTop);

  let y = tableTop + 25;
  for (const line of invoice.lines) {
    const base = Math.round(Number(line.quantity) * Number(line.unitPrice) * 100) / 100;
    const height = doc.heightOfString(line.description, { width: 235 });
    // Sin este salto las lineas de una factura larga se salian de la pagina.
    if (y + height > PAGE_BOTTOM) {
      doc.addPage();
      header(PAGE_TOP);
      y = PAGE_TOP + 25;
    }
    doc.text(line.description, 50, y, { width: 235 });
    doc.text(Number(line.quantity).toString(), 290, y, { width: 40, align: "right" });
    doc.text(euro(Number(line.unitPrice)), 335, y, { width: 65, align: "right" });
    doc.text(line.exemptionCause ? `Exento ${line.exemptionCause}` : `${Number(line.vatRate)}%`, 400, y, { width: 45, align: "right" });
    doc.text(euro(base), 450, y, { width: 80, align: "right" });
    y += Math.max(18, height + 6);
  }
  doc.moveTo(50, y + 4).lineTo(530, y + 4).stroke();

  // Desglose por tipo de IVA (obligatorio si hay varios) y totales. Se reserva
  // el espacio entero para que no se parta el bloque de totales.
  const breakdown = breakdownByRate(
    invoice.lines.map((l) => ({
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      vatRate: Number(l.vatRate),
      exemptionCause: l.exemptionCause,
    })),
  ).sort((a, b) => b.vatRate - a.vatRate);
  y += 16;
  if (y + breakdown.length * 16 + 90 > PAGE_BOTTOM) {
    doc.addPage();
    y = PAGE_TOP;
  }
  doc.font("Helvetica").fontSize(10);
  for (const b of breakdown) {
    doc.text(
      b.exemption ? `Base exenta (${b.exemption}): ${euro(b.base)}` : `Base al ${b.vatRate}%: ${euro(b.base)}  ·  Cuota: ${euro(b.vat)}`,
      250,
      y,
      { width: 280, align: "right" },
    );
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
  doc.font("Helvetica").fontSize(8).fillColor("#555555");

  // Motivo de cada exencion: la factura tiene que decir por que no lleva IVA.
  const causes = [...new Set(breakdown.map((b) => b.exemption).filter(isExemptionCause))];
  for (const cause of causes) {
    y += 14;
    doc.text(`${cause}: ${EXEMPTION_CAUSES[cause]}`, 50, y + 8, { width: 480 });
  }
  doc.fillColor("#000000");

  // Como pagar: solo en una factura viva (ni borrador, ni anulada, ni rectificativa).
  const payable = !draft && invoice.status !== "CANCELLED" && !invoice.rectifiesId;
  if (payable && (t.iban || t.paymentTerms)) {
    y += 34;
    if (y + 50 > PAGE_BOTTOM) {
      doc.addPage();
      y = PAGE_TOP;
    }
    doc.font("Helvetica-Bold").fontSize(10).text("Forma de pago", 50, y);
    doc.font("Helvetica").fontSize(9);
    if (t.iban) doc.text(`Transferencia a la cuenta ${formatIban(t.iban)} (indica el número de factura)`, 50, y + 14, { width: 480 });
    if (t.paymentTerms) doc.text(t.paymentTerms, 50, y + (t.iban ? 27 : 14), { width: 480 });
  }

  // QR tributario (Veri*Factu): solo en facturas emitidas con registro.
  if (!draft && invoice.verifactuQrUrl) {
    const qr = await QRCode.toBuffer(invoice.verifactuQrUrl, { errorCorrectionLevel: "M", margin: 1, width: 240 });
    let qrY = Math.max(y + 40, 600);
    if (qrY + 100 > 810) {
      doc.addPage();
      qrY = PAGE_TOP;
    }
    doc.image(qr, 50, qrY, { width: 90 });
    doc.font("Helvetica-Bold").fontSize(10).text("QR tributario", 150, qrY + 8);
    doc.font("Helvetica").fontSize(9).text("VERI*FACTU", 150, qrY + 24);
    doc.fontSize(8).fillColor("#555555").text("Factura verificable en la sede electrónica de la AEAT", 150, qrY + 40, { width: 300 });
    doc.fillColor("#000000");
  }

  doc.end();
  return { buffer: await done, label };
}
