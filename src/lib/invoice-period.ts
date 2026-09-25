/**
 * Periodos de facturacion en hora de Madrid. Una factura emitida a las 00:30
 * del 1 de julio es del tercer trimestre aunque en UTC sea del 30 de junio, asi
 * que las fechas se comparan como "AAAA-MM-DD" de Madrid y no como instantes.
 */

const MADRID_DAY = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-07-01" para el dia de Madrid al que pertenece el instante. */
export function madridDay(date: Date): string {
  return MADRID_DAY.format(date);
}

export type Quarter = 1 | 2 | 3 | 4;

export interface PeriodRange {
  /** Ambos inclusive, "AAAA-MM-DD". */
  from: string;
  to: string;
}

/** Trimestre `quarter` del ano, o el ano entero si no se indica. */
export function periodRange(year: number, quarter?: Quarter | null): PeriodRange {
  if (!quarter) return { from: `${year}-01-01`, to: `${year}-12-31` };
  const firstMonth = (quarter - 1) * 3 + 1;
  const lastMonth = firstMonth + 2;
  // Dia 0 del mes siguiente = ultimo dia de este (en UTC, sin husos de por medio).
  const lastDay = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  const mm = (n: number) => String(n).padStart(2, "0");
  return { from: `${year}-${mm(firstMonth)}-01`, to: `${year}-${mm(lastMonth)}-${mm(lastDay)}` };
}

export function inPeriod(date: Date, range: PeriodRange): boolean {
  const day = madridDay(date);
  return day >= range.from && day <= range.to;
}

/** Trimestre (1-4) de un dia de Madrid. */
export function quarterOf(date: Date): Quarter {
  return (Math.floor((Number(madridDay(date).slice(5, 7)) - 1) / 3) + 1) as Quarter;
}
