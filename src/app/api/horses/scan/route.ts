import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { getPlanSnapshot } from "@/server/services/performance/plan-service";
import { chipIdSchema, type ScanResponse } from "@/lib/schemas/performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lectura de chip fisico (NFC/RFID) desde el movil del jinete o veterinario.
 * Devuelve la ficha clinica y deportiva completa del caballo asociado.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = chipIdSchema.safeParse(
    request.nextUrl.searchParams.get("chip_id") ?? "",
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Falta el parametro chip_id o no es valido" },
      { status: 400 },
    );
  }

  const code = parsed.data.trim();

  // Solo se buscan caballos de las cuadras a las que pertenece quien consulta.
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    select: { tenantId: true },
  });
  const tenantIds = memberships.map((m) => m.tenantId);
  if (tenantIds.length === 0) {
    return NextResponse.json({ error: "Sin acceso a ninguna cuadra" }, { status: 403 });
  }

  const horseInclude = {
    vetProfile: true,
    competitionTargets: { orderBy: { targetDate: "asc" } },
    healthEvents: {
      where: { type: "INJURY" },
      orderBy: { date: "desc" },
      take: 20,
    },
  } as const;

  // Se acepta tanto un codigo vinculado desde la app como el numero de
  // microchip real que el veterinario ya tiene apuntado en la ficha.
  const tag = await prisma.chipTag.findFirst({
    where: { chipId: code, active: true, tenantId: { in: tenantIds } },
    include: { horse: { include: horseInclude } },
  });

  const horse =
    tag?.horse ??
    (await prisma.horse.findFirst({
      where: { microchip: code, tenantId: { in: tenantIds } },
      include: horseInclude,
    }));

  if (!horse) {
    return NextResponse.json(
      { error: "Ningún caballo tuyo tiene ese chip o microchip" },
      { status: 404 },
    );
  }

  const snapshot = await getPlanSnapshot({
    tenantId: horse.tenantId,
    horseId: horse.id,
  });
  const nextTarget = horse.competitionTargets.find(
    (t) => t.targetDate >= new Date(),
  );

  const payload: ScanResponse = {
    horse_id: horse.id,
    chip_id: tag?.chipId ?? horse.microchip ?? code,
    name: horse.name,
    discipline: horse.vetProfile?.discipline ?? null,
    competition_target: nextTarget
      ? {
          event_name: nextTarget.name,
          date: nextTarget.targetDate.toISOString().slice(0, 10),
        }
      : null,
    injury_history: horse.healthEvents.map((event) => ({
      date: event.date.toISOString().slice(0, 10),
      type: event.type,
      name: event.name,
      notes: event.notes,
    })),
    periodization_plan: snapshot
      ? {
          current_macrocycle_id: snapshot.macrocycle.id,
          current_mesocycle: snapshot.currentMesocycle?.phase ?? null,
          microcycle_week: snapshot.currentMicrocycle?.weekNumber ?? null,
          daily_load_target: snapshot.today
            ? {
                rpe_target: snapshot.today.rpeTarget,
                duration_minutes: snapshot.today.durationMinutes,
                work_type: snapshot.today.workType,
              }
            : null,
          recovery_metrics: {
            mandatory_rest_days_per_microcycle:
              snapshot.currentMicrocycle?.mandatoryRestDays ?? 2,
            dynamic_buffer_status: snapshot.currentMicrocycle?.bufferStatus ?? "idle",
            fatigue_index_alert:
              snapshot.currentMicrocycle?.bufferStatus === "exhausted",
          },
        }
      : null,
    veterinary_constraints: {
      tendon_history_alert: horse.vetProfile?.tendonHistoryAlert ?? false,
      max_impact_surface_minutes: horse.vetProfile?.maxImpactSurfaceMinutes ?? null,
      max_rpe: horse.vetProfile?.maxRpe ?? null,
    },
  };

  return NextResponse.json(payload);
}
