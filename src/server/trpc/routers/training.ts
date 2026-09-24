import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { allowedHorseIds, assertHorseAccess } from "../access";
import { recordSessionWithLoad } from "@/server/services/performance/record-session";
import { withTenant } from "@/server/db/prisma";
import { TRPCError } from "@trpc/server";

const dailyProcedure = roleProcedure("OWNER", "MANAGER", "GROOM");

export const trainingRouter = createTRPCRouter({
  /**
   * Registro rapido. Con `rpe` (el "¿como de duro?" del formulario) pasa por
   * el mismo camino que el panel de rendimiento: carga, plan y racion. Sin el,
   * solo guarda la sesion.
   */
  create: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        date: z.date(),
        riderName: z.string().optional(),
        minutes: z.number().int().positive().max(600).default(45),
        type: z.string().optional(),
        notes: z.string().optional(),
        rpe: z.number().int().min(0).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertHorseAccess(ctx, input.horseId);
      if (input.rpe !== undefined) {
        const result = await recordSessionWithLoad({ tenantId: ctx.tenantId, ...input, rpe: input.rpe });
        return result.session;
      }
      return withTenant(ctx.tenantId, (tx) =>
        tx.trainingSession.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
          },
        }),
      );
    }),

  /**
   * Corregir una sesion mal registrada. Solo los campos del registro rapido;
   * la carga (RPE, fatiga) la recalcula `performance.reportSession`.
   */
  update: dailyProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        date: z.date().optional(),
        riderName: z.string().nullish(),
        minutes: z.number().int().positive().max(600).optional(),
        type: z.string().nullish(),
        notes: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.trainingSession.count({ where: { id, tenantId: ctx.tenantId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        return tx.trainingSession.update({ where: { id }, data });
      });
    }),

  delete: dailyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.trainingSession.count({
          where: { id: input.id, tenantId: ctx.tenantId },
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await tx.trainingSession.delete({ where: { id: input.id } });
        return { id: input.id };
      });
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
