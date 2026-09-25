import "server-only";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@/server/db/prisma";
import { isValidNif, normalizeNif } from "@/lib/nif";
import { breakdownByRate, classifyInvoice, exemptionProblem } from "@/lib/invoice-rules";
import {
  aeatTimestamp,
  altaHash,
  anulacionHash,
  buildAltaXml,
  buildAnulacionXml,
  invoiceNumSerie,
  qrUrl,
  type InvoiceType,
  type PreviousRecord,
  type SoftwareInfo,
} from "@/lib/verifactu";


export function verifactuEnv(): "test" | "prod" {
  return process.env.VERIFACTU_ENV === "prod" ? "prod" : "test";
}

/**
 * Datos del sistema informatico que declara cada registro. El productor es
 * quien comercializa Relincho: hasta que exista la sociedad, se configuran por
 * entorno y el registro queda marcado para revisar antes del envio.
 */
function softwareInfo(): SoftwareInfo {
  return {
    producerName: process.env.VERIFACTU_PRODUCER_NAME ?? "Relincho",
    producerNif: process.env.VERIFACTU_PRODUCER_NIF ?? "PENDIENTE",
    systemName: "Relincho",
    systemId: "RL",
    version: process.env.VERIFACTU_SYSTEM_VERSION ?? "1.0",
    installation: process.env.VERIFACTU_INSTALLATION ?? "1",
  };
}

/** Ultimo registro de la cadena de este emisor (altas y anulaciones). */
async function previousRecord(tx: PrismaClient, tenantId: string): Promise<PreviousRecord> {
  const last = await tx.verifactuRecord.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { invoice: { select: { series: true, number: true, issueDate: true } } },
  });
  if (!last || last.invoice.number == null) return null;
  return {
    issuerNif: "",
    numSerie: invoiceNumSerie(last.invoice.series, last.invoice.number),
    issueDate: last.invoice.issueDate,
    hash: last.hash,
  };
}

/**
 * Bloquea la cadena del emisor: dos emisiones a la vez esperan turno, asi cada
 * registro enlaza con el anterior de verdad y no dos con el mismo.
 */
