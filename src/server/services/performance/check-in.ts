import "server-only";
import { addDays } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import { stripTime } from "./periodization";

export interface PendingCheckIn {
  dailyLoadId: string;
  horseId: string;
  horseName: string;
  date: Date;
  workType: string;
  rpeTarget: number;
  durationMinutes: number;
  plannedLoadUa: number;
}

/**
 * Sesiones planificadas de dias pasados que siguen sin reporte.
 *
 * Es la pieza que sostiene dos cosas a la vez: el aviso "¿Se hizo la sesion?"
 * del inicio y el resumen semanal. Sin confirmar, la carga real se queda a cero
 * y el plan no se reajusta, asi que conviene pedirlo donde el jinete mira.
 */
export async function listPendingCheckIns(
  tx: PrismaClient,
  tenantId: string,
  days = 4,
): Promise<PendingCheckIn[]> {
  const today = stripTime(new Date());
  const from = addDays(today, -days);

  const loads = await tx.dailyLoad.findMany({
    where: {
      tenantId,
      date: { gte: from, lt: today },
      status: { in: ["PLANNED", "ADJUSTED"] },
      workType: { not: "DESCANSO" },
      horse: { status: { in: ["ACTIVE", "IN_TRAINING"] } },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      workType: true,
      rpeTarget: true,
      durationMinutes: true,
      plannedLoadUa: true,
      horse: { select: { id: true, name: true } },
    },
  });

  return loads.map((load) => ({
    dailyLoadId: load.id,
    horseId: load.horse.id,
    horseName: load.horse.name,
    date: load.date,
    workType: load.workType,
    rpeTarget: load.rpeTarget,
    durationMinutes: load.durationMinutes,
    plannedLoadUa: load.plannedLoadUa,
  }));
}
