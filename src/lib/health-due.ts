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

/** "  Gripe y  TÉTANOS " → "gripe y tetanos": minúsculas, sin acentos ni espacios sobrantes. */
function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Qué actos se sustituyen entre sí: un acto posterior con la misma clave cubre
 * el vencimiento del anterior. Las vacunas van por nombre (la gripe no cubre
 * el Nilo); el resto, solo por tipo, porque en desparasitación se alternan
 * productos a propósito y cualquier dosis cubre a la anterior.
 */
export function supersedeKey({ horseId, type, name }: { horseId: string; type: string; name?: string | null }): string {
  return type === "VACCINE" ? `${horseId}:${type}:${normalizeName(name ?? "")}` : `${horseId}:${type}`;
}

/**
 * Lo que de verdad está pendiente en sanidad: para cada caballo y acto
 * (`supersedeKey`) manda el último registrado. Una vacuna que venció ayer pero
 * se repitió la semana pasada no está vencida, aunque el registro antiguo siga
 * teniendo su fecha de próxima dosis.
 */
export function pendingHealthDue<T extends DueEvent>(
  events: T[],
  { withinDays, now = new Date() }: { withinDays: number; now?: Date },
): HealthDue<T>[] {
  const latest = new Map<string, T>();
  for (const event of events) {
    const key = supersedeKey({ horseId: event.horse.id, type: event.type, name: event.name });
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
