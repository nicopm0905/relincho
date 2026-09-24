import { invoiceNumSerie } from "./verifactu";

/** "2026-0007", o "Borrador" si aun no se ha emitido (el numero se asigna al emitir). */
export function invoiceLabel(invoice: { series: string; number: number | null }) {
  return invoice.number == null ? "Borrador" : invoiceNumSerie(invoice.series, invoice.number);
}
