import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { allowedHorseIds } from "../access";
import { withTenant } from "@/server/db/prisma";

const dailyProcedure = roleProcedure("OWNER", "MANAGER", "GROOM");

export const trainingRouter = createTRPCRouter({
  create: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        date: z.date(),
        riderName: z.string().optional(),
        minutes: z.number().int().positive().default(45),
        type: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.trainingSession.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
          },
        }),
      );
    }),

  list: tenantProcedure
    .input(z.object({ horseId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const ids = await allowedHorseIds(ctx);
      if (ids && input?.horseId && !ids.includes(input.horseId)) return [];
      const horseWhere = ids
        ? { horseId: input?.horseId ?? { in: ids } }
        : input?.horseId
          ? { horseId: input.horseId }
          : {};
      return withTenant(ctx.tenantId, (tx) =>
        tx.trainingSession.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...horseWhere,
          },
          include: { horse: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        }),
      );
    }),
});
