import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { createServerCaller } from "@/lib/trpc/server";
import {
  BREED_CODES,
  CAUSE_CODES,
  CAUSE_LABELS,
  CENSUS_LABELS,
  DISPOSAL_METHODS,
  DOCUMENT_TYPES,
  RETENTION_YEARS,
  SEX_CODES,
  SPECIES_CODES,
  addYears,
  averageCensus,
  breedCode,
  censusAt,
  dayKey,
  presentAt,
  type CensusCategory,
  type DisposalMethod,
  type DocumentType,
} from "@/lib/farm-book";

export const dynamic = "force-dynamic";

/**
 * Libro de registro de la explotación equina en PDF, para tenerlo en la
 * explotación y enseñarlo en una inspección.
 *
 * Sigue el modelo del anexo IV de la Orden de 29/04/2015 de la Junta de
 * Andalucía (portada, hoja 1 declaración del titular, hoja 2 actualización de
 * animales, hoja 3 incidencias, hoja 4 censo, hoja 5 inspecciones) y añade lo
 * que pide el anexo IV del RD 804/2011 y no está en ese modelo: documento del
 * traslado, transportista y matrícula, personas al cuidado y animales
 * presentes con su identificación.
 *
 * Permisos: los del procedimiento `farmBook.get` (personal de la yeguada).
 */

type Caller = Awaited<ReturnType<typeof createServerCaller>>;
type Book = Awaited<ReturnType<Caller["farmBook"]["get"]>>;
type Row = Book["rows"][number];

const MARGIN = 32;
const INK = "#14160F";
const MUTED = "#5b5f52";
const RULE = "#c9ccbf";
const HEAD_BG = "#eef0e6";

const day = (date: Date | null | undefined) => (date ? format(new Date(date), "dd/MM/yyyy") : "—");
const dash = (value: string | null | undefined) => (value && String(value).trim() ? String(value) : "—");

interface Column<T> {
  title: string;
  width: number;
  value: (row: T) => string;
}

function fitColumns<T>(columns: Column<T>[], total: number): Column<T>[] {
  const used = columns.reduce((s, c) => s + c.width, 0);
  const last = columns[columns.length - 1];
  last.width = Math.max(40, total - (used - last.width));
  return columns;
}

/** Tabla con filas de alto variable y cabecera repetida en cada página. */
function drawTable<T>(doc: PDFKit.PDFDocument, columns: Column<T>[], rows: T[], minRowHeight = 0) {
  const bottom = () => doc.page.height - MARGIN - 24;
  const pad = 4;
  const drawHeader = () => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(7.2);
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
  doc.font("Helvetica").fontSize(7.2);
  for (const row of rows) {
    const cells = columns.map((c) => c.value(row));
    const h =
      Math.max(minRowHeight, ...cells.map((t, i) => doc.heightOfString(t, { width: columns[i].width - pad * 2 }))) +
      pad * 2;
    if (doc.y + h > bottom()) {
      doc.addPage();
      doc.y = MARGIN;
      drawHeader();
      doc.font("Helvetica").fontSize(7.2);
    }
    const y = doc.y;
    let x = MARGIN;
    doc.fillColor(INK);
    cells.forEach((t, i) => {
      doc.text(t, x + pad, y + pad, { width: columns[i].width - pad * 2 });
      x += columns[i].width;
    });
    doc.moveTo(MARGIN, y + h).lineTo(x, y + h).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y = y + h;
  }
}

function sheetTitle(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  doc.addPage();
  doc.y = MARGIN;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(title, MARGIN);
  if (subtitle) doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(subtitle, MARGIN);
  doc.moveDown(0.5);
}

function keyValue(doc: PDFKit.PDFDocument, pairs: [string, string][], width: number) {
  doc.fontSize(8.5);
  for (const [k, v] of pairs) {
    doc.font("Helvetica-Bold").fillColor(INK).text(`${k}: `, MARGIN, doc.y, { continued: true, width });
    doc.font("Helvetica").text(v);
  }
}

