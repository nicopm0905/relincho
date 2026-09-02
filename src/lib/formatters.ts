import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", { locale: es });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy HH:mm", { locale: es });
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

export function formatNif(nif: string): string {
  return nif.toUpperCase().trim();
}
