import { breakdownByRate } from "./invoice-rules";
import { round2 } from "./invoice-balance";
import { madridDay } from "./invoice-period";
import { invoiceNumSerie } from "./verifactu";

/** Lo que hace falta de cada factura emitida para el libro de facturas. */
export interface LedgerInvoice {
  series: string;
  number: number;
  issueDate: Date;
  status: string;
  invoiceType: string;
  rectifies: { series: string; number: number | null } | null;
  total: number | string | { toString(): string };
  client: { name: string; nif: string | null };
  lines: {
    quantity: number | string | { toString(): string };
    unitPrice: number | string | { toString(): string };
    vatRate: number | string | { toString(): string };
    exemptionCause: string | null;
  }[];
}

export interface LedgerRow {
  date: string;
  number: string;
  type: string;
  rectifies: string;
  nif: string;
  client: string;
  base21: number;
  vat21: number;
  base10: number;
  vat10: number;
  base4: number;
  vat4: number;
  exempt: number;
  baseOther: number;
  vatOther: number;
  total: number;
  status: string;
}

export const LEDGER_HEADERS = [
  "Fecha",
  "Nº factura",
  "Tipo",
  "Rectifica a",
  "NIF cliente",
  "Cliente",
  "Base 21 %",
  "Cuota 21 %",
  "Base 10 %",
  "Cuota 10 %",
  "Base 4 %",
  "Cuota 4 %",
  "Base exenta",
  "Base otros tipos",
  "Cuota otros tipos",
  "Total",
  "Estado",
] as const;

const NUMERIC_KEYS = [
  "base21",
  "vat21",
  "base10",
  "vat10",
  "base4",
  "vat4",
  "exempt",
  "baseOther",
  "vatOther",
  "total",
] as const;

/**
 * Una fila por factura, con la base y la cuota por tipo de IVA. Una factura
 * anulada sigue en el libro (la numeracion no tiene huecos) pero a cero, para
 * que no infle los totales.
 */
export function ledgerRow(inv: LedgerInvoice): LedgerRow {
  const row: LedgerRow = {
    date: madridDay(inv.issueDate),
    number: invoiceNumSerie(inv.series, inv.number),
    type: inv.invoiceType,
    rectifies: inv.rectifies && inv.rectifies.number != null ? invoiceNumSerie(inv.rectifies.series, inv.rectifies.number) : "",
    nif: inv.client.nif ?? "",
    client: inv.client.name,
    base21: 0,
    vat21: 0,
    base10: 0,
    vat10: 0,
    base4: 0,
    vat4: 0,
    exempt: 0,
    baseOther: 0,
    vatOther: 0,
    total: 0,
    status: inv.status === "CANCELLED" ? "ANULADA" : "",
  };
  if (inv.status === "CANCELLED") return row;

  const breakdown = breakdownByRate(
    inv.lines.map((l) => ({
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      vatRate: Number(l.vatRate),
      exemptionCause: l.exemptionCause,
    })),
  );
  for (const b of breakdown) {
    if (b.exemption) row.exempt += b.base;
    else if (b.vatRate === 21) [row.base21, row.vat21] = [row.base21 + b.base, row.vat21 + b.vat];
    else if (b.vatRate === 10) [row.base10, row.vat10] = [row.base10 + b.base, row.vat10 + b.vat];
    else if (b.vatRate === 4) [row.base4, row.vat4] = [row.base4 + b.base, row.vat4 + b.vat];
    else [row.baseOther, row.vatOther] = [row.baseOther + b.base, row.vatOther + b.vat];
  }
  row.total = Number(inv.total);
  for (const key of NUMERIC_KEYS) row[key] = round2(row[key]);
  return row;
}

/** Fila de totales del periodo. */
export function ledgerTotals(rows: LedgerRow[]): LedgerRow {
  const total: LedgerRow = {
    date: "",
    number: "TOTAL",
    type: "",
    rectifies: "",
    nif: "",
    client: `${rows.length} facturas`,
    base21: 0,
    vat21: 0,
    base10: 0,
    vat10: 0,
    base4: 0,
    vat4: 0,
    exempt: 0,
    baseOther: 0,
    vatOther: 0,
    total: 0,
    status: "",
  };
  for (const r of rows) for (const key of NUMERIC_KEYS) total[key] = round2(total[key] + r[key]);
  return total;
}

/** Numero al estilo de Excel en espanol: coma decimal, sin separador de miles. */
function num(n: number) {
  return n.toFixed(2).replace(".", ",");
}

/**
 * Texto que Excel no puede interpretar como formula: un nombre de cliente que
 * empiece por = + - o @ se ejecutaria al abrir el CSV.
 */
function text(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV para la gestoria: separador `;`, coma decimal, BOM y CRLF, que es lo que
 * Excel en espanol abre bien a doble clic.
 */
export function buildLedgerCsv(rows: LedgerRow[]): string {
  const lines = [LEDGER_HEADERS.map((h) => text(h)).join(";")];
  for (const r of [...rows, ledgerTotals(rows)]) {
    lines.push(
      [
        text(r.date),
        text(r.number),
        text(r.type),
        text(r.rectifies),
        text(r.nif),
        text(r.client),
        ...NUMERIC_KEYS.slice(0, 9).map((k) => num(r[k])),
        num(r.total),
        text(r.status),
      ].join(";"),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
