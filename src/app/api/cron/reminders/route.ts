import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "@/server/db/prisma";
import { syncGestationTasks } from "@/server/services/reproduction/overview";
import { invoiceBalance } from "@/lib/invoice-balance";
import {
  sendHealthReminder,
  isEmailConfigured,
} from "@/server/services/notifications/email";
import { runReminders } from "@/server/services/notifications/reminders";

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
  // Sin CRON_SECRET no se abre a nadie: si no, "Bearer undefined" pasaría.
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Marca como vencidas las facturas emitidas cuyo vencimiento ya paso. Se
  // saltan las rectificativas (no se cobran) y las que ya no se deben: anuladas
  // por una rectificativa o cobradas del todo en cobros parciales.
  const overdueCandidates = await prisma.invoice.findMany({
    where: { status: "ISSUED", dueDate: { lt: new Date() }, rectifiesId: null },
    select: {
      id: true,
      total: true,
      payments: { select: { amount: true } },
      rectifiedBy: { select: { status: true, total: true, rectificationKind: true }, orderBy: { number: "asc" } },
    },
  });
  const dueIds = overdueCandidates
    .filter((inv) => invoiceBalance({ total: inv.total, payments: inv.payments, rectifiers: inv.rectifiedBy }).pending > 0)
    .map((inv) => inv.id);
  const overdue = await prisma.invoice.updateMany({
    where: { id: { in: dueIds }, status: "ISSUED" },
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

  // Avisos de vencimientos sanitarios a centro, propietario y profesional
  // (E3), idempotentes: ver `runReminders`. Sin remitente verificado los
  // avisos quedan en la bandeja y el envío se anota como omitido.
  const emailConfigured = isEmailConfigured();
  const reminders = await runReminders({ now: new Date(), db: prisma, send: sendHealthReminder });

  return NextResponse.json({
    ok: reminders.failed === 0 && reminders.tenantErrors === 0,
    emailConfigured,
    ...(emailConfigured
      ? {}
      : { note: "Falta RESEND_API_KEY o EMAIL_FROM: no se ha enviado ningún recordatorio." }),
    sent: reminders.sent,
    skipped: reminders.skipped,
    failed: reminders.failed,
    events: reminders.events,
    notifications: {
      created: reminders.created,
      duplicates: reminders.duplicates,
      tenantErrors: reminders.tenantErrors,
    },
    invoicesMarkedOverdue: overdue.count,
    gestationTasks,
  });
}
