import "server-only";
import { addDays, startOfWeek } from "date-fns";
import { withTenant } from "@/server/db/prisma";
import { stripTime } from "./periodization";
import { listPendingCheckIns, type PendingCheckIn } from "./check-in";

export interface DigestHorse {
  horseId: string;
  name: string;
}

export interface WeeklyDigest {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  /** Lunes de la semana que se resume. */
  weekStart: Date;
  plannedLoadUa: number;
  actualLoadUa: number;
  pendingCheckIns: PendingCheckIn[];
  tendonAlerts: DigestHorse[];
  bufferExhausted: DigestHorse[];
}

/**
 * Solo se manda correo cuando hay algo que contar. Un resumen vacio cada lunes
 * es la forma mas rapida de que la gente marque el remitente como spam.
 */
export function digestHasNews(digest: WeeklyDigest): boolean {
  return (
    digest.pendingCheckIns.length > 0 ||
    digest.tendonAlerts.length > 0 ||
    digest.bufferExhausted.length > 0 ||
    (digest.plannedLoadUa > 0 && digest.actualLoadUa === 0)
  );
}

/**
 * Foto de la semana en curso para una yeguada: carga planificada contra real,
 * sesiones sin confirmar y caballos que piden atencion. Son exactamente los
 * tres numeros que el panel de inicio pone delante del usuario, pero enviados
 * sin que tenga que abrir la app.
 */
export async function buildWeeklyDigest(
  tenantId: string,
): Promise<WeeklyDigest> {
  return withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true },
    });
    if (!tenant) {
      throw new Error(`Tenant no encontrado: ${tenantId}`);
    }

    const today = stripTime(new Date());
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });

    const days = await tx.dailyLoad.findMany({
      where: {
        tenantId,
        date: { gte: weekStart, lt: addDays(weekStart, 7) },
      },
      select: { plannedLoadUa: true, actualLoadUa: true },
    });
    const plannedLoadUa = days.reduce((sum, day) => sum + day.plannedLoadUa, 0);
    const actualLoadUa = days.reduce(
      (sum, day) => sum + (day.actualLoadUa ?? 0),
      0,
    );

    const tendonProfiles = await tx.veterinaryProfile.findMany({
      where: {
        tenantId,
        tendonHistoryAlert: true,
        horse: { status: { in: ["ACTIVE", "IN_TRAINING"] } },
      },
      select: { horse: { select: { id: true, name: true } } },
    });

    const exhaustedMicrocycles = await tx.microcycle.findMany({
      where: { tenantId, bufferStatus: "exhausted", endDate: { gte: today } },
      select: {
        mesocycle: {
          select: {
            macrocycle: {
              select: { horse: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    // Una semana atras: de lunes a lunes, el resumen tambien cierra la del
    // domingo anterior.
    const pendingCheckIns = await listPendingCheckIns(tx, tenantId, 7);

    return {
      tenantId,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      weekStart,
      plannedLoadUa,
      actualLoadUa,
      pendingCheckIns,
      tendonAlerts: tendonProfiles.map((profile) => ({
        horseId: profile.horse.id,
        name: profile.horse.name,
      })),
      bufferExhausted: exhaustedMicrocycles.map((microcycle) => {
        const horse = microcycle.mesocycle.macrocycle.horse;
        return { horseId: horse.id, name: horse.name };
      }),
    };
  });
}
