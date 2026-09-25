import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { prisma, withTenant } from "@/server/db/prisma";
import { syncGestationTasks } from "@/server/services/reproduction/overview";
import { dayWindowUtc } from "@/lib/day-window";
import {
  sendHealthReminder,
  isEmailConfigured,
} from "@/server/services/notifications/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Recordatorios sanitarios, marcado de facturas vencidas y tareas de los
 * hitos de gestacion (vacunas, desparasitacion, box de partos).
 *
 * Ojo con la hora: Vercel Cron programa en UTC, asi que la expresion `0 8 * * *`
 * de vercel.json son las 10:00 de Espana en horario de verano.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Marca como vencidas las facturas emitidas cuyo vencimiento ya paso.
  const overdue = await prisma.invoice.updateMany({
    where: {
      status: "ISSUED",
      dueDate: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  });

  // Hitos de gestacion -> tareas. Solo yeguadas con cubriciones en los dos
  // ultimos años; un fallo en una no para al resto.
  const since = new Date(new Date().getFullYear() - 2, 0, 1);
  const breeders = await prisma.covering.findMany({
    where: { date: { gte: since } },
    select: { tenantId: true },
    distinct: ["tenantId"],
  });
  const gestationTasks = { tenants: breeders.length, created: 0, removed: 0, failed: 0 };
  for (const { tenantId } of breeders) {
    try {
      const r = await withTenant(tenantId, (tx) => syncGestationTasks(tx, tenantId), { timeout: 60_000 });
      gestationTasks.created += r.created;
      gestationTasks.removed += r.removed;
    } catch (error) {
      gestationTasks.failed++;
      console.error("[cron] tareas de gestación", tenantId, error);
    }
  }

  // Dos avisos por vencimiento: una semana antes y el mismo dia. Cada ventana
  // es un dia natural completo (ver `dayWindowUtc`); antes mezclaba la hora de
  // ejecucion con una medianoche y cubria solo unas horas.
  const includeRecipients = {
    horse: {
      include: {
        tenant: {
          include: {
            memberships: {
              where: { role: { in: ["OWNER", "MANAGER"] as Role[] } },
              include: { user: true },
            },
          },
        },
      },
    },
  } as const;
  const reminderDays = [7, 0];
  const batches = await Promise.all(
    reminderDays.map(async (daysUntil) => {
      const { start, end } = dayWindowUtc(daysUntil);
      const found = await prisma.healthEvent.findMany({
        where: { nextDueDate: { gte: start, lt: end } },
        include: includeRecipients,
      });
      return found.map((event) => ({ event, daysUntil }));
    }),
  );

  // Si ya se repitio el tratamiento (hay otro del mismo tipo, mas reciente, en
  // ese caballo), el vencimiento antiguo esta cubierto: no se avisa.
  const candidates = batches.flat();
  const superseded = await Promise.all(
    candidates.map(({ event }) =>
      prisma.healthEvent.count({
        where: {
          horseId: event.horseId,
          type: event.type,
          date: { gt: event.date },
          id: { not: event.id },
        },
      }),
    ),
  );
  const events = candidates.filter((_, index) => superseded[index] === 0);

  // Sin remitente verificado no se puede enviar nada: se dice en la respuesta
  // en vez de devolver un "ok" con cero envios sin explicar.
  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: true,
      emailConfigured: false,
      note: "Falta RESEND_API_KEY o EMAIL_FROM: no se ha enviado ningún recordatorio.",
      events: events.length,
      invoicesMarkedOverdue: overdue.count,
      gestationTasks,
      sent: 0,
      failed: 0,
      skipped: 0,
    });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const { event, daysUntil } of events) {
    const { horse } = event;
    const { tenant } = horse;

    for (const membership of tenant.memberships) {
      if (!membership.user.email) continue;
      const result = await sendHealthReminder({
        to: membership.user.email,
        ownerName: membership.user.name ?? membership.user.email,
        horseName: horse.name,
        eventName: event.name,
        eventType: event.type,
        dueDate: event.nextDueDate!,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        daysUntil,
      });
      if (result.ok) sent++;
      else if (result.skipped) skipped++;
      else failed++;
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    emailConfigured: true,
    sent,
    skipped,
    failed,
    events: events.length,
    invoicesMarkedOverdue: overdue.count,
    gestationTasks,
  });
}
