import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

import { reportError } from "@/lib/observability";
import { sendIncidentAlert, type SendResult } from "@/server/services/notifications/email";

export type IncidentSend = (opts: Parameters<typeof sendIncidentAlert>[0]) => Promise<SendResult>;

export interface DeliverySummary {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Envía por email los avisos de una incidencia (`dedupeKey`) que aún no tienen
 * entrega y la anota en `NotificationDelivery`. Nunca lanza: un fallo con un
 * destinatario es un FAILED con su motivo y los demás siguen. Si se repite,
 * no reenvía lo ya intentado.
 */
export async function deliverIncidentEmails(
  db: PrismaClient | Prisma.TransactionClient,
  { tenantId, dedupeKey, send = sendIncidentAlert }: { tenantId: string; dedupeKey: string; send?: IncidentSend },
): Promise<DeliverySummary> {
  const summary: DeliverySummary = { sent: 0, failed: 0, skipped: 0 };
  const pending = await db.notification.findMany({
    where: { tenantId, dedupeKey, deliveries: { none: { channel: "EMAIL" } } },
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      url: true,
      tenant: { select: { name: true } },
      user: { select: { email: true, name: true } },
    },
  });
  for (const n of pending) {
    let result: SendResult;
    try {
      result = await send({
        to: n.user.email,
        name: n.user.name ?? n.user.email,
        title: n.title,
        body: n.body,
        url: n.url ?? "/",
        tenantName: n.tenant.name,
        escalation: n.kind === "INCIDENT_ESCALATION",
      });
    } catch (error) {
      await reportError(error, { scope: "incident-email", notificationId: n.id });
      result = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    const status = result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED";
    if (status === "SENT") summary.sent++;
    else if (status === "SKIPPED") summary.skipped++;
    else summary.failed++;
    try {
      await db.notificationDelivery.create({
        data: {
          notificationId: n.id,
          channel: "EMAIL",
          status,
          error: result.ok ? null : (result.error?.slice(0, 500) ?? null),
        },
      });
    } catch (error) {
      await reportError(error, { scope: "incident-email", notificationId: n.id, step: "delivery" });
    }
  }
  return summary;
}
