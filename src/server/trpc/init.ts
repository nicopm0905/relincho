import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
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
        }
      }
    }

    return { user, tenantId, headers: opts.headers };
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
  if (!ctx.tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user: ctx.user, tenantId: ctx.tenantId } });
});
