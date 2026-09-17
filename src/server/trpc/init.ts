import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { DEMO_VIEWER_ID, isDemoTenant } from "@/lib/demo";
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

    // Sin membresia, la yeguada de demostracion se sirve igual: es el destino
    // del QR del flyer y no puede acabar en un muro de login. Queda como
    // `isDemo`, que bloquea cualquier escritura mas abajo.
    let isDemo = false;
    let viewer = user;
    if (!tenantId && isDemoTenant(opts.tenantSlug)) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: opts.tenantSlug },
        select: { id: true },
      });
      if (tenant) {
        tenantId = tenant.id;
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
    }

    return {
      user: viewer,
      tenantId,
      role,
      membershipId,
      isDemo,
      headers: opts.headers,
    };
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

/**
 * Base de todas las procedures. La demo publica es de solo lectura, y este es
 * el unico sitio donde hace falta comprobarlo: cualquier mutation, de cualquier
 * router, se corta aqui.
 */
const baseProcedure = t.procedure.use(({ ctx, next, type }) => {
  if (ctx.isDemo && type === "mutation") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Estás viendo la demo de Relincho: es de solo lectura. Crea tu cuenta gratis para editar.",
    });
  }
  return next();
});

export const publicProcedure = baseProcedure;

export const protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const tenantProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!ctx.tenantId || !ctx.role) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  // En la demo no hay miembro: basta con el tenant resuelto. El resto de la
  // app sigue viendo `membershipId` como no nulo (el acceso de escritura ya
  // esta cortado arriba), asi que no hay que tocar ni un consumidor.
  if (!ctx.membershipId && !ctx.isDemo) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
      role: ctx.role,
      membershipId: ctx.membershipId as string,
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
