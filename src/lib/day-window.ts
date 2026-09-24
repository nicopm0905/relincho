/**
 * Ventanas de "un dia natural" para los recordatorios.
 *
 * Las fechas de vencimiento se guardan como dia (medianoche UTC o mediodia
 * local, segun de donde vengan): ambas caen dentro del mismo dia UTC. Por eso
 * la ventana es el dia UTC que corresponde a la fecha de España de hoy mas
 * `offsetDays`, de 00:00 a 00:00 del dia siguiente, sin depender de a que hora
 * se ejecute el cron.
 */
export function dayWindowUtc(offsetDays: number, now: Date = new Date(), timeZone = "Europe/Madrid") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const start = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + offsetDays));
  const end = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + offsetDays + 1));
  return { start, end };
}
