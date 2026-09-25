/**
 * Saldo real de una factura teniendo en cuenta sus rectificativas.
 *
 * La factura original no se toca: lo que se le debe (o lo que hay que devolver)
 * sale de aplicar sus rectificativas emitidas. Una rectificativa «por
 * diferencias» (I) suma su importe (negativo si descuenta); una «por
 * sustitucion» (S) reemplaza el total. Los cobros se registran siempre en la
 * original: la rectificativa no se cobra, ajusta.
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type Amount = number | string | { toString(): string };

export interface RectifierLike {
  status: string;
  total: Amount;
  rectificationKind: string | null;
}

/** Solo cuentan las emitidas: un borrador o una anulada no cambia lo que se debe. */
const APPLIED = new Set(["ISSUED", "PAID", "OVERDUE"]);

export interface InvoiceBalance {
  /** Total de la original tras aplicar las rectificativas emitidas. */
  effectiveTotal: number;
  paid: number;
  /** Positivo: el cliente debe. Negativo: la yeguada debe devolver. */
  pending: number;
  /** Tiene al menos una rectificativa emitida. */
  rectified: boolean;
  /** Las rectificativas la dejan a cero: es como si no se hubiera facturado. */
  voided: boolean;
}

/** `rectifiers` en orden de emision (importa si hay una por sustitucion). */
export function invoiceBalance(input: {
  total: Amount;
  payments: { amount: Amount }[];
  rectifiers?: RectifierLike[];
}): InvoiceBalance {
  let effectiveTotal = Number(input.total);
  const applied = (input.rectifiers ?? []).filter((r) => APPLIED.has(r.status));
  for (const r of applied) {
    effectiveTotal = r.rectificationKind === "S" ? Number(r.total) : effectiveTotal + Number(r.total);
  }
  effectiveTotal = round2(effectiveTotal);
  const paid = round2(input.payments.reduce((sum, p) => sum + Number(p.amount), 0));
  return {
    effectiveTotal,
    paid,
    pending: round2(effectiveTotal - paid),
    rectified: applied.length > 0,
    voided: applied.length > 0 && effectiveTotal === 0,
  };
}
