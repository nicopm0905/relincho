import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import {
  buildWeeklyDigest,
  digestHasNews,
} from "@/server/services/performance/digest";
import {
  sendWeeklyDigest,
  isEmailConfigured,
} from "@/server/services/notifications/email";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Resumen semanal por email: carga de la semana, sesiones sin confirmar y
 * alertas de rendimiento. Se lanza solo los lunes desde Vercel Cron (07:00 UTC,
 * o sea las 09:00 de Espana en verano) y exige el mismo secreto que el cron de
 * recordatorios.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: true,
      emailConfigured: false,
      note: "Falta RESEND_API_KEY o EMAIL_FROM: el resumen no se ha enviado a nadie.",
      sent: 0,
    });
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
  let failed = 0;
  const failedTenants: string[] = [];

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
        const result = await sendWeeklyDigest({
          to: email,
          ownerName: membership.user.name ?? email,
          digest,
        });
        if (result.ok) sent++;
        else failed++;
      }
    } catch (error) {
      failedTenants.push(tenant.id);
      await reportError(error, { scope: "cron.weekly-digest", tenantId: tenant.id });
    }
  }

  return NextResponse.json({
    ok: failed === 0 && failedTenants.length === 0,
    emailConfigured: true,
    tenants: tenants.length,
    sent,
    skipped,
    failed,
    failedTenants,
  });
}
