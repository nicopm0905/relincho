import type { Role } from "@prisma/client";
import type { TRPCContext } from "@/server/trpc/context";

export interface FakeMember {
  userId?: string;
  tenantId?: string;
  membershipId?: string;
  role?: Role;
  email?: string;
  isDemo?: boolean;
  trialEnded?: boolean;
}

/**
 * Lo que dejaría `createTRPCContext` para ese miembro, sin Auth.js ni BD.
 * `null` en `userId` simula una petición sin sesión.
 */
export function fakeCtx(o: FakeMember | null): TRPCContext {
  if (!o) {
    return {
      user: null,
      tenantId: null,
      role: null,
      membershipId: null,
      isDemo: false,
      trialEnded: false,
      headers: new Headers(),
    };
  }
  const userId = o.userId ?? "user-test";
  return {
    user: { id: userId, email: o.email ?? `${userId}@test.local`, name: "Test", image: null },
    tenantId: o.tenantId ?? "tenant-test",
    role: o.role ?? "OWNER",
    membershipId: o.membershipId ?? "membership-test",
    isDemo: o.isDemo ?? false,
    trialEnded: o.trialEnded ?? false,
    headers: new Headers(),
  };
}

/**
 * Caller con el contexto falso de ese miembro. Recibe el `createCaller` del
 * router (y no el router) para conservar los tipos de cada procedure:
 *
 *   const createCaller = createCallerFactory(router);
 *   await callerAs(createCaller, { role: "GROOM" }).staff();
 *
 * - Tests de procedures (sin BD): un router mínimo hecho con
 *   `tenantProcedure`, `staffProcedure`, `roleProcedure`…
 * - Tests de integración: `createCallerFactory(appRouter)` (carga Prisma).
 */
export function callerAs<TCaller>(
  createCaller: (ctx: TRPCContext) => TCaller,
  o: FakeMember | null,
): TCaller {
  return createCaller(fakeCtx(o));
}
