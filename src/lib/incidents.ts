/**
 * Incidencias con confirmación de lectura (roadmap §4 E5). Motor puro: el
 * ciclo de vida de una incidencia sin BD ni red. Los routers persisten lo que
 * devuelve y el cron de escalado pregunta a `escalationDue`.
 *
 * El mozo la abre ("manta rota", "cojea", "no ha comido"), cada propietario
 * del caballo la lee y la confirma, y el centro ve quién y cuándo. Si una
 * grave no se confirma a tiempo, se escala una vez. Cada función devuelve una
 * incidencia nueva: no muta la que recibe.
 */

export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH";
export type IncidentCategory =
  | "INJURY"
  | "LAMENESS"
  | "NOT_EATING"
  | "COLIC_SIGNS"
  | "EQUIPMENT"
  | "BEHAVIOR"
  | "OTHER";

/** Quien actúa: su membresía en el centro y su rol (`Role` de Prisma). */
export interface Actor {
  membershipId: string;
  role: string;
}

/** Acuse de un propietario: cuándo se le avisó, cuándo la leyó y cuándo la confirmó. */
export interface Receipt {
  membershipId: string;
  notifiedAt: Date;
  readAt: Date | null;
  acknowledgedAt: Date | null;
}

/** Corrección o seguimiento. La descripción original no se toca (autoría). */
export interface IncidentUpdate {
  authorMembershipId: string;
  text: string;
  at: Date;
}

export interface Incident {
  id: string;
  status: IncidentStatus;
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  createdByMembershipId: string;
  occurredAt: Date;
  receipts: Receipt[];
  updates: IncidentUpdate[];
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  /** Incidencia resuelta de la que esta es continuación. */
  followsId: string | null;
}

export type IncidentErrorCode = "NOT_RECIPIENT" | "FORBIDDEN" | "INVALID_TRANSITION";

/** El router la traduce: NOT_RECIPIENT → NOT_FOUND, FORBIDDEN → FORBIDDEN, INVALID_TRANSITION → BAD_REQUEST. */
export class IncidentError extends Error {
  constructor(public readonly code: IncidentErrorCode) {
    super(code);
    this.name = "IncidentError";
  }
}

/** Personal del centro: el único que resuelve. */
const STAFF_ROLES = new Set(["OWNER", "MANAGER", "GROOM"]);

/**
 * Cuánto se espera la confirmación antes de escalar. Solo las graves escalan:
 * MEDIUM y LOW se quedan en la bandeja (decisión de producto pendiente de
 * validar con el piloto).
 */
export const ESCALATE_AFTER_MS: Record<IncidentSeverity, number | null> = {
  HIGH: 2 * 60 * 60 * 1000,
  MEDIUM: null,
  LOW: null,
};

interface OpenInput {
  createdBy: Actor;
  /** Propietarios del caballo con cuenta (OWNER_EXTERNAL con HorseAccess). */
  owners: Actor[];
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  at: Date;
  id?: string;
}

/**
 * Abre una incidencia OPEN con un acuse por propietario. Si el caballo no
 * tiene propietarios con cuenta, `callOwner` avisa al centro de que hay que
 * llamar: nadie va a confirmarla desde la app.
 */
export function openIncident(input: OpenInput): { incident: Incident; callOwner: boolean } {
  const owners = [...new Map(input.owners.map((o) => [o.membershipId, o])).values()];
  const incident: Incident = {
    id: input.id ?? crypto.randomUUID(),
    status: "OPEN",
    category: input.category,
    severity: input.severity,
    description: input.description,
    createdByMembershipId: input.createdBy.membershipId,
    occurredAt: input.at,
    receipts: owners.map((o) => ({
      membershipId: o.membershipId,
      notifiedAt: input.at,
      readAt: null,
      acknowledgedAt: null,
    })),
    updates: [],
    escalatedAt: null,
    resolvedAt: null,
    resolutionNote: null,
    followsId: null,
  };
  return { incident, callOwner: owners.length === 0 };
}

/** Marca leída para ese propietario (conserva la primera lectura). El personal no deja acuse. */
export function markRead(incident: Incident, membershipId: string, at: Date): Incident {
  if (!incident.receipts.some((r) => r.membershipId === membershipId)) return incident;
  return {
    ...incident,
    receipts: incident.receipts.map((r) =>
      r.membershipId === membershipId && !r.readAt ? { ...r, readAt: at } : r,
    ),
  };
}

/** Confirmación de un propietario. Con la del último, la incidencia pasa a ACKNOWLEDGED. */
export function acknowledge(incident: Incident, membershipId: string, at: Date): Incident {
  if (incident.status === "RESOLVED") throw new IncidentError("INVALID_TRANSITION");
  if (!incident.receipts.some((r) => r.membershipId === membershipId)) {
    throw new IncidentError("NOT_RECIPIENT");
  }
  const receipts = incident.receipts.map((r) =>
    r.membershipId === membershipId
      ? { ...r, readAt: r.readAt ?? at, acknowledgedAt: r.acknowledgedAt ?? at }
      : r,
  );
  const all = receipts.every((r) => r.acknowledgedAt);
  return { ...incident, receipts, status: all ? "ACKNOWLEDGED" : incident.status };
}

/** ¿Toca escalar? Grave, sin confirmar, pasado el plazo y aún no escalada. */
export function escalationDue(incident: Incident, now: Date): boolean {
  const after = ESCALATE_AFTER_MS[incident.severity];
  if (after === null || incident.status !== "OPEN" || incident.escalatedAt) return false;
  return now.getTime() - incident.occurredAt.getTime() >= after;
}

/** Cierra la incidencia. Solo el personal del centro; el propietario no. */
export function resolve(incident: Incident, actor: Actor, at: Date, note: string): Incident {
  if (!STAFF_ROLES.has(actor.role)) throw new IncidentError("FORBIDDEN");
  if (incident.status === "RESOLVED") throw new IncidentError("INVALID_TRANSITION");
  return { ...incident, status: "RESOLVED", resolvedAt: at, resolutionNote: note };
}

/**
 * Una resuelta no se reabre: si el problema vuelve, se abre otra enlazada
 * (`followsId`). Hereda categoría y gravedad salvo que se indiquen.
 */
export function followUp(
  incident: Incident,
  input: Omit<OpenInput, "category" | "severity"> & Partial<Pick<OpenInput, "category" | "severity">>,
): { incident: Incident; callOwner: boolean } {
  if (incident.status !== "RESOLVED") throw new IncidentError("INVALID_TRANSITION");
  const next = openIncident({
    ...input,
    category: input.category ?? incident.category,
    severity: input.severity ?? incident.severity,
  });
  return { ...next, incident: { ...next.incident, followsId: incident.id } };
}

/**
 * Añade una corrección o un seguimiento con autor y hora. Es la única forma
 * de "cambiar" lo contado: la descripción original no se reescribe.
 */
export function addUpdate(incident: Incident, author: Actor, text: string, at: Date): Incident {
  const isRecipient = incident.receipts.some((r) => r.membershipId === author.membershipId);
  if (!STAFF_ROLES.has(author.role) && !isRecipient) throw new IncidentError("FORBIDDEN");
  return {
    ...incident,
    updates: [...incident.updates, { authorMembershipId: author.membershipId, text, at }],
  };
}
