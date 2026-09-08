import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { reportSession } from "@/server/services/performance/plan-service";
import { syncNutritionForDay } from "@/server/services/nutrition/sync";
import { sessionReportSchema } from "@/lib/schemas/performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de ajuste diario.
 *
 * Recoge el reporte de fricción cero del jinete al final del dia (minutos + RPE
 * dictados por voz), recalcula el resto del mesociclo si hay desviacion y
 * resincroniza la racion del dia con el modulo de nutricion.
 *
 * Autenticacion: sesion del usuario, o cabecera
 * `Authorization: Bearer $TRAINING_WEBHOOK_SECRET` para integraciones externas.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.TRAINING_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  const machineAuthorized = Boolean(secret) && authHeader === `Bearer ${secret}`;

  const session = machineAuthorized ? null : await auth();
  if (!machineAuthorized && !session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const parsed = sessionReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (!input.horse_id && !input.chip_id) {
    return NextResponse.json(
      { error: "Indica horse_id o chip_id" },
      { status: 400 },
    );
  }

  const horse = input.chip_id
    ? (
        await prisma.chipTag.findUnique({
          where: { chipId: input.chip_id },
          select: { active: true, tenantId: true, horse: { select: { id: true } } },
        })
      )
    : null;

  let horseId = input.horse_id ?? null;
  let tenantId: string | null = null;

  if (horse) {
    if (!horse.active) {
      return NextResponse.json({ error: "Chip desvinculado" }, { status: 404 });
    }
    horseId = horse.horse.id;
    tenantId = horse.tenantId;
  } else if (horseId) {
    const row = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { tenantId: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Caballo no encontrado" }, { status: 404 });
    }
    tenantId = row.tenantId;
  }

  if (!horseId || !tenantId) {
    return NextResponse.json({ error: "Caballo no encontrado" }, { status: 404 });
  }

  if (!machineAuthorized) {
    const membership = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: session!.user.id, tenantId } },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Sin acceso a este caballo" }, { status: 403 });
    }
  }

  const date = input.date ?? new Date();

  const result = await reportSession({
    tenantId,
    horseId,
    date,
    minutes: input.duration_minutes,
    rpe: input.rpe,
    riderName: input.rider_name,
    notes: input.rider_notes,
    sweatLoss: input.sweat_loss,
    riderReportedFatigue: input.rider_reported_fatigue,
  });

  const prescription = await syncNutritionForDay({
    tenantId,
    horseId,
    date,
    internalLoadUa: result.internalLoadUa,
    sweatLoss: input.sweat_loss ?? null,
    strengthSession: input.strength_session,
  });

  return NextResponse.json({
    horse_id: horseId,
    date: date.toISOString().slice(0, 10),
    training_input: {
      duration_minutes: input.duration_minutes,
      rpe: input.rpe,
      rider_notes: input.rider_notes ?? null,
    },
    calculated_metrics: {
      internal_load_ua: result.internalLoadUa,
      fatigue_zone: result.fatigueZone,
    },
    plan_adjustments: {
      buffer_status: result.bufferStatus,
      adjusted_days: result.adjustments.map((adj) => ({
        date: adj.date.toISOString().slice(0, 10),
        work_type: adj.workType,
        rpe_target: adj.rpeTarget,
        duration_minutes: adj.durationMinutes,
        reason: adj.reason,
      })),
    },
    nutrition_trigger: {
      base_concentrate_grams: Math.round(
        (Number(prescription.concentrateKg) - prescription.extraConcentrateGrams / 1000) *
          1000,
      ),
      dynamic_extra_grams: prescription.extraConcentrateGrams,
      total_tonight_grams: Math.round(Number(prescription.concentrateKg) * 1000),
      add_electrolytes: prescription.electrolytesGrams > 0,
      total_meals: prescription.totalMeals,
      instructions_mozo: prescription.instructionsForStaff,
    },
  });
}
