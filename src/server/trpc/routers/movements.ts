import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { horseScope } from "../access";
import { withTenant } from "@/server/db/prisma";
import { isValidRega, normalizeCode } from "@/lib/identifiers";

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

/**
 * Por que sale un caballo. Venta y muerte lo dan de baja en la cuadra: antes
 * el libro de movimientos decia "vendido" y la ficha seguia en activo.
 */
const OUTCOME_STATUS = { SALE: "SOLD", DEATH: "DEAD" } as const;
const OUTCOME_REASON = { SALE: "Venta", DEATH: "Muerte", TRANSFER: "Traslado" } as const;

const movementInput = z.object({
  horseId: z.string().uuid(),
  direction: z.enum(["IN", "OUT"]),
  date: z.date(),
  originRega: regaCode,
  destinationRega: regaCode,
  reason: z.string().trim().max(500).optional(),
});

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
      return withTenant(ctx.tenantId, async (tx) => {
        const horse = await tx.horse.findFirst({
          where: { id: data.horseId, tenantId: ctx.tenantId },
          select: { id: true, status: true },
        });
        if (!horse) throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });

        const movement = await tx.movement.create({
          data: {
            ...data,
            tenantId: ctx.tenantId,
            // El motivo se completa con la causa para que el libro se lea solo.
            reason:
              data.direction === "OUT" && outcome
                ? [OUTCOME_REASON[outcome], data.reason].filter(Boolean).join(" · ")
                : data.reason,
          },
        });

        if (data.direction === "OUT" && (outcome === "SALE" || outcome === "DEATH")) {
          await tx.horse.update({
            where: { id: horse.id },
            data: { status: OUTCOME_STATUS[outcome] },
          });
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
        const existing = await tx.movement.count({ where: { id, tenantId: ctx.tenantId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (data.horseId) {
          const horse = await tx.horse.count({ where: { id: data.horseId, tenantId: ctx.tenantId } });
          if (!horse) throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
        }
        return tx.movement.update({ where: { id }, data });
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
