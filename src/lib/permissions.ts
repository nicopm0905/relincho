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

const none: Record<Capability, boolean> = {
  "horse.read": false,
  "horse.write": false,
  "health.read": false,
  "health.write": false,
  "invoices.read": false,
  "invoices.write": false,
  "contacts.read": false,
  "contacts.write": false,
  "team.manage": false,
  "settings.manage": false,
};

/** El profesional ve sus caballos y escribe sanidad, limitado por su especialidad. */
const professional: Record<Capability, boolean> = {
  ...none,
  "horse.read": true,
  "health.read": true,
  "health.write": true,
};

/**
 * Lo que permite cada rol, sin contar la especialidad. Refleja lo que ya dejan
 * hacer los routers (`roleProcedure`, `staffProcedure`) y añade los roles nuevos.
 */
export const PERMISSION_MATRIX: PermissionMatrix = {
  OWNER: {
    "horse.read": true,
    "horse.write": true,
    "health.read": true,
    "health.write": true,
    "invoices.read": true,
    "invoices.write": true,
    "contacts.read": true,
    "contacts.write": true,
    "team.manage": true,
    "settings.manage": true,
  },
  // Hoy `tenant.update` admite a MANAGER; el equipo es solo del OWNER.
  MANAGER: {
    "horse.read": true,
    "horse.write": true,
    "health.read": true,
    "health.write": true,
    "invoices.read": true,
    "invoices.write": true,
    "contacts.read": true,
    "contacts.write": true,
    "team.manage": false,
    "settings.manage": true,
  },
  GROOM: {
    ...none,
    "horse.read": true,
    "health.read": true,
    "health.write": true,
    "invoices.read": true,
    "contacts.read": true,
  },
  // En desuso tras E1a; hasta migrar los datos se trata como un veterinario.
  VET_EXTERNAL: professional,
  // Sus caballos y sus facturas, en el portal.
  OWNER_EXTERNAL: {
    ...none,
    "horse.read": true,
    "health.read": true,
    "invoices.read": true,
  },
  // Sin capacidades hasta el módulo de clases (E1c).
  INSTRUCTOR: none,
  PROFESSIONAL: professional,
  RIDER: none,
};

const VET_TYPES: readonly HealthEventType[] = ["VACCINE", "DEWORMING", "VET_CHECKUP", "TREATMENT"];

/** Los actos sanitarios que registra cada especialidad. */
export const SPECIALTY_HEALTH_TYPES: Record<ProfessionalSpecialty, readonly HealthEventType[]> = {
  VET: VET_TYPES,
  VET_SPECIALIST: VET_TYPES,
  FARRIER: ["FARRIER"],
  DENTIST: ["DENTAL"],
  PHYSIO: [],
  NUTRITIONIST: [],
  TRAINER: [],
  OTHER: [],
};

/** Los actos que puede registrar el miembro si tiene `health.write`. */
function healthTypesOf(member: Member): readonly HealthEventType[] {
  if (member.role === "VET_EXTERNAL") return SPECIALTY_HEALTH_TYPES.VET;
  if (member.role === "PROFESSIONAL") {
    return member.specialty ? SPECIALTY_HEALTH_TYPES[member.specialty] : [];
  }
  return HEALTH_EVENT_TYPES;
}

/** ¿Puede este miembro ejercer la capacidad? Tiene en cuenta la especialidad. */
export function can(member: Member, capability: Capability): boolean {
  if (!PERMISSION_MATRIX[member.role][capability]) return false;
  if (capability === "health.write") return healthTypesOf(member).length > 0;
  return true;
}

/** ¿Puede este miembro registrar un acto sanitario de este tipo? */
export function canRecordHealthEvent(member: Member, type: HealthEventType): boolean {
  return can(member, "health.write") && healthTypesOf(member).includes(type);
}