async function lockChain(tx: PrismaClient, tenantId: string) {
  await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`;
}

async function lockSeriesCounter(tx: PrismaClient, seriesId: string) {
  const rows = await tx.$queryRaw<{ nextNumber: number }[]>`
    SELECT "nextNumber" FROM "InvoiceSeries" WHERE id = ${seriesId} FOR UPDATE`;
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Serie no encontrada" });
  return Number(rows[0].nextNumber);
}

function bad(message: string): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}

/**
 * Emite un borrador: valida los datos fiscales, asigna numero y fecha, fija el
 * tipo (completa, simplificada o rectificativa), encadena la huella y deja el
 * registro Veri*Factu listo para enviar. Todo en la transaccion del llamante.
 */
export async function issueInvoice(tx: PrismaClient, tenantId: string, invoiceId: string) {
  await lockChain(tx, tenantId);

  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      tenant: true,
      client: true,
      lines: true,
      invoiceSeries: true,
      rectifies: { select: { series: true, number: true, issueDate: true, subtotal: true, vatTotal: true } },
    },
  });
  if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
  if (invoice.status !== "DRAFT") bad("Esta factura ya está emitida");
  if (invoice.lines.length === 0) bad("La factura no tiene líneas");

  // Emisor: sin NIF valido y nombre fiscal no hay factura legal.
  const issuerNif = invoice.tenant.nif ? normalizeNif(invoice.tenant.nif) : "";
  if (!issuerNif || !isValidNif(issuerNif)) {
    bad("Falta el NIF de la yeguada o no es válido. Complétalo en Ajustes antes de emitir.");
  }
  const issuerName = invoice.tenant.fiscalName || invoice.tenant.name;
  if (!invoice.tenant.address) bad("Falta la dirección fiscal de la yeguada. Complétala en Ajustes.");

  const total = Number(invoice.total);
  const clientNif = invoice.client.nif ? normalizeNif(invoice.client.nif) : "";
  const hasClientNif = clientNif !== "" && isValidNif(clientNif);

  const classified = classifyInvoice({
    isRectification: Boolean(invoice.rectifiesId),
    storedType: invoice.invoiceType,
    hasClientNif,
    total,
  });
  if ("error" in classified) bad(classified.error);
  const invoiceType: InvoiceType = classified.type;
  if (invoiceType.startsWith("R") && !hasClientNif && !invoice.rectifies) {
    bad("Rectificativa sin factura original");
  }

  // Numero y fecha al emitir. Un borrador antiguo que ya traia numero lo conserva.
  if (!invoice.seriesId || !invoice.invoiceSeries) bad("La factura no tiene serie");
  const series = invoice.invoiceSeries;
  let number = invoice.number;
  const counter = await lockSeriesCounter(tx, series.id);
  if (number == null) {
    number = counter;
    await tx.invoiceSeries.update({ where: { id: series.id }, data: { nextNumber: counter + 1 } });
  }
  const issueDate = new Date();
  const numSerie = invoiceNumSerie(invoice.series, number);

  const lineData = invoice.lines.map((l) => ({
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    vatRate: Number(l.vatRate),
    exemptionCause: l.exemptionCause,
  }));
  for (const l of lineData) {
    const problem = exemptionProblem(l);
    if (problem) bad(`«${l.description}»: ${problem}`);
  }
  const breakdown = breakdownByRate(lineData);

  const prev = await previousRecord(tx, tenantId);
  if (prev) prev.issuerNif = issuerNif;
  const generatedAt = aeatTimestamp(new Date());
  const vatTotal = Number(invoice.vatTotal);
  const hash = altaHash({
    issuerNif,
    numSerie,
    issueDate,
    invoiceType,
    vatTotal,
    total,
    prevHash: prev?.hash ?? null,
    generatedAt,
  });

  const rect =
    invoice.rectifies && invoice.rectifies.number != null
      ? {
          kind: (invoice.rectificationKind === "S" ? "S" : "I") as "S" | "I",
          original: {
            numSerie: invoiceNumSerie(invoice.rectifies.series, invoice.rectifies.number),
            issueDate: invoice.rectifies.issueDate,
          },
          replaced:
            invoice.rectificationKind === "S"
              ? { base: Number(invoice.rectifies.subtotal), vat: Number(invoice.rectifies.vatTotal) }
              : undefined,
        }
      : undefined;

  const payload = buildAltaXml({
    issuerNif,
    issuerName,
    numSerie,
    issueDate,
    invoiceType,
    vatTotal,
    total,
    prevHash: prev?.hash ?? null,
    generatedAt,
    hash,
    description: invoice.lines.map((l) => l.description).join("; "),
    recipient: hasClientNif ? { name: invoice.client.name, nif: clientNif } : null,
    breakdown,
    prev,
    software: softwareInfo(),
    rectification: rect,
  });

  await tx.verifactuRecord.create({
    data: { tenantId, invoiceId: invoice.id, kind: "ALTA", hash, prevHash: prev?.hash ?? null, generatedAt, payload },
  });

  return tx.invoice.update({
    where: { id: invoice.id },
    data: {
      number,
      issueDate,
      dueDate: invoice.dueDate && invoice.dueDate > issueDate ? invoice.dueDate : new Date(issueDate.getTime() + 30 * 864e5),
      status: "ISSUED",
      invoiceType,
      verifactuMode: "VERIFACTU",
      verifactuHash: hash,
      verifactuPrevHash: prev?.hash ?? null,
      verifactuQrUrl: qrUrl({ issuerNif, numSerie, issueDate, total, env: verifactuEnv() }),
    },
  });
}

/**
 * Anulacion Veri*Factu: para una factura emitida por error (duplicada, a quien
 * no era). No es la via para corregir importes: eso es una rectificativa.
 */
export async function voidInvoice(tx: PrismaClient, tenantId: string, invoiceId: string) {
  await lockChain(tx, tenantId);
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { tenant: true, _count: { select: { payments: true, rectifiedBy: true } } },
  });
  if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
  if (invoice.status === "DRAFT") bad("Un borrador no se anula: se borra o se edita");
  if (invoice.status === "CANCELLED") bad("Esta factura ya está anulada");
  if (invoice._count.payments > 0) bad("Tiene cobros registrados: corrígela con una rectificativa");
  if (invoice._count.rectifiedBy > 0) bad("Ya tiene rectificativas: no se puede anular");
  if (invoice.number == null) bad("Factura sin número");

  // Las emitidas antes de Veri*Factu no tienen registro de alta: se anulan sin cadena.
  const hasAlta = await tx.verifactuRecord.count({ where: { invoiceId, kind: "ALTA" } });
  if (hasAlta) {
    const issuerNif = normalizeNif(invoice.tenant.nif ?? "");
    const numSerie = invoiceNumSerie(invoice.series, invoice.number);
    const prev = await previousRecord(tx, tenantId);
    if (prev) prev.issuerNif = issuerNif;
    const generatedAt = aeatTimestamp(new Date());
    const hash = anulacionHash({
      issuerNif,
      numSerie,
      issueDate: invoice.issueDate,
      prevHash: prev?.hash ?? null,
      generatedAt,
    });
    const payload = buildAnulacionXml({
      issuerNif,
      numSerie,
      issueDate: invoice.issueDate,
      prevHash: prev?.hash ?? null,
      generatedAt,
      hash,
      prev,
      software: softwareInfo(),
    });
    await tx.verifactuRecord.create({
      data: { tenantId, invoiceId, kind: "ANULACION", hash, prevHash: prev?.hash ?? null, generatedAt, payload },
    });
  }
  return tx.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED" } });
}
