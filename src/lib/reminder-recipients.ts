import { calendarDayOffset } from "@/lib/day-window";

/**
 * Avisos multi-destinatario de vencimientos sanitarios (roadmap §4 E3). Motor
 * puro: decide qué actos avisan hoy, a quién y con qué clave de deduplicación.
 * El cron (src/app/api/cron/reminders) pone la BD y el envío.
 *
 * Un vencimiento avisa a la vez a:
 *  - el centro: OWNER y MANAGER;
 *  - el propietario del caballo: OWNER_EXTERNAL con HorseAccess;
 *  - el profesional de esa especialidad con HorseAccess (el herrador, el herraje).
 * Mozos, profesores y jinetes no reciben avisos de vencimientos.
 */

/** Especialidades del profesional (E1a). Texto para no depender del enum aún. */
export type Specialty =
  | "VET"
  | "VET_SPECIALIST"
  | "FARRIER"
  | "PHYSIO"
  | "DENTIST"
  | "NUTRITIONIST"
  | "TRAINER"
  | "OTHER";

export interface ReminderMember {
  userId: string;
  email: string | null;
  /** `Role` de Prisma; acepta ya PROFESSIONAL, INSTRUCTOR y RIDER de E1a. */
  role: string;
  specialty: Specialty | null;
  /** Caballos con `HorseAccess` de esta membresía. */
  horseIds: string[];
}

export type RecipientReason = "CENTER" | "OWNER" | "PROFESSIONAL";

export interface ReminderRecipient {
  userId: string;
  email: string | null;
  reason: RecipientReason;
}

export interface DueEventInput {
  id: string;
  horseId: string;
  type: string;
  date: Date;
  nextDueDate: Date | null;
}

/**
 * Qué especialidad se avisa para cada tipo de acto. Es una regla de AVISO, no
 * de permisos: qué puede REGISTRAR cada especialidad vive en
 * src/lib/permissions.ts (E1a-1). Unificar cuando los dos estén en develop.
 */
const NOTIFIED_SPECIALTIES: Record<string, readonly Specialty[]> = {
  FARRIER: ["FARRIER"],
  VACCINE: ["VET"],
  DEWORMING: ["VET"],
  VET_CHECKUP: ["VET"],
  TREATMENT: ["VET"],
  DENTAL: ["DENTIST"],
};

const CENTER_ROLES = new Set(["OWNER", "MANAGER"]);

/** Especialidad efectiva: el rol antiguo VET_EXTERNAL cuenta como veterinario. */
function specialtyOf(m: ReminderMember): Specialty | null {
  if (m.role === "VET_EXTERNAL") return "VET";
  return m.role === "PROFESSIONAL" ? m.specialty : null;
}

/**
 * Destinatarios de un vencimiento, sin repetir persona. En un centro cada
 * persona tiene una sola membresía (`@@unique([userId, tenantId])`): el gerente
 * que además es dueño de un caballo es MANAGER y recibe un aviso, como centro.
 */
export function recipientsFor(
  event: { horseId: string; type: string },
  members: ReminderMember[],
): ReminderRecipient[] {
  const notified = NOTIFIED_SPECIALTIES[event.type] ?? [];
  const byUser = new Map<string, ReminderRecipient>();
  for (const m of members) {
    const hasHorse = m.horseIds.includes(event.horseId);
    let reason: RecipientReason | null = null;
    if (CENTER_ROLES.has(m.role)) reason = "CENTER";
    else if (m.role === "OWNER_EXTERNAL" && hasHorse) reason = "OWNER";
    else {
      const specialty = specialtyOf(m);
      if (specialty && hasHorse && notified.includes(specialty)) reason = "PROFESSIONAL";
    }
    if (reason && !byUser.has(m.userId)) {
      byUser.set(m.userId, { userId: m.userId, email: m.email, reason });
    }
  }
  return [...byUser.values()];
}

/** Días antes del vencimiento en que se avisa: la antelación del centro y el mismo día. */
export function reminderOffsets(leadDays = 7): number[] {
  return leadDays > 0 ? [leadDays, 0] : [0];
}

/**
 * Actos que avisan hoy. Para cada caballo y tipo manda el último registrado:
 * si la vacuna se repitió, el vencimiento antiguo está cubierto y no avisa.
 */
export function dueReminders<T extends DueEventInput>(
  events: T[],
  { now, leadDays = 7 }: { now: Date; leadDays?: number },
): { event: T; daysUntil: number }[] {
  const latest = new Map<string, T>();
  for (const e of events) {
    const key = `${e.horseId}:${e.type}`;
    const current = latest.get(key);
    if (!current || e.date > current.date) latest.set(key, e);
  }
  const offsets = reminderOffsets(leadDays);
  const out: { event: T; daysUntil: number }[] = [];
  for (const e of events) {
    if (latest.get(`${e.horseId}:${e.type}`) !== e || !e.nextDueDate) continue;
    const daysUntil = calendarDayOffset(e.nextDueDate, now);
    if (offsets.includes(daysUntil)) out.push({ event: e, daysUntil });
  }
  return out;
}

/**
 * Clave de idempotencia del aviso. Con la unicidad (userId, dedupeKey) de
 * `Notification`, relanzar el cron el mismo día no duplica nada.
 */
export function reminderDedupeKey({ eventId, daysUntil }: { eventId: string; daysUntil: number }): string {
  return `health-due:${eventId}:d${daysUntil}`;
}
