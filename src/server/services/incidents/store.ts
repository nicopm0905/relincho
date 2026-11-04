import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

import type { Incident, IncidentCategory } from "@/lib/incidents";

/**
 * Incidencias (E5): de la BD al motor puro `src/lib/incidents.ts` y vuelta.
 * El motor decide las transiciones; aquí solo se lee y se guarda.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export const INCIDENT_CATEGORY_LABEL: Record<IncidentCategory, string> = {
  INJURY: "Herida",
  LAMENESS: "Cojera",
  NOT_EATING: "No ha comido",
  COLIC_SIGNS: "Signos de cólico",
  EQUIPMENT: "Material",
  BEHAVIOR: "Comportamiento",
  OTHER: "Incidencia",
};

const withRelations = {
  receipts: true,
  updates: { orderBy: { createdAt: "asc" } },
  horse: { select: { name: true } },
} as const satisfies Prisma.IncidentInclude;

export type IncidentRow = Prisma.IncidentGetPayload<{ include: typeof withRelations }>;

/** La incidencia del centro, o `null`. Quien llama decide si responde NOT_FOUND. */
export function findIncident(db: Db, tenantId: string, id: string): Promise<IncidentRow | null> {
  return db.incident.findFirst({ where: { id, tenantId }, include: withRelations });
}

export function toMotor(row: IncidentRow): Incident {
  return {
    id: row.id,
    status: row.status,
    category: row.category,
    severity: row.severity,
    description: row.description,
    createdByMembershipId: row.createdByMembershipId ?? "",
    occurredAt: row.occurredAt,
    receipts: row.receipts.map((r) => ({
      membershipId: r.membershipId,
      notifiedAt: r.notifiedAt,
      readAt: r.readAt,
      acknowledgedAt: r.acknowledgedAt,
    })),
    updates: row.updates.map((u) => ({
      authorMembershipId: u.authorMembershipId ?? "",
      text: u.text,
      at: u.createdAt,
    })),
    escalatedAt: row.escalatedAt,
    resolvedAt: row.resolvedAt,
    resolutionNote: row.resolutionNote,
    followsId: row.followsId,
  };
}

/** Guarda lo que cambió el motor: estado, cierre y acuses. */
export async function saveTransition(db: Db, before: Incident, after: Incident): Promise<void> {
  await db.incident.update({
    where: { id: after.id },
    data: { status: after.status, resolvedAt: after.resolvedAt, resolutionNote: after.resolutionNote },
  });
  for (const r of after.receipts) {
    const old = before.receipts.find((b) => b.membershipId === r.membershipId);
    if (old && old.readAt === r.readAt && old.acknowledgedAt === r.acknowledgedAt) continue;
    await db.incidentReceipt.update({
      where: { incidentId_membershipId: { incidentId: after.id, membershipId: r.membershipId } },
      data: { readAt: r.readAt, acknowledgedAt: r.acknowledgedAt },
    });
  }
}

/** Usuarios del centro que gestionan: reciben "hay que llamar" y los escalados. */
export async function centerManagers(db: Db, tenantId: string): Promise<{ userId: string }[]> {
  return db.membership.findMany({
    where: { tenantId, role: { in: ["OWNER", "MANAGER"] } },
    select: { userId: true },
  });
}

/**
 * Crea los avisos en la bandeja, uno por usuario y `dedupeKey`. Si ya existe
 * (reintento), no se duplica.
 */
export async function notify(
  db: Db,
  n: {
    tenantId: string;
    userIds: string[];
    kind: "INCIDENT" | "INCIDENT_ESCALATION";
    title: string;
    body: string;
    url: string;
    dedupeKey: string;
  },
): Promise<number> {
  const userIds = [...new Set(n.userIds)];
  if (userIds.length === 0) return 0;
  const { count } = await db.notification.createMany({
    data: userIds.map((userId) => ({
      tenantId: n.tenantId,
      userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      url: n.url,
      dedupeKey: n.dedupeKey,
    })),
    skipDuplicates: true,
  });
  return count;
}
