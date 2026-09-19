import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import {
  sendHealthReminder,
  isEmailConfigured,
} from "@/server/services/notifications/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Recordatorios sanitarios y marcado de facturas vencidas.
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

  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 8);

  // Buscar eventos cuyo nextDueDate sea exactamente en 7 días
  const events = await prisma.healthEvent.findMany({
    where: {
      nextDueDate: {
        gte: in7Days,
        lt: tomorrow,
      },
    },
    include: {
      horse: {
        include: {
          tenant: {
            include: {
              memberships: {
                where: { role: { in: ["OWNER", "MANAGER"] } },
                include: { user: true },
              },
            },
          },
        },
      },
    },
  });

  // Sin remitente verificado no se puede enviar nada: se dice en la respuesta
  // en vez de devolver un "ok" con cero envios sin explicar.
  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: true,
      emailConfigured: false,
      note: "Falta RESEND_API_KEY o EMAIL_FROM: no se ha enviado ningún recordatorio.",
      events: events.length,
      invoicesMarkedOverdue: overdue.count,
      sent: 0,
      failed: 0,
      skipped: 0,
    });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const event of events) {
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
  });
}
