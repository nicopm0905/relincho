import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { sendHealthReminder } from "@/server/services/notifications/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let sent = 0;
  for (const event of events) {
    const { horse } = event;
    const { tenant } = horse;

    for (const membership of tenant.memberships) {
      if (!membership.user.email) continue;
      await sendHealthReminder({
        to: membership.user.email,
        ownerName: membership.user.name ?? membership.user.email,
        horseName: horse.name,
        eventName: event.name,
        eventType: event.type,
        dueDate: event.nextDueDate!,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
      });
      sent++;
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    events: events.length,
    invoicesMarkedOverdue: overdue.count,
  });
}
