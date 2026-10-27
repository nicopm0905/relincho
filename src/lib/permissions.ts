/**
 * Matriz de permisos de Relincho: qué puede hacer cada rol y, para los
 * profesionales, cada especialidad (épica E1a del roadmap).
 *
 * Solo responde "¿este rol puede hacer esto?". Sobre qué caballos lo puede
 * hacer decide `HorseAccess` (`src/server/trpc/access.ts`), no esta matriz.
 *
 * Módulo puro: sin Prisma ni red. Los roles se declaran aquí y no se importan
 * de `@prisma/client` porque INSTRUCTOR, PROFESSIONAL y RIDER todavía no
 * existen en `enum Role`: llegan con la migración de E1a.
 */

/** Los valores de `enum Role` tras la migración de E1a. */
export const ROLES = [
  "OWNER",
  "MANAGER",
  "GROOM",
  "VET_EXTERNAL",
  "OWNER_EXTERNAL",
  "INSTRUCTOR",
  "PROFESSIONAL",
  "RIDER",
] as const;
export type PermissionRole = (typeof ROLES)[number];

export const PROFESSIONAL_SPECIALTIES = [
  "VET",
  "VET_SPECIALIST",
  "FARRIER",
  "PHYSIO",
  "DENTIST",
  "NUTRITIONIST",
  "TRAINER",
  "OTHER",
] as const;
export type ProfessionalSpecialty = (typeof PROFESSIONAL_SPECIALTIES)[number];

/** Los valores de `enum HealthEventType` (`prisma/schema.prisma`). */
export const HEALTH_EVENT_TYPES = [
  "VACCINE",
  "DEWORMING",
  "DENTAL",
  "FARRIER",
  "VET_CHECKUP",
  "TREATMENT",
  "INJURY",
  "OTHER",
] as const;
export type HealthEventType = (typeof HEALTH_EVENT_TYPES)[number];

/** Capacidades con la forma `<área>.<read|write|manage>`. */
export const CAPABILITIES = [
  "horse.read",
  "horse.write",
  "health.read",
  "health.write",
  "invoices.read",
  "invoices.write",
  "contacts.read",
  "contacts.write",
  "team.manage",
  "settings.manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export type PermissionMatrix = Record<PermissionRole, Record<Capability, boolean>>;

export type Member = {
  role: PermissionRole;
  specialty?: ProfessionalSpecialty | null;
};

/** Lo que permite cada rol, sin contar la especialidad. */
export const PERMISSION_MATRIX = {} as PermissionMatrix;

/** ¿Puede este miembro ejercer la capacidad? Tiene en cuenta la especialidad. */
export function can(member: Member, capability: Capability): boolean {
  void member;
  void capability;
  throw new Error("no implementado");
}

/** ¿Puede este miembro registrar un acto sanitario de este tipo? */
export function canRecordHealthEvent(member: Member, type: HealthEventType): boolean {
  void member;
  void type;
  throw new Error("no implementado");
}
