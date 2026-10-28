import "server-only";
import type { Role } from "@prisma/client";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { DEMO_VIEWER_ID, isDemoTenant } from "@/lib/demo";
import { accessState } from "@/lib/trial";
import { cache } from "react";

/**
 * Contexto de cada petición tRPC: sesión de Auth.js, tenant y membresía.
 * Separado de `init.ts` para que los tests construyan las procedures con un
 * contexto falso (`tests/helpers/trpc.ts`) sin cargar Auth.js ni la BD.
 */
export const createTRPCContext = cache(
  async (opts: { headers: Headers; tenantSlug?: string }) => {
    const session = await getSession();
    const user = session?.user ?? null;
    // Misma consulta (y mismo resultado memorizado) que usa el layout del
    // tenant: en un render de servidor no vuelve a ir a la base de datos.
    const { tenant: requestedTenant, membership } = opts.tenantSlug
      ? await getTenantAccess(opts.tenantSlug, user?.id)
      : { tenant: null, membership: null };

    let tenantId: string | null = null;
    let role: Role | null = null;
    let membershipId: string | null = null;
    if (user && requestedTenant && membership) {
      tenantId = requestedTenant.id;
      role = membership.role;
      membershipId = membership.id;
    }

    // Sin membresia, la yeguada de demostracion se sirve igual: es el destino
    // del QR del flyer y no puede acabar en un muro de login. Queda como
    // `isDemo`, que bloquea cualquier escritura mas abajo.
    let isDemo = false;
    let viewer = user;
    if (!tenantId && isDemoTenant(opts.tenantSlug) && requestedTenant) {
      tenantId = requestedTenant.id;
      role = "OWNER";
      isDemo = true;
      // Sin cuenta detras, el contexto necesita un usuario para que el resto
      // de la app no tenga que saber que existe el modo demo. No tiene
      // membresias, asi que no da acceso a nada que no sea esta yeguada.
      viewer =
        viewer ??
        ({
          id: DEMO_VIEWER_ID,
          name: "Visitante de la demo",
          email: null,
          image: null,
        } as NonNullable<typeof user>);
    }

    // Prueba gratuita terminada sin suscripcion: se ve todo, no se apunta nada.
    const trialEnded =
      Boolean(tenantId) &&
      !isDemo &&
      requestedTenant !== null &&
      accessState(requestedTenant).readOnly;

    return {
      user: viewer,
      tenantId,
      role,
      membershipId,
      isDemo,
      trialEnded,
      headers: opts.headers,
    };
  },
);

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
