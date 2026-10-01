import "server-only";
import { prisma } from "@/server/db/prisma";
import { accessState, type TrialValue } from "@/lib/trial";

/**
 * ¿Esta yeguada está en modo lectura porque acabó la prueba sin suscripción?
 * Para las rutas que escriben fuera de tRPC (asistente IA, webhook de
 * sesiones); tRPC lo corta en `init.ts`.
 */
export async function isTrialEnded(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, stripeStatus: true, trialEndsAt: true },
  });
  return tenant ? accessState(tenant).readOnly : false;
}

/** Lo que la yeguada ha metido en la app, para enseñárselo al final de la prueba. */
export async function getTrialValue(tenantId: string): Promise<TrialValue> {
  const [horses, healthEvents, trainingSessions, limbChecks] = await Promise.all([
    prisma.horse.count({ where: { tenantId } }),
    prisma.healthEvent.count({ where: { tenantId } }),
    prisma.trainingSession.count({ where: { tenantId } }),
    prisma.limbCheck.count({ where: { tenantId } }),
  ]);
  return { horses, healthEvents, trainingSessions, limbChecks };
}
