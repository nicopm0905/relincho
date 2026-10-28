import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";

import { dayWindowUtc } from "@/lib/day-window";
import { reportError } from "@/lib/observability";
import {
  dueReminders,
  recipientsFor,
  reminderDedupeKey,
  reminderOffsets,
  type ReminderMember,
} from "@/lib/reminder-recipients";
import { prisma } from "@/server/db/prisma";
import { sendHealthReminder, type SendResult } from "@/server/services/notifications/email";

/** Estados de caballo que ya no generan avisos de vencimiento. */
export const INACTIVE_HORSE_STATUSES = ["SOLD", "DEAD"] as const;

/**
 * Avisos de vencimientos sanitarios (roadmap §4 E3). El motor puro
 * (`src/lib/reminder-recipients.ts`) decide qué actos avisan hoy y a quién;
 * aquí se ponen la BD y el envío.
 *
 * Idempotente: cada aviso es una `Notification` única por (userId, dedupeKey).
 * Si ya existe, no se crea ni se reenvía, así que relanzar el cron el mismo
 * día no duplica nada. Primero se guarda el aviso y después se envía: ante una
 * caída a mitad, se prefiere un email de menos a uno repetido.
 */

export type ReminderSend = (opts: Parameters<typeof sendHealthReminder>[0]) => Promise<SendResult>;

export type DeliveryStatus = "SENT" | "FAILED" | "SKIPPED";

export interface RemindersSummary {
  /** Actos que avisan hoy (ya descartados los superados por otro posterior). */
  events: number;
  /** Avisos nuevos creados en la bandeja. */
  created: number;
  /** Avisos que ya existían: ni se crean ni se reenvían. */
  duplicates: number;
  sent: number;
  failed: number;
  /** Envíos omitidos porque el email no está configurado. */
  skipped: number;
  /** Centros que no se pudieron procesar (el resto sigue). */
  tenantErrors: number;
}

const DAY_MS = 86_400_000;

export async function runReminders({
  now = new Date(),
  db = prisma,
  send = sendHealthReminder,
}: { now?: Date; db?: PrismaClient; send?: ReminderSend } = {}): Promise<RemindersSummary> {
  const summary: RemindersSummary = {
    events: 0,
    created: 0,
    duplicates: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    tenantErrors: 0,
  };
  const tenants = await db.tenant.findMany({
    select: { id: true, slug: true, name: true, reminderLeadDays: true },
  });
  for (const tenant of tenants) {
    try {
      await remindTenant({ tenant, now, db, send, summary });
    } catch (error) {
      summary.tenantErrors++;
      await reportError(error, { scope: "cron-reminders", tenantId: tenant.id });
    }
  }
  return summary;
}

type TenantRow = { id: string; slug: string; name: string; reminderLeadDays: number };

