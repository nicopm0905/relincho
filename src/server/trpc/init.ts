import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { DEMO_VIEWER_ID, isDemoTenant } from "@/lib/demo";
import { cache } from "react";
import { ZodError } from "zod";
import superjson from "superjson";

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
    const zod = error.cause instanceof ZodError ? error.cause : null;
    return {
      ...shape,
      // Sin esto el mensaje de una validacion es el JSON entero de Zod, y eso
      // es lo que acababa en el toast. Se queda el primer mensaje legible.
      message: zod?.issues[0]?.message ?? shape.message,
      data: {
        ...shape.data,
        zodError:
          zod ? zod.flatten() : null,
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

/**
 * Cualquier miembro de la yeguada, incluido el propietario externo. Solo lo usa
 * `roleProcedure`: el resto de la app parte de `tenantProcedure`.
 */
const memberProcedure = baseProcedure.use(({ ctx, next }) => {
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
 * Base del panel. El propietario externo queda fuera: su unica puerta es el
 * router `portal`, que filtra por sus caballos y sus facturas. Antes la
 * interfaz le redirigia al portal, pero la API seguia abierta y podia pedir
 * facturas, contactos o movimientos de toda la yeguada.
 */
export const tenantProcedure = memberProcedure.use(({ ctx, next }) => {
  if (ctx.role === "OWNER_EXTERNAL") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/**
 * Exige que el rol del miembro este dentro de `allowed`. Lanza FORBIDDEN en
 * caso contrario. Parte de `memberProcedure` para que el portal pueda pedir
 * `roleProcedure("OWNER_EXTERNAL")`.
 *
 * Uso: `roleProcedure("OWNER", "MANAGER")`.
 */
export const roleProcedure = (...allowed: Role[]) =>
  memberProcedure.use(({ ctx, next }) => {
    if (!allowed.includes(ctx.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });

/**
 * Personal de la yeguada (sin externos). Para lo que es del negocio y no de un
 * caballo concreto: facturas, pupilaje, contactos, diario de la cuadra.
 */
export const staffProcedure = roleProcedure("OWNER", "MANAGER", "GROOM");
