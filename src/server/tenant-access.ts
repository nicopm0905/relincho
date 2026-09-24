import "server-only";
import { cache } from "react";
import { prisma } from "@/server/db/prisma";

/**
 * Yeguada y membresia del usuario en ella, en una sola consulta y memorizada
 * durante el render.
 *
 * Cada navegacion del panel pasaba por el layout del tenant, el contexto de
 * tRPC y a veces la propia pagina, y cada uno repetia tenant + membresia por
 * separado: cuatro idas y vueltas en serie a la base de datos antes de pedir
 * un solo dato de la pagina. Con `cache` el primero que la pide paga la
 * consulta y el resto reutiliza el resultado.
 */
export const getTenantAccess = cache(
  async (tenantSlug: string, userId: string | null | undefined) => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        memberships: userId
          ? { where: { userId }, select: { id: true, role: true }, take: 1 }
          : false,
      },
    });
    if (!tenant) return { tenant: null, membership: null };

    const { memberships, ...rest } = tenant;
    return { tenant: rest, membership: memberships?.[0] ?? null };
  },
);
