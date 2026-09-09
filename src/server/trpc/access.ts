import "server-only";
import { Role } from "@prisma/client";
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
