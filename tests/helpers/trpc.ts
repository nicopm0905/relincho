import type { Role } from "@prisma/client";
import type { AnyRouter } from "@trpc/server";
import { createCallerFactory } from "@/server/trpc/init";
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
 * Caller de `router` con el contexto falso de ese miembro.
 *
 * - Tests de procedures (sin BD): pasa un router mínimo hecho con
 *   `tenantProcedure`, `staffProcedure`, `roleProcedure`…
 * - Tests de integración: pasa `appRouter` (importarlo carga Prisma).
 */
export function callerAs<R extends AnyRouter>(router: R, o: FakeMember | null) {
  return createCallerFactory(router)(fakeCtx(o));
}
