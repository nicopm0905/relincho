import { invoiceBalance, round2, type RectifierLike } from "./invoice-balance";

export interface SummaryInvoice {
  status: string;
  rectifiesId: string | null;
  total: number | string | { toString(): string };
  payments: { amount: number | string | { toString(): string } }[];
  rectifiedBy: RectifierLike[];
}

export interface InvoiceSummary {
  /** Importe neto emitido: las rectificativas restan lo que corrigen. */
  billed: number;
  /** Cobros registrados, descontadas las devoluciones. */
  collected: number;
  /** Lo que los clientes aun deben. */
  pending: number;
  /** De lo pendiente, lo que ya paso de fecha. */
  overdue: number;
  /** Lo que la yeguada debe devolver tras rectificar facturas cobradas. */
  toRefund: number;
}

const EMITTED = new Set(["ISSUED", "PAID", "OVERDUE"]);

/**
 * Totales de un conjunto de facturas. Los borradores y las anuladas no cuentan:
 * no son dinero facturado. Los cobros y lo pendiente se miran siempre en la
 * factura original, porque la rectificativa solo ajusta su importe.
 */
export function summarizeInvoices(invoices: SummaryInvoice[]): InvoiceSummary {
  let billed = 0;
  let collected = 0;
  let pending = 0;
  let overdue = 0;
  let toRefund = 0;
  for (const inv of invoices) {
    if (!EMITTED.has(inv.status)) continue;
    billed += Number(inv.total);
    if (inv.rectifiesId) continue; // no se cobra: ya ajusta la original
    const b = invoiceBalance({ total: inv.total, payments: inv.payments, rectifiers: inv.rectifiedBy });
    collected += b.paid;
    if (b.pending > 0) {
      pending += b.pending;
      if (inv.status === "OVERDUE") overdue += b.pending;
    } else if (b.pending < 0) {
      toRefund += -b.pending;
    }
  }
  return {
    billed: round2(billed),
    collected: round2(collected),
    pending: round2(pending),
    overdue: round2(overdue),
    toRefund: round2(toRefund),
  };
}