interface Period {
  from: Date | null;
  to: Date;
  label: string;
  key: string;
}

function parsePeriod(raw: string | null, now: Date): Period {
  const to = new Date(dayKey(now));
  if (raw === "todo") return { from: null, to, label: "Todo el libro", key: "completo" };
  const year = raw && /^\d{4}$/.test(raw) ? Number(raw) : null;
  if (year && year >= 2000 && year <= now.getUTCFullYear()) {
    return {
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Math.min(Date.UTC(year, 11, 31), to.getTime())),
      label: `Año ${year}`,
      key: String(year),
    };
  }
  return {
    from: addYears(to, -RETENTION_YEARS),
    to,
    label: `Últimos ${RETENTION_YEARS} años (${day(addYears(to, -RETENTION_YEARS))} – ${day(to)})`,
    key: `${RETENTION_YEARS}-anos`,
  };
}

function render(book: Book, period: Period): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: MARGIN,
    bufferPages: true,
    info: { Title: "Libro de registro de explotación de ganado equino", Author: book.farm.holderName ?? "" },
  });
  const width = doc.page.width - MARGIN * 2;
  const t = book.tenant;
  const s = book.settings;
  const horseById = new Map(book.horses.map((h) => [h.id, h]));
  const inPeriod = (d: Date) =>
    (!period.from || dayKey(new Date(d)) >= dayKey(period.from)) && dayKey(new Date(d)) <= dayKey(period.to);

  // --- Portada --------------------------------------------------------------
  doc.y = MARGIN + 40;
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
    book.andalusia
      ? "Junta de Andalucía · Consejería competente en materia de ganadería"
      : "Registro de explotación equina",
    { align: "center" },
  );
  doc.moveDown(1.5);
  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text("LIBRO DE REGISTRO DE EXPLOTACIÓN", { align: "center" });
  doc.text("DE GANADO EQUINO", { align: "center" });
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
    book.andalusia
      ? "Real Decreto 804/2011 (art. 6 y anexo IV) · Orden de 29 de abril de 2015 de la Junta de Andalucía (art. 12 y anexo IV) · Decreto 14/2006"
      : "Real Decreto 804/2011, de 10 de junio (art. 6 y anexo IV)",
    { align: "center" },
  );
  doc.moveDown(2.5);
  const boxW = 360;
  const boxX = (doc.page.width - boxW) / 2;
  const boxY = doc.y;
  doc.rect(boxX, boxY, boxW, 70).lineWidth(1).strokeColor(INK).stroke();
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("CÓDIGO DE EXPLOTACIÓN (REGA)", boxX, boxY + 12, {
    width: boxW,
    align: "center",
  });
  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text(dash(t.regaCode), boxX, boxY + 30, {
    width: boxW,
    align: "center",
  });
  doc.y = boxY + 100;
  doc.font("Helvetica").fontSize(10).fillColor(INK).text(`Titular: ${dash(book.farm.holderName)} · NIF ${dash(t.nif)}`, MARGIN, doc.y, {
    width,
    align: "center",
  });
  if (s?.farmName) doc.text(`Explotación: ${s.farmName}`, { width, align: "center" });
  doc.moveDown(0.6);
  doc.fontSize(9).fillColor(MUTED).text(
    `Periodo: ${period.label} · Emitido el ${format(new Date(), "dd/MM/yyyy HH:mm")} · Libro llevado en formato electrónico (RD 804/2011, art. 6.1)`,
    { width, align: "center" },
  );

  // --- Hoja 1: declaración inicial del titular ------------------------------
  sheetTitle(doc, "HOJA 1 · DECLARACIÓN INICIAL DEL TITULAR", "Datos del titular y de la explotación (anexo IV a-c)");
  const holderAddress = [t.address, t.postalCode, t.city, t.province, t.country].filter(Boolean).join(", ");
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text("Datos del titular", MARGIN);
  doc.moveDown(0.2);
  keyValue(
    doc,
    [
      ["Apellidos y nombre o razón social", dash(book.farm.holderName)],
      ["DNI / NIF", dash(t.nif)],
      ["Dirección", dash(holderAddress)],
      ["Teléfono", dash(s?.holderPhone)],
      ["Correo electrónico", dash(s?.holderEmail)],
      ["Representante legal", s?.legalRepName ? `${s.legalRepName} · NIF ${dash(s.legalRepNif)}` : "—"],
    ],
    width,
  );
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(9.5).text("Datos de la explotación", MARGIN);
  doc.moveDown(0.2);
  keyValue(
    doc,
    [
      ["Código REGA", dash(t.regaCode)],
      ["Nombre / paraje", dash(s?.farmName)],
      [
        "Ubicación",
        dash([s?.farmAddress, s?.farmMunicipality, s?.farmProvince].filter(Boolean).join(", ") || holderAddress),
      ],
      [
        "Coordenadas geográficas",
        s?.latitude != null && s?.longitude != null ? `${Number(s.latitude)}, ${Number(s.longitude)}` : "—",
      ],
      ["Pertenencia a ADSG", dash(s?.adsg)],
      ["Calificación sanitaria", dash(s?.sanitaryQualification)],
      ["Libro abierto en Relincho", day(s?.openedAt)],
    ],
    width,
  );
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(9.5).text("Unidades de producción", MARGIN);
  doc.moveDown(0.2);
  drawTable(
    doc,
    fitColumns<null>(
      [
        { title: "Clasificación zootécnica", width: 260, value: () => dash(s?.classification) },
        { title: "Superficie explotación (ha)", width: 150, value: () => (s?.surfaceHa != null ? String(Number(s.surfaceHa)) : "—") },
        { title: "Instalaciones (m2)", width: 150, value: () => (s?.installationsM2 != null ? String(Number(s.installationsM2)) : "—") },
        { title: "Capacidad autorizada", width: 0, value: () => (s?.capacity != null ? String(s.capacity) : "—") },
      ],
      width,
    ),
    [null],
  );
  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(8.5).fillColor(INK).text(
    "El/la titular declara que los datos son ciertos.          Firma del titular: ______________________________          Fecha: ____/____/________",
    MARGIN,
  );

  // --- Hoja 2: actualización de animales ------------------------------------
  sheetTitle(
    doc,
    "HOJA 2 · HOJA DE ACTUALIZACIÓN DE ANIMALES",
    "Altas, bajas y movimientos con documento de traslado y transporte (anexo IV d, e, g, i, j). Balance tras cada anotación.",
  );
  const periodRows = book.rows.filter((r) => inPeriod(r.date));
  const before = book.rows.filter((r) => period.from && dayKey(new Date(r.date)) < dayKey(period.from));
  const opening = before.length ? before[before.length - 1].balance : null;
  if (opening) {
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
      `Saldo al inicio del periodo: ${opening.females} hembras, ${opening.males} machos (${opening.total} animales).`,
      MARGIN,
    );
    doc.moveDown(0.3);
  }
  const movementCols: Column<Row>[] = [
    { title: "Fecha", width: 50, value: (r) => day(r.date) },
    {
      title: "Animal · Nº identificación (DIE/UELN y microchip)",
      width: 128,
      value: (r) => {
        const h = horseById.get(r.horseId);
        if (!h) return "—";
        return [h.name, h.uelnCode ? `UELN ${h.uelnCode}` : null, h.microchip ? `Chip ${h.microchip}` : null, !h.uelnCode && !h.microchip ? "Sin identificar" : null]
          .filter(Boolean)
          .join("\n");
      },
    },
    { title: "Esp.", width: 26, value: (r) => SPECIES_CODES[horseById.get(r.horseId)?.species ?? "CABALLAR"] },
    { title: "Sexo", width: 28, value: (r) => { const h = horseById.get(r.horseId); return h ? SEX_CODES[h.sex] : "—"; } },
    { title: "F. nacim.", width: 50, value: (r) => day(horseById.get(r.horseId)?.birthDate) },
    { title: "Raza", width: 32, value: (r) => breedCode(horseById.get(r.horseId)?.breed) },
    {
      title: "Propietario",
      width: 78,
      value: (r) => dash(horseById.get(r.horseId)?.owner?.name ?? book.farm.holderName),
    },
    {
      title: "Causa alta / baja",
      width: 62,
      value: (r) => `${r.direction === "IN" ? "ALTA" : "BAJA"} ${CAUSE_CODES[r.cause]}\n${CAUSE_LABELS[r.cause]}`,
    },
    {
      title: "Explotación procedencia / destino",
      width: 78,
      value: (r) => dash(r.direction === "IN" ? r.originRega : r.destinationRega),
    },
    {
      title: "Nº guía / documento · transportista y matrícula",
      width: 120,
      value: (r) =>
        [
          r.documentNumber
            ? `${r.documentType ? `${DOCUMENT_TYPES[r.documentType as DocumentType] ?? r.documentType}: ` : ""}${r.documentNumber}`
            : null,
          r.transporterName ? `Transp.: ${r.transporterName}${r.transporterId ? ` (${r.transporterId})` : ""}` : null,
          r.vehiclePlate ? `Vehículo ${r.vehiclePlate}${r.trailerPlate ? ` · remolque ${r.trailerPlate}` : ""}` : null,
        ]
          .filter(Boolean)
          .join("\n") || "—",
    },
    {
      title: "Observaciones",
      width: 80,
      value: (r) =>
        [
          r.cause === "TRASLADO_PROVISIONAL" && r.expectedReturnDate ? `Vuelta prevista ${day(r.expectedReturnDate)}` : null,
          r.cause === "MUERTE" && r.disposalMethod
            ? `${DISPOSAL_METHODS[r.disposalMethod as DisposalMethod] ?? r.disposalMethod}${r.disposalPlace ? `: ${r.disposalPlace}` : ""}`
            : null,
          r.notifiedAt ? `Baja comunicada ${day(r.notifiedAt)}` : null,
          r.reason && !/^Apertura del libro$|^Nacimiento en la explotaci/.test(r.reason) ? r.reason : null,
        ]
          .filter(Boolean)
          .join("\n") || "",
    },
    { title: "Balance H", width: 40, value: (r) => String(r.balance.females) },
    { title: "Balance M", width: 0, value: (r) => String(r.balance.males) },
  ];
  if (periodRows.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("Sin anotaciones en el periodo.", MARGIN);
  } else {
    drawTable(doc, fitColumns(movementCols, width), periodRows);
  }
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(
    [
      "Especie: (C) caballar, (A) asnal, (M) mular, (B) burdégano.  Sexo: (H) hembra, (M) macho, (MC) macho castrado.",
      `Raza: ${Object.entries(BREED_CODES).map(([k, v]) => `(${k}) ${v}`).join(", ")}.`,
      "Causas de alta: (A) apertura del libro, (N) nacimiento, (C) compra / entrada, (TP) retorno de traslado provisional.  Causas de baja: (TP) traslado provisional, (V) venta en vida, (S) sacrificio, (M) muerte.",
      "Balance: hembras (H) y machos, castrados incluidos (M), presentes tras cada anotación.",
    ].join("\n"),
    MARGIN,
    doc.y,
    { width },
  );

  // --- Hoja 3: incidencias en la identificación -----------------------------
  sheetTitle(doc, "HOJA 3 · HOJA DE INCIDENCIAS EN LA IDENTIFICACIÓN", "Anexo IV h. Causa: (A) pérdida, (B) deterioro, (C) animal procedente de otra región.");
  const CAUSE_INC: Record<string, string> = { PERDIDA: "A", DETERIORO: "B", OTRA_REGION: "C", OTRA: "Otra" };
  const incidents = book.incidents.filter((i) => inPeriod(i.date));
  if (incidents.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("Sin incidencias en el periodo.", MARGIN);
  } else {
    type Inc = (typeof incidents)[number];
    drawTable(
      doc,
      fitColumns<Inc>(
        [
          { title: "Nº", width: 30, value: (i) => String(incidents.indexOf(i) + 1) },
          { title: "Fecha", width: 70, value: (i) => day(i.date) },
          { title: "Animal", width: 140, value: (i) => i.horse.name },
          { title: "Nº identificación anterior", width: 150, value: (i) => dash(i.previousId) },
          { title: "Nº identificación nuevo", width: 150, value: (i) => `${dash(i.newId)}${i.duplicate ? "\nDUPLICADO" : ""}` },
          { title: "Causa del cambio", width: 0, value: (i) => `${CAUSE_INC[i.cause] ?? i.cause}${i.notes ? ` · ${i.notes}` : ""}` },
        ],
        width,
      ),
      incidents,
    );
  }

  // --- Hoja 4: censo ----------------------------------------------------------
  sheetTitle(
    doc,
    "HOJA 4 · CENSO",
    book.andalusia
      ? "Censo a 31 de diciembre de cada año (se declara antes del 1 de marzo, Orden 29/04/2015 art. 11.5) y censo medio anual."
      : "Censo a 31 de diciembre de cada año y censo medio anual.",
  );
  const lastYear = period.to.getUTCFullYear() - (dayKey(period.to) < Date.UTC(period.to.getUTCFullYear(), 11, 31) ? 1 : 0);
  // Desde el primer año con anotaciones (antes el libro no existía en Relincho).
  const firstBookYear = book.rows.length ? new Date(book.rows[0].date).getUTCFullYear() : lastYear + 1;
  const firstYear = Math.max(period.from ? period.from.getUTCFullYear() : firstBookYear, firstBookYear);
  const years: number[] = [];
  for (let y = firstYear; y <= lastYear; y++) years.push(y);
  type CensusRow = { year: number };
  const cats = Object.keys(CENSUS_LABELS) as CensusCategory[];
  if (years.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("Aún no ha cerrado ningún año en el periodo.", MARGIN);
  } else {
    drawTable(
      doc,
      fitColumns<CensusRow>(
        [
          { title: "Fecha", width: 80, value: ({ year }) => `31/12/${year}` },
          {
            title: "Censo total",
            width: 70,
            value: ({ year }) => String(censusAt(book.rows, book.horses, new Date(Date.UTC(year, 11, 31, 12))).total),
          },
          ...cats.map((c) => ({
            title: CENSUS_LABELS[c],
            width: 90,
            value: ({ year }: CensusRow) =>
              String(censusAt(book.rows, book.horses, new Date(Date.UTC(year, 11, 31, 12))).byCategory[c]),
          })),
          {
            title: "Censo medio del año",
            width: 0,
            value: ({ year }) => averageCensus(book.rows, year).toLocaleString("es-ES"),
          },
        ],
        width,
      ),
      years.map((year) => ({ year })),
    );
  }
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(
    "Criterio: machos y hembras enteros de 3 años o más, reproductores; menores de 3 años, reposición; castrados o sin fecha de nacimiento, otros.",
    MARGIN,
  );
  const today = censusAt(book.rows, book.horses, new Date());
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text(
    `Censo a la fecha de emisión: ${today.total} animales (${today.balance.females} hembras, ${today.balance.males} machos).`,
    MARGIN,
  );

  // --- Animales presentes ----------------------------------------------------
  sheetTitle(doc, "ANIMALES PRESENTES A LA FECHA DE EMISIÓN", "Anexo IV d y e: identificación, especie, sexo, raza y fecha de nacimiento.");
  const presentIds = presentAt(book.rows, new Date());
  const presentHorses = book.horses.filter((h) => presentIds.has(h.id));
  type H = (typeof presentHorses)[number];
  if (presentHorses.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("No hay animales presentes según el libro.", MARGIN);
  } else {
    drawTable(
      doc,
      fitColumns<H>(
        [
          { title: "Animal", width: 120, value: (h) => h.name },
          { title: "UELN (DIE)", width: 120, value: (h) => dash(h.uelnCode) },
          { title: "Microchip", width: 110, value: (h) => dash(h.microchip) },
          { title: "Especie", width: 50, value: (h) => SPECIES_CODES[h.species] },
          { title: "Sexo", width: 40, value: (h) => SEX_CODES[h.sex] },
          { title: "Raza", width: 110, value: (h) => { const c = breedCode(h.breed); return c === "X" ? `X · ${dash(h.breed)}` : `${c} · ${BREED_CODES[c]}`; } },
          { title: "F. nacimiento", width: 70, value: (h) => day(h.birthDate) },
          { title: "Propietario", width: 0, value: (h) => dash(h.owner?.name ?? book.farm.holderName) },
        ],
        width,
      ),
      presentHorses,
    );
  }

  // --- Personas al cuidado ---------------------------------------------------
  sheetTitle(doc, "PERSONAS AL CUIDADO DE LOS ANIMALES", "Anexo IV k.");
  type Ct = Book["caretakers"][number];
  if (book.caretakers.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("Sin personas anotadas.", MARGIN);
  } else {
    drawTable(
      doc,
      fitColumns<Ct>(
        [
          { title: "Nombre y apellidos", width: 200, value: (c) => c.name },
          { title: "DNI / NIE", width: 100, value: (c) => dash(c.documentId) },
          { title: "Puesto", width: 120, value: (c) => dash(c.role) },
          { title: "Teléfono", width: 100, value: (c) => dash(c.phone) },
          { title: "Periodo", width: 0, value: (c) => `${c.startDate ? `Desde ${day(c.startDate)}` : "—"}${c.endDate ? ` hasta ${day(c.endDate)}` : ""}` },
        ],
        width,
      ),
      book.caretakers,
    );
  }

  // --- Hoja 5: control e inspecciones ----------------------------------------
  sheetTitle(
    doc,
    "HOJA 5 · HOJA DE CONTROL E INSPECCIONES",
    "Anexo IV f y l. Las filas en blanco son para el personal funcionario: nombre, fecha y firma de quien comprueba el registro.",
  );
  type Ins = { date: Date | null; reason: string; actNumber: string | null; officialName: string | null };
  const inspections: Ins[] = book.inspections.filter((i) => inPeriod(i.date));
  const blanks: Ins[] = Array.from({ length: 8 }, () => ({ date: null, reason: "", actNumber: null, officialName: null }));
  drawTable(
    doc,
    fitColumns<Ins>(
      [
        { title: "Fecha", width: 80, value: (i) => (i.date ? day(i.date) : "") },
        { title: "Motivo de la inspección", width: 260, value: (i) => i.reason },
        { title: "Nº de acta", width: 100, value: (i) => (i.date ? dash(i.actNumber) : "") },
        { title: "Nombre, fecha y firma del funcionario", width: 0, value: (i) => (i.officialName ? i.officialName : "") },
      ],
      width,
    ),
    [...inspections, ...blanks],
    30,
  );

  // --- Pie en todas las páginas -----------------------------------------------
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
        `REGA ${dash(t.regaCode)} · ${dash(book.farm.holderName)} · Libro de registro de explotación · ${period.label} · Página ${i + 1} de ${pages.count} · Generado con Relincho`,
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
  if (!tenantSlug) return NextResponse.json({ error: "Falta la yeguada" }, { status: 400 });
  const period = parsePeriod(req.nextUrl.searchParams.get("periodo"), new Date());

  let book: Book;
  try {
    const caller = await createServerCaller(tenantSlug);
    book = await caller.farmBook.get();
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const doc = render(book, period);
  const stream = new ReadableStream({
    start(controller) {
      doc.on("data", (chunk) => controller.enqueue(chunk));
      doc.on("end", () => controller.close());
      doc.end();
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="libro-explotacion-${tenantSlug}-${period.key}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
