import "server-only";
import { Role } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/server/db/prisma";

/**
 * Devuelve la lista de ids de caballos que el miembro actual puede ver.
 *
 * - OWNER / MANAGER / GROOM: acceso a toda la cuadra -> `null`.
 * - VET_EXTERNAL / OWNER_EXTERNAL: solo los caballos con un registro explicito
 *   en `HorseAccess` para su `membershipId` -> `string[]` (puede ser `[]`).
 *
 * Cuando devuelve un array, el llamante debe anadir
 * `where: { id: { in: ids } }` / `where: { horseId: { in: ids } }`.
 */
export async function allowedHorseIds(ctx: {
  role: Role;
  membershipId: string;
}): Promise<string[] | null> {
  if (
    ctx.role === Role.OWNER ||
    ctx.role === Role.MANAGER ||
    ctx.role === Role.GROOM
  ) {
    return null;
  }

  const rows = await prisma.horseAccess.findMany({
    where: { membershipId: ctx.membershipId },
    select: { horseId: true },
  });
  return rows.map((r) => r.horseId);
}

type AccessCtx = { role: Role; membershipId: string };

/**
 * Fragmento `where` para listas de registros que cuelgan de un caballo
 * (movimientos, documentos, tareas...). Personal interno: sin filtro. Externo:
 * solo sus caballos; `field` es la columna que apunta al caballo.
 *
 * Uso: `where: { tenantId, ...(await horseScope(ctx)) }`.
 */
export async function horseScope(
  ctx: AccessCtx,
  field: string = "horseId",
): Promise<Record<string, { in: string[] }>> {
  const ids = await allowedHorseIds(ctx);
  return ids ? { [field]: { in: ids } } : {};
}

/**
 * Corta con NOT_FOUND si el miembro no puede ver ese caballo. NOT_FOUND y no
 * FORBIDDEN: a un externo no le decimos que el caballo existe.
 */
export async function assertHorseAccess(ctx: AccessCtx, horseId: string) {
  const ids = await allowedHorseIds(ctx);
  if (ids && !ids.includes(horseId)) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
}
