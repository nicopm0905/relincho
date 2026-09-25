import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { createServerCaller } from "@/lib/trpc/server";
import { RETENTION_YEARS, bookPeriod, withdrawalEndDate } from "@/lib/treatments";

export const dynamic = "force-dynamic";

/**
 * Libro de registro de tratamientos veterinarios en PDF (RD 666/2023, art. 41),
 * listo para enseñar en una inspección.
 *
 * `/api` queda fuera del middleware de sesión: los permisos los decide el
 * procedimiento `health.treatmentBook`, igual que en la pantalla. Quien no
 * puede leer el libro recibe un 404.
 */

type Caller = Awaited<ReturnType<typeof createServerCaller>>;
type Book = Awaited<ReturnType<Caller["health"]["treatmentBook"]>>;
type Row = Book["treatments"][number];

const TYPE_LABELS: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  TREATMENT: "Tratamiento",
  VET_CHECKUP: "Revisión",
};

const MARGIN = 32;
const INK = "#14160F";
const MUTED = "#5b5f52";
const RULE = "#c9ccbf";
const HEAD_BG = "#eef0e6";

const day = (date: Date) => format(date, "dd/MM/yyyy");
const dash = (value: string | null | undefined) => (value && value.trim() ? value : "—");

function horseCell(horse: Row["horse"]) {
  const lines = [horse.name];
  if (horse.uelnCode) lines.push(`UELN ${horse.uelnCode}`);
  if (horse.microchip) lines.push(`Chip ${horse.microchip}`);
  if (!horse.uelnCode && !horse.microchip) lines.push("Sin identificación");
  if (horse.excludedFromFoodChain) lines.push("Excluido de consumo");
  return lines.join("\n");
}

function withdrawalCell(row: Row) {
  if (row.withdrawalDays == null) return "—";
  const days = `${row.withdrawalDays} d`;
  if (row.horse.excludedFromFoodChain) return `${days}\n(no aplica)`;
  const end = withdrawalEndDate(row);
  return end ? `${days}\nhasta ${day(end)}` : days;
}

function purchaseCell(row: Row) {
  const parts = [row.supplier, row.purchaseReference ? `Fact./alb. ${row.purchaseReference}` : null].filter(
    Boolean,
  );
  return parts.length ? parts.join("\n") : "—";
}

function vetCell(row: Row) {
  if (!row.vet) return "—";
  return [row.vet.name, row.vet.phone].filter(Boolean).join("\n");
}

interface Column<T> {
  title: string;
  width: number;
  value: (row: T) => string;
}

/**
 * Tabla con filas de alto variable y cabecera repetida en cada página. pdfkit
 * no trae tablas: se mide cada celda con `heightOfString` y se salta de página
 * antes de pintar una fila que no cabe.
 */
function drawTable<T>(doc: PDFKit.PDFDocument, columns: Column<T>[], rows: T[], minRowHeight = 0) {
  const bottom = () => doc.page.height - MARGIN - 24;
  const pad = 4;

  const drawHeader = () => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(7.5);
    const h =
      Math.max(...columns.map((c) => doc.heightOfString(c.title, { width: c.width - pad * 2 }))) + pad * 2;
    doc.rect(MARGIN, y, columns.reduce((s, c) => s + c.width, 0), h).fill(HEAD_BG);
    let x = MARGIN;
    doc.fillColor(INK);
    for (const c of columns) {
      doc.text(c.title, x + pad, y + pad, { width: c.width - pad * 2 });
      x += c.width;
    }
    doc.y = y + h;
  };

  drawHeader();
  doc.font("Helvetica").fontSize(7.5);
  for (const row of rows) {
    const cells = columns.map((c) => c.value(row));
    const h = Math.max(
      minRowHeight,
      ...cells.map((text, i) => doc.heightOfString(text, { width: columns[i].width - pad * 2 })),
    ) + pad * 2;
    if (doc.y + h > bottom()) {
      doc.addPage();
      doc.y = MARGIN;
      drawHeader();
      doc.font("Helvetica").fontSize(7.5);
    }
    const y = doc.y;
    let x = MARGIN;
    doc.fillColor(INK);
    cells.forEach((text, i) => {
      doc.text(text, x + pad, y + pad, { width: columns[i].width - pad * 2 });
      x += columns[i].width;
    });
    doc
      .moveTo(MARGIN, y + h)
      .lineTo(x, y + h)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke();
    doc.y = y + h;
  }
}

