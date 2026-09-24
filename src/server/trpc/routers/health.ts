import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { allowedHorseIds, assertHorseAccess } from "../access";
import { withTenant, type PrismaClient } from "@/server/db/prisma";
import { TRPCError } from "@trpc/server";
import { HealthEventType } from "@prisma/client";

/**
 * Registrar y corregir tratamientos. Incluye al veterinario externo: es quien
 * los pone, y asi queda anotado en el momento. Solo sobre sus caballos: lo
 * comprueba `assertHorseAccess` en cada mutacion.
 */
const treatmentProcedure = roleProcedure("OWNER", "MANAGER", "GROOM", "VET_EXTERNAL");
const managerProcedure = roleProcedure("OWNER", "MANAGER");

const healthEventInput = z.object({
  type: z.nativeEnum(HealthEventType),
  name: z.string().min(1),
  date: z.date(),
  nextDueDate: z.date().nullish(),
  dose: z.string().optional(),
  vetContactId: z.string().uuid().optional(),
  cost: z.number().positive().nullish(),
  notes: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
});

/** La FK solo exige que el caballo exista, no que sea de esta yeguada. */
async function assertHorsesInTenant(tx: PrismaClient, tenantId: string, horseIds: string[]) {
  const found = await tx.horse.count({ where: { tenantId, id: { in: horseIds } } });
  if (found !== horseIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
  }
}

export const healthRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        horseId: z.string().uuid().optional(),
        type: z.nativeEnum(HealthEventType).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ids = await allowedHorseIds(ctx);
      if (ids && input.horseId && !ids.includes(input.horseId)) return [];
      const horseWhere = ids
        ? { horseId: input.horseId ?? { in: ids } }
        : input.horseId
          ? { horseId: input.horseId }
          : {};
      return withTenant(ctx.tenantId, (tx) =>
        tx.healthEvent.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...horseWhere,
            ...(input.type ? { type: input.type } : {}),
          },
          select: {
            id: true,
            type: true,
            name: true,
            date: true,
            nextDueDate: true,
            dose: true,
            notes: true,
            horse: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        }),
      );
    }),

  upcoming: tenantProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const ids = await allowedHorseIds(ctx);
      const until = new Date();
      until.setDate(until.getDate() + input.days);
      return withTenant(ctx.tenantId, (tx) =>
        tx.healthEvent.findMany({
          where: {
            tenantId: ctx.tenantId,
            nextDueDate: { lte: until, gte: new Date() },
            ...(ids ? { horseId: { in: ids } } : {}),
          },
          select: {
            id: true,
            type: true,
            name: true,
            nextDueDate: true,
            horse: { select: { id: true, name: true } },
          },
          orderBy: { nextDueDate: "asc" },
        }),
      );
    }),

  create: treatmentProcedure
    .input(healthEventInput.extend({ horseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        await assertHorsesInTenant(tx, ctx.tenantId, [input.horseId]);
        await assertHorseAccess(ctx, input.horseId);
        return tx.healthEvent.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
            cost: input.cost ? input.cost.toString() : undefined,
          },
        });
      });
    }),

  /**
   * El mismo tratamiento a varios caballos (vacunar o desparasitar la cuadra
   * entera). Todo o nada: si un caballo no es de la yeguada, no se guarda
   * ninguno.
   */
  createMany: treatmentProcedure
    .input(
      healthEventInput.extend({
        horseIds: z.array(z.string().uuid()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { horseIds, ...event } = input;
      const unique = [...new Set(horseIds)];
      return withTenant(ctx.tenantId, async (tx) => {
        await assertHorsesInTenant(tx, ctx.tenantId, unique);
        const visible = await allowedHorseIds(ctx);
        if (visible && unique.some((id) => !visible.includes(id))) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
        }
        const result = await tx.healthEvent.createMany({
          data: unique.map((horseId) => ({
            ...event,
            horseId,
            tenantId: ctx.tenantId,
            cost: event.cost ? event.cost.toString() : undefined,
          })),
        });
        return { count: result.count };
      });
    }),

  /** Corregir un registro mal metido sin tener que borrarlo y rehacerlo. */
  update: treatmentProcedure
    .input(healthEventInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.healthEvent.findFirst({
          where: { id, tenantId: ctx.tenantId },
          select: { horseId: true },
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await assertHorseAccess(ctx, existing.horseId);
        return tx.healthEvent.update({
          where: { id, tenantId: ctx.tenantId },
          data: {
            ...data,
            // `null` borra la proxima fecha (tratamiento sin repeticion).
            nextDueDate: data.nextDueDate === undefined ? undefined : data.nextDueDate,
            cost:
              data.cost === undefined ? undefined : data.cost === null ? null : data.cost.toString(),
          },
        });
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await withTenant(ctx.tenantId, (tx) =>
        tx.healthEvent.delete({
          where: { id: input.id, tenantId: ctx.tenantId },
        }),
      );
    }),
});
