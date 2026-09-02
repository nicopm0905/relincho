import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";

export const tasksRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z
        .object({
          done: z.boolean().optional(),
          horseId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.task.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.done !== undefined
              ? { doneAt: input.done ? { not: null } : null }
              : {}),
            ...(input?.horseId ? { horseId: input.horseId } : {}),
          },
          orderBy: { dueDate: "asc" },
        }),
      );
    }),

  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1),
        dueDate: z.date(),
        horseId: z.string().uuid().optional(),
        assigneeMembershipId: z.string().uuid().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.task.create({ data: { ...input, tenantId: ctx.tenantId } }),
      );
    }),

  complete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.task.update({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { doneAt: new Date() },
        }),
      );
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await withTenant(ctx.tenantId, (tx) =>
        tx.task.delete({ where: { id: input.id, tenantId: ctx.tenantId } }),
      );
    }),
});
