import { round2 } from "./invoice-balance";

/** Hasta este total se admite factura simplificada sin NIF del cliente (art. 4 RD 1619/2012). */
export const SIMPLIFIED_LIMIT = 400;

export function computeTotals(lines: { quantity: number; unitPrice: number; vatRate: number }[]) {
  let subtotal = 0;
  let vatTotal = 0;
  for (const l of lines) {
    const base = round2(l.quantity * l.unitPrice);
    subtotal += base;
    vatTotal += round2(base * (l.vatRate / 100));
  }
  subtotal = round2(subtotal);
  vatTotal = round2(vatTotal);
  return { subtotal, vatTotal, total: round2(subtotal + vatTotal) };
}

/** Desglose por tipo impositivo, como se declara a la AEAT. */
export function breakdownByRate(lines: { quantity: number; unitPrice: number; vatRate: number }[]) {
  const byRate = new Map<number, { base: number; vat: number }>();
  for (const line of lines) {
    const base = round2(line.quantity * line.unitPrice);
    const acc = byRate.get(line.vatRate) ?? { base: 0, vat: 0 };
    acc.base = round2(acc.base + base);
    acc.vat = round2(acc.vat + round2(base * (line.vatRate / 100)));
    byRate.set(line.vatRate, acc);
  }
  return [...byRate.entries()].map(([vatRate, v]) => ({ vatRate, ...v }));
}

export type InvoiceKind = "F1" | "F2" | "R1" | "R2" | "R3" | "R4";

/**
 * Tipo de factura al emitir. Devuelve `error` con el motivo cuando no se puede:
 * por encima del limite de la simplificada el cliente tiene que estar identificado.
 */
export function classifyInvoice(input: {
  isRectification: boolean;
  storedType: string | null;
  hasClientNif: boolean;
  total: number;
}): { type: InvoiceKind } | { error: string } {
  if (input.isRectification) {
    return { type: /^R[1-4]$/.test(input.storedType ?? "") ? (input.storedType as InvoiceKind) : "R4" };
  }
  if (input.hasClientNif) return { type: "F1" };
  // Simplificada: no exige identificar al cliente.
  if (input.total <= SIMPLIFIED_LIMIT) return { type: "F2" };
  return {
    error: `El cliente no tiene NIF válido: por encima de ${SIMPLIFIED_LIMIT} € la factura tiene que identificarlo.`,
  };
}
