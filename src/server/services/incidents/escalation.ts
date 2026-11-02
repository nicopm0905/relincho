import "server-only";
import type { PrismaClient } from "@prisma/client";

import { ESCALATE_AFTER_MS, escalationDue } from "@/lib/incidents";
import { reportError } from "@/lib/observability";
import { prisma } from "@/server/db/prisma";
import { centerManagers, findIncident, INCIDENT_CATEGORY_LABEL, notify, toMotor } from "./store";

export interface EscalationSummary {
  /** Incidencias escaladas en esta pasada. */
  escalated: number;
  /** Avisos nuevos en la bandeja. */
  notified: number;
  /** Incidencias que fallaron (el resto sigue). */
  errors: number;
}

/**
 * Escalado de incidencias graves sin confirmar (E5). Quién escala y cuándo lo
 * decide `escalationDue`; aquí se marca `escalatedAt` y se avisa al centro y
 * a los propietarios que aún no han confirmado.
 *
 * Una sola vez: `escalatedAt` se pone con un `updateMany` condicionado a que
 * siga nulo, así que dos ejecuciones a la vez no escalan dos veces, y el
 * aviso lleva `dedupeKey` por si se repite tras una caída.
 */
export async function runIncidentEscalation({
  now = new Date(),
  db = prisma,
  tenantId,
}: { now?: Date; db?: PrismaClient; tenantId?: string } = {}): Promise<EscalationSummary> {
  const summary: EscalationSummary = { escalated: 0, notified: 0, errors: 0 };
  const severities = (Object.keys(ESCALATE_AFTER_MS) as (keyof typeof ESCALATE_AFTER_MS)[]).filter(
    (s) => ESCALATE_AFTER_MS[s] !== null,
  );
  const candidates = await db.incident.findMany({
    where: { ...(tenantId ? { tenantId } : {}), status: "OPEN", escalatedAt: null, severity: { in: severities } },
    select: { id: true, tenantId: true, tenant: { select: { slug: true } } },
    orderBy: { occurredAt: "asc" },
  });

  for (const c of candidates) {
    try {
      const row = await findIncident(db, c.tenantId, c.id);
      if (!row || !escalationDue(toMotor(row), now)) continue;

      const { count } = await db.incident.updateMany({
        where: { id: row.id, escalatedAt: null },
        data: { escalatedAt: now },
      });
      if (count === 0) continue;
      summary.escalated++;

      const pending = row.receipts.filter((r) => !r.acknowledgedAt).map((r) => r.membershipId);
      const owners = await db.membership.findMany({ where: { id: { in: pending } }, select: { userId: true } });
      const managers = await centerManagers(db, row.tenantId);
      summary.notified += await notify(db, {
        tenantId: row.tenantId,
        userIds: [...managers, ...owners].map((m) => m.userId),
        kind: "INCIDENT_ESCALATION",
        title: `Sin confirmar: ${INCIDENT_CATEGORY_LABEL[row.category].toLowerCase()} de ${row.horse.name}`,
        body: row.description,
        url: `/${c.tenant.slug}`,
        dedupeKey: `incident-escalation:${row.id}`,
      });
    } catch (error) {
      summary.errors++;
      await reportError(error, { scope: "cron-incidents", tenantId: c.tenantId, incidentId: c.id });
    }
  }
  return summary;
}
