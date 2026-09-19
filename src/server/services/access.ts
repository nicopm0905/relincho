import "server-only";

import { prisma } from "@/server/db/prisma";
import type { Role } from "@prisma/client";

/**
 * Roles con permiso de escritura sobre una yeguada. `GROOM` (mozos) trabaja el
 * dia a dia pero no cambia la configuracion ni factura.
 */
export const WRITE_ROLES: Role[] = ["OWNER", "MANAGER"];

export type TenantAccess = { membershipId: string; role: Role };

/**
 * Comprueba que `userId` pertenece a `tenantId` con uno de los roles dados.
 *
 * Las procedures de tRPC ya reciben el `tenantId` resuelto desde la sesion, pero
 * las server actions lo reciben como argumento desde el navegador: sin esta
 * comprobacion, cualquiera con cuenta podia pedir una subida o un checkout
 * hacia la yeguada de otro.
 *
 * Devuelve `null` cuando no hay permiso: quien llama decide como responderlo.
 */
export async function requireTenantAccess(
  userId: string,
  tenantId: string,
  roles: Role[] = WRITE_ROLES,
): Promise<TenantAccess | null> {
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true, role: true },
  });
  if (!membership) return null;
  if (roles.length > 0 && !roles.includes(membership.role)) return null;
  return { membershipId: membership.id, role: membership.role };
}
