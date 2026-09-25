/**
 * Datos de prueba de facturación (F1-F3) para una yeguada existente.
 *
 *   npx tsx --conditions=react-server scripts/seed-facturacion-prueba.ts <tenantSlug> [email-del-cliente]
 *
 * Emite facturas de verdad con `issueInvoice`, así que quedan con su registro
 * Veri*Factu y NO se pueden borrar (la numeración no admite huecos): úsalo en
 * una yeguada de pruebas. Todo lo creado lleva «[Prueba]» en la descripción
 * para reconocerlo. No se ejecuta dos veces sobre la misma yeguada.
 */
import "dotenv/config";
import { prisma, withTenant } from "../src/server/db/prisma";
import { issueInvoice, voidInvoice } from "../src/server/services/billing/issue";
import { computeTotals } from "../src/lib/invoice-rules";


type Line = { description: string; quantity: number; unitPrice: number; vatRate: number; exemptionCause?: string };

const slug = process.argv[2];
const clientEmail = process.argv[3] ?? null;
if (!slug) throw new Error("Uso: seed-facturacion-prueba.ts <tenantSlug> [email-del-cliente]");

const seriesLabel = (prefix: string, year: number) => (prefix.includes(String(year)) ? prefix : `${prefix}${year}`);
const days = (n: number) => new Date(Date.now() + n * 864e5);

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`No existe la yeguada ${slug}`);
  const tenantId = tenant.id;

  const already = await prisma.invoiceLine.count({ where: { invoice: { tenantId }, description: { startsWith: "[Prueba]" } } });
  if (already > 0) throw new Error("Esta yeguada ya tiene datos de prueba de facturación; no se duplican.");

  console.log("Datos fiscales anteriores (por si hay que restaurarlos):", JSON.stringify({
    nif: tenant.nif, fiscalName: tenant.fiscalName, address: tenant.address, postalCode: tenant.postalCode,
    city: tenant.city, province: tenant.province, iban: tenant.iban, paymentTerms: tenant.paymentTerms,
  }));

  // Datos de emisor válidos (CIF de ejemplo con dígito de control correcto).
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      nif: "B12345674",
      fiscalName: tenant.fiscalName ?? `${tenant.name} S.L.`,
      address: tenant.address ?? "Camino de los Olivos, s/n",
      postalCode: tenant.postalCode ?? "11400",
      city: tenant.city ?? "Jerez de la Frontera",
      province: tenant.province ?? "Cádiz",
      iban: "ES9121000418450200051332",
      paymentTerms: "Pago a 30 días por transferencia",
    },
  });

  const withNif = await prisma.contact.create({
    data: { tenantId, kind: "CLIENT", name: "Prueba · Cliente con NIF", nif: "12345678Z", email: clientEmail, address: "Calle Larga 1, 11403 Jerez" },
  });
  const noNif = await prisma.contact.create({
    data: { tenantId, kind: "CLIENT", name: "Prueba · Cliente sin NIF", address: "Plaza del Arenal 2, Jerez" },
  });

  // Serie por defecto: la que hubiera, o una nueva.
  const series =
    (await prisma.invoiceSeries.findFirst({ where: { tenantId, isDefault: true, isRectifying: false } })) ??
    (await prisma.invoiceSeries.create({ data: { tenantId, code: "F-2026", prefix: "F", year: 2026, isDefault: true } }));
  const rectSeries =
    (await prisma.invoiceSeries.findFirst({ where: { tenantId, isRectifying: true, year: new Date().getFullYear() } })) ??
    (await prisma.invoiceSeries.create({
      data: { tenantId, code: `R-${new Date().getFullYear()}`, prefix: "R", year: new Date().getFullYear(), isRectifying: true },
    }));

  // Facturas anteriores con esa etiqueta ya ocupan numeros: el contador tiene que ir detras.
  for (const s of [series, rectSeries]) {
    const last = await prisma.invoice.findFirst({
      where: { tenantId, series: seriesLabel(s.prefix, s.year), number: { not: null } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    if (last?.number != null && s.nextNumber <= last.number) {
      s.nextNumber = last.number + 1;
      await prisma.invoiceSeries.update({ where: { id: s.id }, data: { nextNumber: s.nextNumber } });
    }
  }

  const draft = (clientId: string, lines: Line[], extra: Record<string, unknown> = {}, sid = series) =>
    withTenant(tenantId, async (tx) => {
      const totals = computeTotals(lines);
      return tx.invoice.create({
        data: {
          tenantId, clientId, seriesId: sid.id, series: seriesLabel(sid.prefix, sid.year), number: null,
          issueDate: new Date(), dueDate: days(30), status: "DRAFT",
          subtotal: totals.subtotal.toFixed(2), vatTotal: totals.vatTotal.toFixed(2), total: totals.total.toFixed(2),
          lines: {
            create: lines.map((l) => ({
              description: l.description, quantity: l.quantity.toFixed(2), unitPrice: l.unitPrice.toFixed(2),
              vatRate: l.vatRate.toFixed(2), exemptionCause: l.exemptionCause ?? null,
            })),
          },
          ...extra,
        },
      });
    });
  const issue = (id: string) => withTenant(tenantId, (tx) => issueInvoice(tx, tenantId, id));
  const pay = (invoiceId: string, amount: number, status?: "PAID") =>
    withTenant(tenantId, async (tx) => {
      await tx.payment.create({ data: { invoiceId, amount: amount.toFixed(2), date: new Date(), method: "TRANSFER", reference: "[Prueba]" } });
      if (status) await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
    });
  const rectify = async (originalId: string, clientId: string, lines: Line[], reason: string) => {
    const r = await draft(
      clientId, lines,
      { invoiceType: "R4", rectifiesId: originalId, rectificationKind: "I", rectificationReason: reason },
      rectSeries,
    );
    return issue(r.id);
  };

  // A · emitida, sin cobrar, con línea exenta (para ver PDF, IBAN, exención y probar el email)
  const a = await issue((await draft(withNif.id, [
    { description: "[Prueba] Pupilaje septiembre", quantity: 1, unitPrice: 450, vatRate: 21 },
    { description: "[Prueba] Servicio de transporte exento", quantity: 1, unitPrice: 100, vatRate: 0, exemptionCause: "E1" },
  ])).id);
  // B · emitida con cobro parcial y dos tipos de IVA
  const b = await issue((await draft(withNif.id, [
    { description: "[Prueba] Herrado y recorte", quantity: 1, unitPrice: 300, vatRate: 21 },
    { description: "[Prueba] Forraje", quantity: 1, unitPrice: 80, vatRate: 10 },
  ])).id);
  await pay(b.id, 200);
  // C · cobrada y rectificada a la baja -> «A devolver»
  const c = await issue((await draft(withNif.id, [{ description: "[Prueba] Doma básica (10 sesiones)", quantity: 1, unitPrice: 200, vatRate: 21 }])).id);
  await pay(c.id, 242, "PAID");
  await rectify(c.id, withNif.id, [{ description: "[Prueba] Descuento pactado", quantity: 1, unitPrice: -50, vatRate: 21 }], "Descuento pactado con el cliente");
  // D · anulada del todo por una rectificativa
  const d = await issue((await draft(withNif.id, [{ description: "[Prueba] Pupilaje facturado por error", quantity: 1, unitPrice: 200, vatRate: 21 }])).id);
  await rectify(d.id, withNif.id, [{ description: "[Prueba] Anulación: pupilaje facturado por error", quantity: 1, unitPrice: -200, vatRate: 21 }], "Se facturó dos veces");
  // E · anulada con registro de anulación (duplicada)
  const e = await issue((await draft(withNif.id, [{ description: "[Prueba] Factura duplicada", quantity: 1, unitPrice: 100, vatRate: 21 }])).id);
  await withTenant(tenantId, (tx) => voidInvoice(tx, tenantId, e.id));
  // F · simplificada (F2): cliente sin NIF y por debajo de 400 €
  await issue((await draft(noNif.id, [{ description: "[Prueba] Clase suelta de equitación", quantity: 1, unitPrice: 120, vatRate: 21 }])).id);
  // H · vencida
  const h = await issue((await draft(withNif.id, [{ description: "[Prueba] Pupilaje agosto (vencida)", quantity: 1, unitPrice: 80, vatRate: 21 }])).id);
  await withTenant(tenantId, (tx) => tx.invoice.update({ where: { id: h.id }, data: { status: "OVERDUE", dueDate: days(-10) } }));

  // Borradores: uno editable y otro que no se puede emitir (0 % sin causa)
  await draft(withNif.id, [
    { description: "[Prueba] Borrador editable: pupilaje octubre", quantity: 1, unitPrice: 450, vatRate: 21 },
    { description: "[Prueba] Extra: alfalfa", quantity: 3, unitPrice: 12.5, vatRate: 21 },
  ]);
  await draft(withNif.id, [{ description: "[Prueba] Borrador con 0 % sin causa (no debe emitirse)", quantity: 1, unitPrice: 60, vatRate: 0 }]);
  // Cliente sin NIF por encima de 400 €: tampoco se puede emitir
  await draft(noNif.id, [{ description: "[Prueba] Borrador de 500 € sin NIF (no debe emitirse)", quantity: 1, unitPrice: 500, vatRate: 21 }]);

  const total = await prisma.invoice.count({ where: { tenantId } });
  console.log(`Listo. La yeguada ${slug} tiene ahora ${total} facturas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().then(() => process.exit()));
