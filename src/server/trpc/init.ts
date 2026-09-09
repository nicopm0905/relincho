import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { cache } from "react";
import { ZodError } from "zod";
import superjson from "superjson";

export const createTRPCContext = cache(
  async (opts: { headers: Headers; tenantSlug?: string }) => {
    const session = await auth();
    const user = session?.user ?? null;

    let tenantId: string | null = null;
    let role: Role | null = null;
    let membershipId: string | null = null;
    if (user && opts.tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: opts.tenantSlug },
        select: { id: true },
      });
      if (tenant) {
        const membership = await prisma.membership.findUnique({
          where: {
            userId_tenantId: { userId: user.id, tenantId: tenant.id },
          },
          select: { id: true, role: true },
        });
        if (membership) {
          tenantId = tenant.id;
          role = membership.role;
          membershipId = membership.id;
        }
      }
    }

    return { user, tenantId, role, membershipId, headers: opts.headers };
  },
);

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!ctx.tenantId || !ctx.role || !ctx.membershipId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
      role: ctx.role,
      membershipId: ctx.membershipId,
    },
  });
});

/**
 * Extiende `tenantProcedure` exigiendo que el rol del miembro este dentro de
 * `allowed`. Lanza FORBIDDEN en caso contrario.
 *
 * Uso: `roleProcedure("OWNER", "MANAGER")`.
 */
export const roleProcedure = (...allowed: Role[]) =>
  tenantProcedure.use(({ ctx, next }) => {
    if (!allowed.includes(ctx.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });
