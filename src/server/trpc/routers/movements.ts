import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { horseScope } from "../access";
import { withTenant } from "@/server/db/prisma";
import { isValidRega, normalizeCode } from "@/lib/identifiers";
import { CAUSE_LABELS, causeDirection, type MovementCause } from "@/lib/farm-book";

const managerProcedure = roleProcedure("OWNER", "MANAGER");

/** REGA opcional; si viene, con formato oficial y normalizado. */
const regaCode = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? normalizeCode(value) : undefined))
  .refine((value) => value === undefined || isValidRega(value), {
    message: "El código REGA es ES seguido de 12 dígitos (ej. ES110200000123)",
  });

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const plate = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((v) => (v ? v.replace(/[\s-]/g, "").toUpperCase() : undefined));

export const causeSchema = z.enum([
  "APERTURA",
  "NACIMIENTO",
  "COMPRA",
  "RETORNO",
  "TRASLADO_PROVISIONAL",
  "VENTA",
  "SACRIFICIO",
  "MUERTE",
]);

/**
 * Por que sale un caballo. Venta, sacrificio y muerte lo dan de baja en la
 * cuadra; un traslado provisional no (sigue siendo de la explotacion).
 */
const STATUS_AFTER_EXIT: Partial<Record<MovementCause, "SOLD" | "DEAD">> = {
  VENTA: "SOLD",
  SACRIFICIO: "DEAD",
  MUERTE: "DEAD",
};
/** Compatibilidad con el formulario antiguo (venta/muerte/traslado). */
const LEGACY_OUTCOME: Record<"SALE" | "DEATH" | "TRANSFER", MovementCause> = {
  SALE: "VENTA",
  DEATH: "MUERTE",
  TRANSFER: "TRASLADO_PROVISIONAL",
};

const movementInput = z.object({
  horseId: z.string().uuid(),
  direction: z.enum(["IN", "OUT"]),
  date: z.date(),
  cause: causeSchema.optional(),
  originRega: regaCode,
  destinationRega: regaCode,
  reason: text(500),
  documentType: z
    .enum(["GUIA", "CERTIFICADO_SANITARIO", "DOCUMENTO_MOVIMIENTO", "TME", "DIE", "OTRO"])
    .optional(),
  documentNumber: text(60),
  transporterName: text(120),
  transporterId: text(40),
  vehiclePlate: plate,
  trailerPlate: plate,
  expectedReturnDate: z.date().optional().nullable(),
  disposalMethod: z.enum(["RECOGIDA", "ENTERRAMIENTO", "OTRO"]).optional().nullable(),
  disposalPlace: text(200),
  notifiedAt: z.date().optional().nullable(),
});

function checkCause(direction: "IN" | "OUT", cause: MovementCause | undefined) {
  if (cause && causeDirection(cause) !== direction) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `"${CAUSE_LABELS[cause]}" no es ${direction === "IN" ? "un alta" : "una baja"}`,
    });
  }
}

export const movementsRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ horseId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Sin este filtro un veterinario externo veia el libro de movimientos de
      // toda la cuadra, no solo el de sus caballos.
      const scope = await horseScope(ctx);
      return withTenant(ctx.tenantId, (tx) =>
        tx.movement.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.horseId ? { horseId: input.horseId } : {}),
            ...scope,
          },
          include: {
            horse: { select: { id: true, name: true, uelnCode: true, status: true } },
          },
          orderBy: { date: "desc" },
        })
      );
    }),

  create: managerProcedure
    .input(
      movementInput.extend({
        outcome: z.enum(["SALE", "DEATH", "TRANSFER"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { outcome, ...data } = input;
      const cause: MovementCause | undefined =
        data.cause ?? (data.direction === "OUT" && outcome ? LEGACY_OUTCOME[outcome] : undefined);
      checkCause(data.direction, cause);

      return withTenant(ctx.tenantId, async (tx) => {
        const horse = await tx.horse.findFirst({
          where: { id: data.horseId, tenantId: ctx.tenantId },
          select: { id: true, status: true, name: true },
        });
        if (!horse) throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });

        // Coherencia del libro: no se da de alta a quien ya está ni de baja a
        // quien no está (según la última anotación hasta esa fecha).
        const prior = await tx.movement.findFirst({
          where: { tenantId: ctx.tenantId, horseId: data.horseId, date: { lte: data.date } },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          select: { direction: true },
        });
        const presentBefore = prior?.direction === "IN";
        if (data.direction === "IN" && presentBefore) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${horse.name} ya figura en la explotación en esa fecha: anota antes su baja.`,
          });
        }
        if (data.direction === "OUT" && !presentBefore) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${horse.name} no figura en la explotación en esa fecha: abre el libro o anota antes su alta.`,
          });
        }

        const movement = await tx.movement.create({
          data: { ...data, cause, tenantId: ctx.tenantId },
        });

        const after = cause ? STATUS_AFTER_EXIT[cause] : undefined;
        if (data.direction === "OUT" && after) {
          await tx.horse.update({ where: { id: horse.id }, data: { status: after } });
        }
        // Un caballo dado de baja que vuelve a entrar (recompra, error) vuelve a activo.
        if (data.direction === "IN" && (horse.status === "SOLD" || horse.status === "DEAD")) {
          await tx.horse.update({ where: { id: horse.id }, data: { status: "ACTIVE" } });
        }
        return movement;
      });
    }),

  update: managerProcedure
    .input(movementInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.movement.findFirst({
          where: { id, tenantId: ctx.tenantId },
          select: { direction: true },
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        checkCause((data.direction ?? existing.direction) as "IN" | "OUT", data.cause);
        if (data.horseId) {
          const horse = await tx.horse.count({ where: { id: data.horseId, tenantId: ctx.tenantId } });
          if (!horse) throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
        }
        return tx.movement.update({ where: { id }, data });
      });
    }),

  /** Anota la fecha en que se comunicó la baja (muerte) a la Administración. */
  markNotified: managerProcedure
    .input(z.object({ id: z.string().uuid(), date: z.date() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const updated = await tx.movement.updateMany({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { notifiedAt: input.date },
        });
        if (updated.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
        return { id: input.id };
      });
    }),

  /** No toca el estado del caballo: si se dio de baja por error, se corrige en su ficha. */
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.movement.count({ where: { id: input.id, tenantId: ctx.tenantId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await tx.movement.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),
});
