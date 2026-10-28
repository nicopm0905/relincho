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

export interface Actor {
  membershipId: string;
  role: string;
}

export interface Receipt {
  membershipId: string;
  notifiedAt: Date;
  readAt: Date | null;
  acknowledgedAt: Date | null;
}

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
  followsId: string | null;
}

export class IncidentError extends Error {
  constructor(public readonly code: "NOT_RECIPIENT" | "FORBIDDEN" | "INVALID_TRANSITION") {
    super(code);
  }
}

interface OpenInput {
  createdBy: Actor;
  owners: Actor[];
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  at: Date;
}

export function openIncident(_input: OpenInput): { incident: Incident; callOwner: boolean } {
  throw new Error("no implementado");
}
export function markRead(_i: Incident, _membershipId: string, _at: Date): Incident {
  throw new Error("no implementado");
}
export function acknowledge(_i: Incident, _membershipId: string, _at: Date): Incident {
  throw new Error("no implementado");
}
export function escalationDue(_i: Incident, _now: Date): boolean {
  throw new Error("no implementado");
}
export function resolve(_i: Incident, _actor: Actor, _at: Date, _note: string): Incident {
  throw new Error("no implementado");
}
export function followUp(
  _i: Incident,
  _input: Omit<OpenInput, "category" | "severity"> & Partial<Pick<OpenInput, "category" | "severity">>,
): { incident: Incident; callOwner: boolean } {
  throw new Error("no implementado");
}
export function addUpdate(_i: Incident, _author: Actor, _text: string, _at: Date): Incident {
  throw new Error("no implementado");
}
