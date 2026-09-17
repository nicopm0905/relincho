import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import {
  buildWeeklyDigest,
  digestHasNews,
} from "@/server/services/performance/digest";
import { sendWeeklyDigest } from "@/server/services/notifications/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Resumen semanal por email: carga de la semana, sesiones sin confirmar y
 * alertas de rendimiento. Se lanza solo los lunes desde Vercel Cron y exige el
 * mismo secreto que el cron de recordatorios.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      memberships: {
        where: { role: { in: ["OWNER", "MANAGER"] } },
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const tenant of tenants) {
    try {
      const digest = await buildWeeklyDigest(tenant.id);
      // A quien no le ha pasado nada no se le escribe: un correo vacio cada
      // lunes se acaba marcando como spam.
      if (!digestHasNews(digest)) {
        skipped++;
        continue;
      }

      for (const membership of tenant.memberships) {
        const email = membership.user.email;
        if (!email) continue;
        await sendWeeklyDigest({
          to: email,
          ownerName: membership.user.name ?? email,
          digest,
        });
        sent++;
      }
    } catch (error) {
      failed.push(tenant.id);
      console.error("weekly-digest falló para el tenant", tenant.id, error);
    }
  }

  return NextResponse.json({
    ok: true,
    tenants: tenants.length,
    sent,
    skipped,
    failed,
  });
}
