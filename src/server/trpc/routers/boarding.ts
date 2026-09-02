import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";

export const boardingRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) =>
      tx.boardingContract.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          horse: { select: { id: true, name: true, photoUrl: true, boxLocation: true } },
          client: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { startDate: "desc" },
      })
    );
  }),

  create: tenantProcedure
    .input(
      z.object({
        horseId: z.string(),
        clientId: z.string(),
        startDate: z.date(),
        monthlyFee: z.number(),
        includes: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.boardingContract.create({
          data: {
            tenantId: ctx.tenantId,
            horseId: input.horseId,
            clientId: input.clientId,
            startDate: input.startDate,
            monthlyFee: input.monthlyFee,
            includes: input.includes,
          },
        })
      );
    }),

  deactivate: tenantProcedure
    .input(z.object({ id: z.string(), endDate: z.date() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.boardingContract.update({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { active: false, endDate: input.endDate },
        })
      );
    }),
});
