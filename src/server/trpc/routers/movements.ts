import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";

const managerProcedure = roleProcedure("OWNER", "MANAGER");

export const movementsRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ horseId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.movement.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.horseId ? { horseId: input.horseId } : {}),
          },
          include: {
            horse: { select: { id: true, name: true, uelnCode: true } },
          },
          orderBy: { date: "desc" },
        })
      );
    }),

  create: managerProcedure
    .input(
      z.object({
        horseId: z.string(),
        direction: z.enum(["IN", "OUT"]),
        date: z.date(),
        originRega: z.string().optional(),
        destinationRega: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.movement.create({
          data: {
            tenantId: ctx.tenantId,
            horseId: input.horseId,
            direction: input.direction,
            date: input.date,
            originRega: input.originRega,
            destinationRega: input.destinationRega,
            reason: input.reason,
          },
        })
      );
    }),
});
