import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";

export const trainingRouter = createTRPCRouter({
  create: tenantProcedure
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
      return withTenant(ctx.tenantId, (tx) =>
        tx.trainingSession.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.horseId ? { horseId: input.horseId } : {}),
          },
          include: { horse: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        }),
      );
    }),
});