async function remindTenant({
  tenant,
  now,
  db,
  send,
  summary,
}: {
  tenant: TenantRow;
  now: Date;
  db: PrismaClient;
  send: ReminderSend;
  summary: RemindersSummary;
}) {
  const leadDays = tenant.reminderLeadDays;
  // Ventanas con un día de margen a cada lado: quien decide el día exacto es
  // el motor, con el calendario de Europe/Madrid (`calendarDayOffset`).
  const windows = reminderOffsets(leadDays).map((offset) => {
    const { start, end } = dayWindowUtc(offset, now);
    return { nextDueDate: { gte: new Date(start.getTime() - DAY_MS), lt: new Date(end.getTime() + DAY_MS) } };
  });
  // Un caballo vendido o muerto ya no es de nadie del centro: sus vencimientos
  // no avisan (antes solo llegaban al centro; con E3 llegarían a su antiguo
  // dueño). Uno retirado sigue siendo de su propietario y sí avisa.
  const candidates = await db.healthEvent.findMany({
    where: { tenantId: tenant.id, OR: windows, horse: { status: { notIn: [...INACTIVE_HORSE_STATUSES] } } },
    select: { horseId: true, type: true },
  });
  if (candidates.length === 0) return;

  // Todos los actos de esos caballos y tipos: el motor descarta los vencimientos
  // ya cubiertos por un acto posterior del mismo tipo.
  const events = await db.healthEvent.findMany({
    where: {
      tenantId: tenant.id,
      horseId: { in: [...new Set(candidates.map((c) => c.horseId))] },
      type: { in: [...new Set(candidates.map((c) => c.type))] },
    },
    select: {
      id: true,
      horseId: true,
      type: true,
      name: true,
      date: true,
      nextDueDate: true,
      horse: { select: { name: true } },
    },
  });
  const due = dueReminders(events, { now, leadDays });
  if (due.length === 0) return;
  summary.events += due.length;

  const memberships = await db.membership.findMany({
    where: { tenantId: tenant.id },
    select: {
      userId: true,
      role: true,
      specialty: true,
      user: { select: { email: true, name: true } },
      horseAccess: { select: { horseId: true } },
    },
  });
  const members: ReminderMember[] = memberships.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    role: m.role,
    specialty: m.specialty,
    horseIds: m.horseAccess.map((a) => a.horseId),
  }));
  const names = new Map(memberships.map((m) => [m.userId, m.user.name]));

  for (const { event, daysUntil } of due) {
    const dueDate = event.nextDueDate!;
    const when = daysUntil === 0 ? "hoy" : daysUntil === 1 ? "mañana" : `en ${daysUntil} días`;
    const formattedDate = dueDate.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Madrid",
    });

    for (const recipient of recipientsFor(event, members)) {
      try {
        let notificationId: string;
        const dedupeKey = reminderDedupeKey({ eventId: event.id, daysUntil });
        // Se mira antes de crear: relanzar el cron es normal y, si se dejara
        // todo al P2002, Prisma registraría cada repetición como `prisma:error`
        // y llenaría los logs de falsos errores. El P2002 queda para dos
        // ejecuciones simultáneas.
        const existing = await db.notification.findUnique({
          where: { userId_dedupeKey: { userId: recipient.userId, dedupeKey } },
          select: { id: true },
        });
        if (existing) {
          summary.duplicates++;
          continue;
        }
        try {
          const created = await db.notification.create({
            data: {
              tenantId: tenant.id,
              userId: recipient.userId,
              kind: "HEALTH_DUE",
              title: `${event.name} de ${event.horse.name} ${when}`,
              body: `Fecha prevista: ${formattedDate}`,
              url: `/${tenant.slug}/sanidad`,
              dedupeKey,
            },
            select: { id: true },
          });
          notificationId = created.id;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            summary.duplicates++;
            continue;
          }
          throw error;
        }
        summary.created++;
        if (!recipient.email) continue;

        const result = await safeSend(send, {
          to: recipient.email,
          ownerName: names.get(recipient.userId) ?? recipient.email,
          horseName: event.horse.name,
          eventName: event.name,
          eventType: event.type,
          dueDate,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          daysUntil,
        });
        const status: DeliveryStatus = result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED";
        if (status === "SENT") summary.sent++;
        else if (status === "SKIPPED") summary.skipped++;
        else summary.failed++;
        await db.notificationDelivery.create({
          data: {
            notificationId,
            channel: "EMAIL",
            status,
            error: result.ok ? null : (result.error?.slice(0, 500) ?? null),
          },
        });
      } catch (error) {
        // Un fallo con un destinatario no corta a los demás.
        summary.failed++;
        await reportError(error, { scope: "cron-reminders", tenantId: tenant.id, eventId: event.id });
      }
    }
  }
}

/** El envío nunca lanza hacia arriba: un error es un FAILED con su motivo. */
async function safeSend(send: ReminderSend, opts: Parameters<ReminderSend>[0]): Promise<SendResult> {
  try {
    return await send(opts);
  } catch (error) {
    await reportError(error, { scope: "cron-reminders", step: "send" });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
