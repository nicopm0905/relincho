/**
 * Ventanas de "un dia natural" para los recordatorios.
 *
 * Las fechas de vencimiento se guardan como dia (medianoche UTC o mediodia
 * local, segun de donde vengan): ambas caen dentro del mismo dia UTC. Por eso
 * la ventana es el dia UTC que corresponde a la fecha de España de hoy mas
 * `offsetDays`, de 00:00 a 00:00 del dia siguiente, sin depender de a que hora
 * se ejecute el cron.
 */
function calendarDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Diferencia entre días del calendario local, independiente de la hora y DST. */
export function calendarDayOffset(
  date: Date,
  relativeTo: Date = new Date(),
  timeZone = "Europe/Madrid",
) {
  const due = calendarDateParts(date, timeZone);
  const today = calendarDateParts(relativeTo, timeZone);
  const dueDay = Date.UTC(due.year, due.month - 1, due.day);
  const todayDay = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((dueDay - todayDay) / 86_400_000);
}

/** Etiqueta breve para una fecha respecto al día local actual. */
export function relativeDayLabel(offset: number) {
  if (offset < -1) return `Hace ${Math.abs(offset)} días`;
  if (offset === -1) return "Ayer";
  if (offset === 0) return "Hoy";
  if (offset === 1) return "Mañana";
  return `En ${offset} días`;
}

export function dayWindowUtc(offsetDays: number, now: Date = new Date(), timeZone = "Europe/Madrid") {
  const { year, month, day } = calendarDateParts(now, timeZone);
  const start = new Date(Date.UTC(year, month - 1, day + offsetDays));
  const end = new Date(Date.UTC(year, month - 1, day + offsetDays + 1));
  return { start, end };
}
