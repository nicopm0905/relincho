import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { allowedHorseIds } from "../access";
import { withTenant } from "@/server/db/prisma";
import { HealthEventType } from "@prisma/client";

const dailyProcedure = roleProcedure("OWNER", "MANAGER", "GROOM");
const managerProcedure = roleProcedure("OWNER", "MANAGER");

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
          include: { horse: { select: { id: true, name: true } } },
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
          include: { horse: { select: { id: true, name: true } } },
          orderBy: { nextDueDate: "asc" },
        }),
      );
    }),

  create: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        type: z.nativeEnum(HealthEventType),
        name: z.string().min(1),
        date: z.date(),
        nextDueDate: z.date().optional(),
        dose: z.string().optional(),
        vetContactId: z.string().uuid().optional(),
        cost: z.number().positive().optional(),
        notes: z.string().optional(),
        attachmentUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.healthEvent.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
            cost: input.cost ? input.cost.toString() : undefined,
          },
        }),
      );
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
