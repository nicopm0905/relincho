import { round2 } from "./invoice-balance";

/** Hasta este total se admite factura simplificada sin NIF del cliente (art. 4 RD 1619/2012). */
export const SIMPLIFIED_LIMIT = 400;

/** Causas de exencion de la AEAT (E1-E6): el texto que sale en la factura. */
export const EXEMPTION_CAUSES = {
  E1: "Exenta por el art. 20 de la Ley del IVA",
  E2: "Exenta por el art. 21 de la Ley del IVA (exportaciones)",
  E3: "Exenta por el art. 22 de la Ley del IVA (operaciones asimiladas a exportaciones)",
  E4: "Exenta por los arts. 23 y 24 de la Ley del IVA (zonas francas, depósitos)",
  E5: "Exenta por el art. 25 de la Ley del IVA (entregas intracomunitarias)",
  E6: "Exenta por otros motivos",
} as const;
export type ExemptionCause = keyof typeof EXEMPTION_CAUSES;

export function isExemptionCause(value: string | null | undefined): value is ExemptionCause {
  return value != null && value in EXEMPTION_CAUSES;
}

/**
 * Una linea con IVA 0 % tiene que decir por que: exenta con su causa. Y una
 * causa de exencion solo cabe en una linea a 0 %. Devuelve el motivo si falla.
 */
export function exemptionProblem(line: { vatRate: number; exemptionCause?: string | null }): string | null {
  const cause = line.exemptionCause || null;
  if (cause && !isExemptionCause(cause)) return "Causa de exención no válida";
  if (line.vatRate === 0 && !cause) {
    return "Una línea con IVA 0 % necesita su causa de exención (por ejemplo, art. 20 de la Ley del IVA).";
  }
  if (line.vatRate !== 0 && cause) return "Una línea con causa de exención tiene que ir con IVA 0 %.";
  return null;
}

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

/**
 * Desglose como se declara a la AEAT: una entrada por tipo impositivo y, en las
 * exentas, una por causa (cada causa se declara aparte).
 */
export function breakdownByRate(
  lines: { quantity: number; unitPrice: number; vatRate: number; exemptionCause?: string | null }[],
) {
  const groups = new Map<string, { vatRate: number; exemption: string | null; base: number; vat: number }>();
  for (const line of lines) {
    const exemption = line.exemptionCause || null;
    const key = `${line.vatRate}|${exemption ?? ""}`;
    const base = round2(line.quantity * line.unitPrice);
    const acc = groups.get(key) ?? { vatRate: line.vatRate, exemption, base: 0, vat: 0 };
    acc.base = round2(acc.base + base);
    acc.vat = round2(acc.vat + round2(base * (line.vatRate / 100)));
    groups.set(key, acc);
  }
  return [...groups.values()];
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
