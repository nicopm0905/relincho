import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import type { Role } from "@prisma/client";
import { TRIAL_ENDED_MESSAGE } from "@/lib/trial";
import { ZodError } from "zod";
import superjson from "superjson";
// Solo el tipo: el contexto real (Auth.js y BD) vive en `./context`, y así
// los tests montan las procedures con un contexto falso sin cargar Auth.js.
import type { TRPCContext } from "./context";

export type { TRPCContext };

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
        "Estás viendo la demo de Relincho: es de solo lectura. Crea tu cuenta y pruébala 21 días gratis.",
    });
  }
  // Mismo sitio y misma regla para la prueba terminada: el cobro va por
  // server actions de Stripe (fuera de tRPC), asi que pagar sigue funcionando.
  if (ctx.trialEnded && type === "mutation") {
    throw new TRPCError({ code: "FORBIDDEN", message: TRIAL_ENDED_MESSAGE });
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

/**
 * Profesionales externos (veterinario, herrador, dentista…). Su puerta es su
 * propio router: `tenantProcedure` les cierra el panel del centro.
 */
export const professionalProcedure = memberProcedure.use(() => {
  throw new Error("no implementado");
});
