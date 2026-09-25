import { test } from "node:test";
import assert from "node:assert/strict";
import { inPeriod, madridDay, periodRange, quarterOf } from "../src/lib/invoice-period";
import { summarizeInvoices } from "../src/lib/invoice-summary";
import { buildLedgerCsv, ledgerRow, ledgerTotals, type LedgerInvoice } from "../src/lib/invoice-ledger";

test("trimestres: limites y fin de febrero bisiesto", () => {
  assert.deepEqual(periodRange(2026, 1), { from: "2026-01-01", to: "2026-03-31" });
  assert.deepEqual(periodRange(2026, 2), { from: "2026-04-01", to: "2026-06-30" });
  assert.deepEqual(periodRange(2026, 4), { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(periodRange(2026), { from: "2026-01-01", to: "2026-12-31" });
});

test("la fecha se mira en hora de Madrid, no en UTC", () => {
  // 30 jun 22:30 UTC = 1 jul 00:30 en Madrid (verano): es del tercer trimestre.
  const d = new Date("2026-06-30T22:30:00Z");
  assert.equal(madridDay(d), "2026-07-01");
  assert.equal(quarterOf(d), 3);
  assert.equal(inPeriod(d, periodRange(2026, 3)), true);
  assert.equal(inPeriod(d, periodRange(2026, 2)), false);
});

const inv = (over: Partial<Parameters<typeof summarizeInvoices>[0][number]>) => ({
  status: "ISSUED",
  rectifiesId: null,
  total: 100,
  payments: [],
  rectifiedBy: [],
  ...over,
});

test("resumen: borradores y anuladas no cuentan; cobrado y pendiente salen de la original", () => {
  const s = summarizeInvoices([
    inv({ total: 121, payments: [{ amount: 21 }] }),
    inv({ status: "OVERDUE", total: 50 }),
    inv({ status: "PAID", total: 30, payments: [{ amount: 30 }] }),
    inv({ status: "DRAFT", total: 999 }),
    inv({ status: "CANCELLED", total: 999 }),
  ]);
  assert.deepEqual(s, { billed: 201, collected: 51, pending: 150, overdue: 50, toRefund: 0 });
});

test("resumen con rectificativa: lo facturado es neto y una cobrada de mas se marca a devolver", () => {
  const s = summarizeInvoices([
    inv({
      status: "PAID",
      total: 200,
      payments: [{ amount: 200 }],
      rectifiedBy: [{ status: "ISSUED", total: -50, rectificationKind: "I" }],
    }),
    inv({ status: "ISSUED", rectifiesId: "x", total: -50 }),
  ]);
  assert.equal(s.billed, 150);
  assert.equal(s.collected, 200);
  assert.equal(s.pending, 0);
  assert.equal(s.toRefund, 50);
});

const base: LedgerInvoice = {
  series: "2026",
  number: 7,
  issueDate: new Date("2026-09-10T10:00:00Z"),
  status: "ISSUED",
  invoiceType: "F1",
  rectifies: null,
  total: 171,
  client: { name: "Ana; \"la\" cuadra", nif: "12345678Z" },
  lines: [
    { quantity: 1, unitPrice: 100, vatRate: 21, exemptionCause: null },
    { quantity: 1, unitPrice: 50, vatRate: 0, exemptionCause: "E1" },
  ],
};

test("libro: base y cuota por tipo, exenta aparte y total de la factura", () => {
  const r = ledgerRow(base);
  assert.equal(r.number, "2026-0007");
  assert.equal(r.date, "2026-09-10");
  assert.deepEqual([r.base21, r.vat21, r.exempt, r.total], [100, 21, 50, 171]);
});

test("libro: una anulada figura a cero y una rectificativa en negativo", () => {
  const voided = ledgerRow({ ...base, status: "CANCELLED" });
  assert.deepEqual([voided.total, voided.base21, voided.status], [0, 0, "ANULADA"]);
  const rect = ledgerRow({
    ...base,
    number: 8,
    invoiceType: "R4",
    total: -121,
    rectifies: { series: "2026", number: 7 },
    lines: [{ quantity: 1, unitPrice: -100, vatRate: 21, exemptionCause: null }],
  });
  assert.deepEqual([rect.base21, rect.vat21, rect.total, rect.rectifies], [-100, -21, -121, "2026-0007"]);
  assert.equal(ledgerTotals([ledgerRow(base), voided, rect]).total, 50);
});

test("CSV: BOM, CRLF, coma decimal, comillas escapadas y sin formulas", () => {
  const csv = buildLedgerCsv([ledgerRow(base), ledgerRow({ ...base, number: 9, client: { name: "=HYPERLINK(1)", nif: null } })]);
  assert.ok(csv.startsWith("﻿Fecha;"));
  assert.ok(csv.includes("\r\n"));
  assert.ok(csv.includes('"Ana; ""la"" cuadra"'));
  assert.ok(csv.includes("100,00;21,00"));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.trimEnd().split("\r\n").at(-1)!.startsWith(";TOTAL;"));
});
