import { NextRequest, NextResponse } from "next/server";
import { runIncidentEscalation } from "@/server/services/incidents/escalation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Escalado de incidencias graves sin confirmar (E5): a las 2 horas se avisa
 * al centro y a los propietarios que no la han confirmado, una sola vez.
 * Necesita ejecutarse con frecuencia (p. ej. cada 15 minutos): ver la PR.
 */
export async function GET(req: NextRequest) {
  // Sin CRON_SECRET no se abre a nadie: si no, "Bearer undefined" pasaría.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runIncidentEscalation({ now: new Date() });
  return NextResponse.json({ ok: summary.errors === 0 && summary.failed === 0, ...summary });
}
