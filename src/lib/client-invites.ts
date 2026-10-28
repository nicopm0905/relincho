/**
 * Invitar clientes a la app desde Contactos, en lote (roadmap §4 E1b). Motor
 * puro: decide a quién se invita, a quién solo se le da acceso a más caballos
 * y a quién se salta, sin BD ni red. El router lo ejecuta en una transacción.
 *
 * Un contacto es propietario de los caballos cuyo `currentOwnerId` apunta a
 * él. Se agrupa por email normalizado: dos fichas de la misma persona con el
 * email escrito distinto acaban en una sola invitación.
 */

export interface InviteContact {
  id: string;
  name: string;
  email: string | null;
  /** Caballos de los que es propietario. */
  horseIds: string[];
}

export interface ExistingMember {
  membershipId: string;
  /** Email del usuario, tal cual: se normaliza aquí. */
  email: string;
  role: string;
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

export type SkipReason = "NO_EMAIL" | "STAFF";

export interface SkippedContact {
  contactId: string;
  name: string;
  reason: SkipReason;
}

export interface ClientInvitePlan {
  invitations: ClientInvitation[];
  grants: AccessGrant[];
  skipped: SkippedContact[];
}

/** El personal ya ve toda la cuadra: darle HorseAccess no cambia nada. */
const STAFF_ROLES = new Set(["OWNER", "MANAGER", "GROOM"]);

export const normalizeEmail = (email: string | null | undefined) =>
  (email ?? "").trim().toLowerCase();

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

export function planClientInvites(
  contacts: InviteContact[],
  members: ExistingMember[],
): ClientInvitePlan {
  const memberByEmail = new Map(members.map((m) => [normalizeEmail(m.email), m]));
  const invitations = new Map<string, ClientInvitation>();
  const grants = new Map<string, AccessGrant>();
  const skipped: SkippedContact[] = [];

  for (const c of contacts) {
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
    // Un miembro que ya tiene todos sus caballos no necesita nada.
    grants: [...grants.values()].filter((g) => g.horseIds.length > 0),
    skipped,
  };
}
