/**
 * Invitar clientes a la app desde Contactos, en lote (roadmap §4 E1b). Motor
 * puro: decide a quién se invita, a quién solo se le da acceso a más caballos
 * y a quién se salta, sin BD ni red. El router lo ejecuta en una transacción.
 *
 * Un contacto es propietario de los caballos cuyo `currentOwnerId` apunta a
 * él. Se agrupa por email normalizado: dos fichas de la misma persona con el
 * email escrito distinto acaban en una sola invitación.
 *
 * Según el tipo de contacto (decisiones de #47): un cliente o propietario se
 * invita como OWNER_EXTERNAL si tiene caballos (sin caballos aterrizaría en un
 * portal vacío: NO_HORSES); un veterinario o herrador, como PROFESSIONAL con
 * esa especialidad, y los caballos se los asigna luego el centro; un
 * proveedor no se invita.
 */
import type { PermissionRole, ProfessionalSpecialty } from "@/lib/permissions";

/** Los tipos de `Contact.kind` (`CONTACT_KINDS` del router de contactos). */
export type ContactKind = "VET" | "FARRIER" | "CLIENT" | "OWNER" | "SUPPLIER" | "OTHER";

/** Especialidad con la que se invita a cada tipo de contacto profesional. */
const PROFESSIONAL_KINDS: Partial<Record<ContactKind, ProfessionalSpecialty>> = {
  VET: "VET",
  FARRIER: "FARRIER",
};
const NOT_INVITABLE_KINDS = new Set<ContactKind>(["SUPPLIER"]);

export interface InviteContact {
  id: string;
  kind: ContactKind;
  name: string;
  email: string | null;
  /** Caballos de los que es propietario. */
  horseIds: string[];
}

export interface ExistingMember {
  membershipId: string;
  /** Email del usuario, tal cual: se normaliza aquí. */
  email: string;
  role: PermissionRole;
  /** Caballos a los que ya tiene acceso (`HorseAccess`). */
  horseIds: string[];
}

/** Nueva cuenta OWNER_EXTERNAL con acceso a esos caballos, y email de invitación. */
export interface ClientInvitation {
  email: string;
  contactIds: string[];
  horseIds: string[];
}

/** Ya es miembro: solo se añaden los HorseAccess que le faltan, sin reenviar nada. */
export interface AccessGrant {
  membershipId: string;
  email: string;
  horseIds: string[];
}

/** Nueva cuenta PROFESSIONAL con su especialidad. Sin caballos: los asigna el centro. */
export interface ProfessionalInvitation {
  email: string;
  contactIds: string[];
  specialty: ProfessionalSpecialty;
}

export type SkipReason = "NO_EMAIL" | "STAFF" | "NO_HORSES" | "NOT_INVITABLE" | "ALREADY_MEMBER";

export interface SkippedContact {
  contactId: string;
  name: string;
  reason: SkipReason;
}

export interface ClientInvitePlan {
  invitations: ClientInvitation[];
  professionalInvitations: ProfessionalInvitation[];
  grants: AccessGrant[];
  skipped: SkippedContact[];
}

/** El personal ya ve toda la cuadra: darle HorseAccess no cambia nada. */
const STAFF_ROLES = new Set<PermissionRole>(["OWNER", "MANAGER", "GROOM"]);

export const normalizeEmail = (email: string | null | undefined) =>
  (email ?? "").trim().toLowerCase();

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

export function planClientInvites(
  contacts: InviteContact[],
  members: ExistingMember[],
): ClientInvitePlan {
  const memberByEmail = new Map(members.map((m) => [normalizeEmail(m.email), m]));
  const invitations = new Map<string, ClientInvitation>();
  const professionals = new Map<string, ProfessionalInvitation>();
  const grants = new Map<string, AccessGrant>();
  const skipped: SkippedContact[] = [];

  for (const c of contacts) {
    if (NOT_INVITABLE_KINDS.has(c.kind)) {
      skipped.push({ contactId: c.id, name: c.name, reason: "NOT_INVITABLE" });
      continue;
    }
    const email = normalizeEmail(c.email);
    if (!email) {
      skipped.push({ contactId: c.id, name: c.name, reason: "NO_EMAIL" });
      continue;
    }

    const member = memberByEmail.get(email);
    if (member && STAFF_ROLES.has(member.role)) {
      skipped.push({ contactId: c.id, name: c.name, reason: "STAFF" });
      continue;
    }

    const specialty = PROFESSIONAL_KINDS[c.kind];
    if (specialty) {
      if (member) {
        skipped.push({ contactId: c.id, name: c.name, reason: "ALREADY_MEMBER" });
        continue;
      }
      const prev = professionals.get(email);
      professionals.set(email, {
        email,
        contactIds: [...(prev?.contactIds ?? []), c.id],
        specialty: prev?.specialty ?? specialty,
      });
      continue;
    }

    if (c.horseIds.length === 0 && !invitations.has(email)) {
      skipped.push({ contactId: c.id, name: c.name, reason: "NO_HORSES" });
      continue;
    }

    if (member) {
      const missing = c.horseIds.filter((id) => !member.horseIds.includes(id));
      const prev = grants.get(member.membershipId);
      grants.set(member.membershipId, {
        membershipId: member.membershipId,
        email,
        horseIds: union(prev?.horseIds ?? [], missing),
      });
      continue;
    }

    const prev = invitations.get(email);
    invitations.set(email, {
      email,
      contactIds: [...(prev?.contactIds ?? []), c.id],
      horseIds: union(prev?.horseIds ?? [], c.horseIds),
    });
  }

  return {
    invitations: [...invitations.values()],
    professionalInvitations: [...professionals.values()],
    // Un miembro que ya tiene todos sus caballos no necesita nada.
    grants: [...grants.values()].filter((g) => g.horseIds.length > 0),
    skipped,
  };
}
