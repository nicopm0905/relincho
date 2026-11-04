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
 *
 * Se decide por email, con todas sus fichas a la vez (arreglos de la #55): el
 * resultado no depende del orden de las fichas, y una persona recibe como
 * mucho una invitación, porque solo puede tener un rol por centro. Si el mismo
 * email es a la vez veterinario o herrador y propietario, gana PROFESSIONAL y
 * sus caballos van en la invitación con relación OWNER, como el propietario
 * que da clases del roadmap (E1a).
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

/**
 * Ya es miembro: solo se añaden los HorseAccess que le faltan, sin reenviar
 * nada. La relación sale del rol del miembro; para un PROFESSIONAL son sus
 * propios caballos, así que va con relación OWNER.
 */
export interface AccessGrant {
  membershipId: string;
  email: string;
  horseIds: string[];
}

/**
 * Nueva cuenta PROFESSIONAL con su especialidad. Los caballos en los que
 * trabaja los asigna luego el centro; `horseIds` son solo los suyos, de los
 * que es propietario (HorseAccess con relación OWNER).
 */
export interface ProfessionalInvitation {
  email: string;
  contactIds: string[];
  specialty: ProfessionalSpecialty;
  horseIds: string[];
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
  const invitations: ClientInvitation[] = [];
  const professionalInvitations: ProfessionalInvitation[] = [];
  const grants: AccessGrant[] = [];
  const skipped: SkippedContact[] = [];
  const skip = (c: InviteContact, reason: SkipReason) =>
    skipped.push({ contactId: c.id, name: c.name, reason });

  // 1. Fichas invitables, agrupadas por email normalizado.
  const groups = new Map<string, InviteContact[]>();
  for (const c of contacts) {
    if (NOT_INVITABLE_KINDS.has(c.kind)) {
      skip(c, "NOT_INVITABLE");
      continue;
    }
    const email = normalizeEmail(c.email);
    if (!email) {
      skip(c, "NO_EMAIL");
      continue;
    }
    groups.set(email, [...(groups.get(email) ?? []), c]);
  }

  // 2. Una decisión por email, mirando todas sus fichas.
  for (const [email, group] of groups) {
    const member = memberByEmail.get(email);
    if (member && STAFF_ROLES.has(member.role)) {
      for (const c of group) skip(c, "STAFF");
      continue;
    }

    const horseIds = group.reduce<string[]>((acc, c) => union(acc, c.horseIds), []);
    const professionals = group.filter((c) => PROFESSIONAL_KINDS[c.kind]);
    const others = group.filter((c) => !PROFESSIONAL_KINDS[c.kind]);

    if (member) {
      for (const c of professionals) skip(c, "ALREADY_MEMBER");
      if (others.length === 0) continue;
      if (horseIds.length === 0) {
        for (const c of others) skip(c, "NO_HORSES");
        continue;
      }
      const missing = horseIds.filter((id) => !member.horseIds.includes(id));
      // Un miembro que ya tiene todos sus caballos no necesita nada.
      if (missing.length > 0) grants.push({ membershipId: member.membershipId, email, horseIds: missing });
      continue;
    }

    const specialty = specialtyOf(professionals);
    if (specialty) {
      professionalInvitations.push({ email, contactIds: group.map((c) => c.id), specialty, horseIds });
      continue;
    }
    if (horseIds.length === 0) {
      for (const c of group) skip(c, "NO_HORSES");
      continue;
    }
    invitations.push({ email, contactIds: group.map((c) => c.id), horseIds });
  }

  // Los saltados, en el orden en que llegaron las fichas.
  const order = new Map(contacts.map((c, i) => [c.id, i]));
  skipped.sort((a, b) => (order.get(a.contactId) ?? 0) - (order.get(b.contactId) ?? 0));

  return { invitations, professionalInvitations, grants, skipped };
}

/**
 * La especialidad con la que se invita si hay varias fichas profesionales con
 * el mismo email. Sigue el orden de PROFESSIONAL_KINDS, no el de las fichas.
 */
function specialtyOf(professionals: InviteContact[]): ProfessionalSpecialty | null {
  for (const [kind, specialty] of Object.entries(PROFESSIONAL_KINDS)) {
    if (professionals.some((c) => c.kind === kind)) return specialty ?? null;
  }
  return null;
}