function render(book: Book, periodLabel: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: MARGIN,
    bufferPages: true,
    info: { Title: "Libro de registro de tratamientos veterinarios", Author: book.tenant.name },
  });
  const width = doc.page.width - MARGIN * 2;
  const t = book.tenant;

  // Cabecera: quién es la explotación.
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(15).text("Libro de registro de tratamientos veterinarios");
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(`Real Decreto 666/2023, art. 41 · Se conserva ${RETENTION_YEARS} años a disposición de la autoridad competente`);
  doc.moveDown(0.6);
  const address = [t.address, t.city, t.province].filter(Boolean).join(", ");
  doc.fillColor(INK).fontSize(9);
  doc.font("Helvetica-Bold").text("Explotación: ", { continued: true }).font("Helvetica").text(t.fiscalName || t.name);
  doc
    .font("Helvetica-Bold")
    .text("Código REGA: ", { continued: true })
    .font("Helvetica")
    .text(`${dash(t.regaCode)}     `, { continued: true })
    .font("Helvetica-Bold")
    .text("NIF: ", { continued: true })
    .font("Helvetica")
    .text(dash(t.nif));
  if (address) doc.font("Helvetica-Bold").text("Dirección: ", { continued: true }).font("Helvetica").text(address);
  doc
    .font("Helvetica-Bold")
    .text("Periodo: ", { continued: true })
    .font("Helvetica")
    .text(`${periodLabel}     `, { continued: true })
    .font("Helvetica-Bold")
    .text("Emitido: ", { continued: true })
    .font("Helvetica")
    .text(format(new Date(), "dd/MM/yyyy HH:mm"));
  doc.moveDown(0.8);

  // Tratamientos. Los anchos suman el ancho útil de un A4 apaisado.
  const treatmentColumns: Column<Row>[] = [
    { title: "Fecha 1.ª administración", width: 66, value: (r) => day(r.date) },
    { title: "Animal e identificación", width: 112, value: (r) => horseCell(r.horse) },
    {
      title: "Medicamento",
      width: 120,
      value: (r) =>
        [r.name, TYPE_LABELS[r.type], r.batchNumber ? `Lote ${r.batchNumber}` : null].filter(Boolean).join("\n"),
    },
    { title: "Cantidad administrada", width: 62, value: (r) => dash(r.dose) },
    { title: "Duración", width: 44, value: (r) => (r.durationDays ? `${r.durationDays} d` : "—") },
    { title: "Tiempo de espera", width: 66, value: withdrawalCell },
    { title: "Nº receta", width: 70, value: (r) => dash(r.prescriptionNumber) },
    { title: "Veterinario prescriptor", width: 90, value: vetCell },
    { title: "Proveedor y prueba de compra", width: 0, value: purchaseCell },
  ];
  const used = treatmentColumns.reduce((s, c) => s + c.width, 0);
  treatmentColumns[treatmentColumns.length - 1].width = width - used;

  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK).text("1. Medicamentos administrados");
  doc.moveDown(0.3);
  if (book.treatments.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("Sin tratamientos registrados en el periodo.");
  } else {
    drawTable(doc, treatmentColumns, book.treatments);
  }

  // Visitas: con hueco para la firma manuscrita del veterinario.
  doc.moveDown(1.2);
  if (doc.y > doc.page.height - MARGIN - 120) {
    doc.addPage();
    doc.y = MARGIN;
  }
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK).text("2. Visitas veterinarias", MARGIN);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text("Fechadas y firmadas por el veterinario que realiza la visita.", MARGIN);
  doc.moveDown(0.3);
  type Visit = Book["visits"][number];
  const visitColumns: Column<Visit>[] = [
    { title: "Fecha", width: 70, value: (v) => day(v.date) },
    { title: "Animal", width: 150, value: (v) => horseCell(v.horse) },
    { title: "Motivo", width: 230, value: (v) => [v.name, v.notes].filter(Boolean).join("\n") },
    { title: "Veterinario", width: 150, value: vetCell },
    { title: "Firma del veterinario", width: 0, value: () => "" },
  ];
  visitColumns[visitColumns.length - 1].width = width - visitColumns.reduce((s, c) => s + c.width, 0);
  if (book.visits.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("Sin visitas registradas en el periodo.", MARGIN);
  } else {
    drawTable(doc, visitColumns, book.visits, 30);
  }

  // Pie en todas las páginas. Se escribe dentro del margen inferior: sin
  // quitarlo, pdfkit cree que no cabe y abre una hoja en blanco por cada pie.
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        `${t.fiscalName || t.name} · Libro de tratamientos · ${periodLabel} · Página ${i + 1} de ${pages.count} · Generado con Relincho`,
        MARGIN,
        doc.page.height - MARGIN - 8,
        { width, align: "center", lineBreak: false },
      );
    doc.page.margins.bottom = bottomMargin;
  }
  return doc;
}

export async function GET(req: NextRequest) {
  const tenantSlug = req.nextUrl.searchParams.get("tenant");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Falta la yeguada" }, { status: 400 });
  }
  const period = bookPeriod(req.nextUrl.searchParams.get("periodo"));

  let book: Book;
  try {
    const caller = await createServerCaller(tenantSlug);
    book = await caller.health.treatmentBook({ from: period.from, to: period.to });
  } catch {
    // 404 y no 403: a quien no tiene acceso no le confirmamos que exista.
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const doc = render(book, period.label);
  const stream = new ReadableStream({
    start(controller) {
      doc.on("data", (chunk) => controller.enqueue(chunk));
      doc.on("end", () => controller.close());
      doc.end();
    },
  });

  const filename = `libro-tratamientos-${tenantSlug}-${period.key}.pdf`;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
