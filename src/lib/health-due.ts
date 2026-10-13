import { calendarDayOffset } from "@/lib/day-window";

type DueEvent = {
  id: string;
  type: string;
  name: string;
  date: Date | string;
  nextDueDate: Date | string | null;
  horse: { id: string; name: string };
};

export type HealthDue<T extends DueEvent = DueEvent> = {
  event: T;
  due: Date;
  /** Días de calendario hasta el vencimiento: negativo si ya venció. */
  offset: number;
};

/**
 * Lo que de verdad está pendiente en sanidad: para cada caballo y tipo de acto
 * manda el último registrado. Una vacuna que venció ayer pero se repitió la
 * semana pasada no está vencida, aunque el registro antiguo siga teniendo su
 * fecha de próxima dosis.
 */
export function pendingHealthDue<T extends DueEvent>(
  events: T[],
  { withinDays, now = new Date() }: { withinDays: number; now?: Date },
): HealthDue<T>[] {
  const latest = new Map<string, T>();
  for (const event of events) {
    const key = `${event.horse.id}:${event.type}`;
    const current = latest.get(key);
    if (!current || new Date(event.date) > new Date(current.date)) latest.set(key, event);
  }
  return [...latest.values()]
    .filter((event): event is T & { nextDueDate: Date | string } => Boolean(event.nextDueDate))
    .map((event) => {
      const due = new Date(event.nextDueDate);
      return { event, due, offset: calendarDayOffset(due, now) };
    })
    .filter((item) => item.offset <= withinDays)
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}
