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
  role: string;
  specialty: Specialty | null;
  horseIds: string[];
}

export type RecipientReason = "CENTER" | "OWNER" | "PROFESSIONAL";

export interface DueEventInput {
  id: string;
  horseId: string;
  type: string;
  date: Date;
  nextDueDate: Date | null;
}

export function recipientsFor(
  _event: { horseId: string; type: string },
  _members: ReminderMember[],
): { userId: string; email: string | null; reason: RecipientReason }[] {
  throw new Error("no implementado");
}

export function dueReminders<T extends DueEventInput>(
  _events: T[],
  _opts: { now: Date; leadDays?: number },
): { event: T; daysUntil: number }[] {
  throw new Error("no implementado");
}

export function reminderDedupeKey(_o: { eventId: string; daysUntil: number }): string {
  throw new Error("no implementado");
}
