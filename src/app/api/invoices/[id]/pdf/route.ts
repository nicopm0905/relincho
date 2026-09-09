import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        lines: true,
        tenant: true,
        invoiceSeries: true,
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

    // Encabezado
    doc.fontSize(20).text(invoice.tenant.name, { align: "right" });
    doc.fontSize(10).text(`NIF: ${invoice.tenant.nif || ""}`, { align: "right" });
    doc.moveDown();

    // Título factura
    // `invoice.series` guarda ya la etiqueta prefijo+año de la serie.
    const seriesPrefix = invoice.invoiceSeries?.prefix
      ? (invoice.series || invoice.invoiceSeries.prefix)
      : invoice.series;
    doc.fontSize(24).text("FACTURA", { align: "left" });
    doc.fontSize(12).text(`Nº ${seriesPrefix}-${invoice.number.toString().padStart(4, '0')}`);
    doc.text(`Fecha de emisión: ${invoice.issueDate.toLocaleDateString('es-ES')}`);
    if (invoice.dueDate) {
      doc.text(`Fecha de vencimiento: ${invoice.dueDate.toLocaleDateString('es-ES')}`);
    }
    doc.moveDown(2);

    // Veri*Factu (fase posterior): aquí irán el código QR y la huella SHA-256 encadenada.

    // Datos Cliente
    doc.fontSize(14).text("Facturado a:");
    doc.fontSize(12).text(invoice.client.name);
    if (invoice.client.nif) doc.text(`NIF: ${invoice.client.nif}`);
    if (invoice.client.email) doc.text(invoice.client.email);
    doc.moveDown(2);

    // Tabla de líneas
    const tableTop = doc.y;
    doc.font("Helvetica-Bold");
    doc.text("Descripción", 50, tableTop);
    doc.text("Cant.", 300, tableTop, { width: 50, align: "right" });
    doc.text("Precio U.", 350, tableTop, { width: 80, align: "right" });
    doc.text("Total", 450, tableTop, { width: 80, align: "right" });
    
    doc.moveTo(50, tableTop + 15).lineTo(530, tableTop + 15).stroke();
    
    let y = tableTop + 25;
    doc.font("Helvetica");

    for (const line of invoice.lines) {
      const lineTotal = Number(line.quantity) * Number(line.unitPrice);
      doc.text(line.description, 50, y);
      doc.text(line.quantity.toString(), 300, y, { width: 50, align: "right" });
      doc.text(`${Number(line.unitPrice).toFixed(2)} €`, 350, y, { width: 80, align: "right" });
      doc.text(`${lineTotal.toFixed(2)} €`, 450, y, { width: 80, align: "right" });
      y += 20;
    }

    doc.moveTo(50, y + 10).lineTo(530, y + 10).stroke();
    
    // Totales
    y += 25;
    doc.font("Helvetica-Bold");
    doc.text("Subtotal:", 350, y, { width: 80, align: "right" });
    doc.text(`${Number(invoice.subtotal).toFixed(2)} €`, 450, y, { width: 80, align: "right" });
    y += 20;
    doc.text("IVA:", 350, y, { width: 80, align: "right" });
    doc.text(`${Number(invoice.vatTotal).toFixed(2)} €`, 450, y, { width: 80, align: "right" });
    y += 20;
    doc.fontSize(14).text("Total Factura:", 300, y, { width: 130, align: "right" });
    doc.text(`${Number(invoice.total).toFixed(2)} €`, 450, y, { width: 80, align: "right" });

    doc.end();

    const pdfBuffer = await pdfPromise;

    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="factura-${invoice.series}-${invoice.number}.pdf"`,
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
