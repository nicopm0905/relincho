/**
 * Visita del profesional (roadmap §4 E7): el herrador registra el herraje de
 * uno o varios caballos y propone la próxima cita, de la que sale el aviso
 * siguiente. Motor puro: el router `professional.recordVisit` persiste lo que
 * devuelve `planVisit`. Qué tipos puede registrar cada especialidad lo decide
 * `healthTypesFor` (`src/lib/permissions.ts`), no este motor.
 */
import type { HealthEventType } from "@/lib/permissions";

/** Intervalo de herraje cuando el caballo no tiene uno propio. */
export const DEFAULT_FARRIER_WEEKS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Próxima cita: la visita más el intervalo del caballo, o 6 semanas. Un
 * intervalo que no sea un número de semanas positivo se ignora: la propuesta
 * nunca cae antes de la visita.
 */
export function proposeNextVisit({
  visitDate,
  intervalWeeks,
}: {
  visitDate: Date;
  intervalWeeks?: number | null;
}): Date {
  const weeks =
    intervalWeeks != null && Number.isFinite(intervalWeeks) && intervalWeeks >= 1
      ? Math.round(intervalWeeks)
      : DEFAULT_FARRIER_WEEKS;
  return new Date(visitDate.getTime() + weeks * 7 * DAY_MS);
}

export interface VisitHorse {
  id: string;
  /** `Horse.farrierIntervalWeeks`; `null` = el de por defecto. */
  farrierIntervalWeeks: number | null;
}

/** Un acto sanitario listo para guardar. */
export interface VisitHealthEvent {
  horseId: string;
  type: HealthEventType;
  name: string;
  date: Date;
  nextDueDate: Date | null;
  notes: string | null;
  authorMembershipId: string;
}

/**
 * Un acto por caballo (sin repetir), todos con el mismo autor, tipo y fecha.
 * En un herraje, la próxima cita sale del intervalo de cada caballo salvo que
 * se elija una a mano posterior a la visita. En otros tipos solo se guarda la
 * fecha que se indique.
 */
export function planVisit(input: {
  horses: VisitHorse[];
  type: HealthEventType;
  name: string;
  date: Date;
  nextDueDate?: Date | null;
  notes?: string | null;
  authorMembershipId: string;
}): VisitHealthEvent[] {
  const chosen =
    input.nextDueDate && input.nextDueDate.getTime() > input.date.getTime()
      ? input.nextDueDate
      : null;
  const horses = [...new Map(input.horses.map((h) => [h.id, h])).values()];

  return horses.map((h) => ({
    horseId: h.id,
    type: input.type,
    name: input.name,
    date: input.date,
    nextDueDate:
      chosen ??
      (input.type === "FARRIER"
        ? proposeNextVisit({ visitDate: input.date, intervalWeeks: h.farrierIntervalWeeks })
        : null),
    notes: input.notes?.trim() || null,
    authorMembershipId: input.authorMembershipId,
  }));
}
