import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";
import { getGroomList, syncNutritionForDay } from "@/server/services/nutrition/sync";
import { stripTime } from "@/server/services/performance/periodization";
import { sweatLossSchema } from "@/lib/schemas/performance";

export const nutritionRouter = createTRPCRouter({
  /** Dieta estatica y techos de seguridad, editables solo desde el panel veterinario. */
  getBaseline: tenantProcedure
    .input(z.object({ horseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.nutritionBaseline.findUnique({ where: { horseId: input.horseId } }),
      );
    }),

  upsertBaseline: tenantProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        baseForageKg: z.number().min(0).max(40),
        baseConcentrateKg: z.number().min(0).max(15),
        proteinPercentTarget: z.number().int().min(8).max(20).default(12),
        mealsPerDay: z.number().int().min(2).max(6).default(3),
        minForagePctBodyweight: z.number().min(1).max(3).default(1.5),
        maxConcentrateKgPerDay: z.number().min(0).max(15),
        maxConcentrateKgPerMeal: z.number().min(0.5).max(5).default(2),
        maxElectrolytesGrams: z.number().int().min(0).max(200).default(90),
        maxVitaminEIu: z.number().int().min(0).max(10000).default(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { horseId, ...rest } = input;
      return withTenant(ctx.tenantId, (tx) =>
        tx.nutritionBaseline.upsert({
          where: { horseId },
          update: rest,
          create: { tenantId: ctx.tenantId, horseId, ...rest },
        }),
      );
    }),

  /** Racion calculada para un dia concreto. */
  getPrescription: tenantProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        date: z.coerce.date().default(() => new Date()),
      }),
    )
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.nutritionPrescription.findUnique({
          where: {
            horseId_date: { horseId: input.horseId, date: stripTime(input.date) },
          },
        }),
      );
    }),

  /** Fuerza el recalculo de la racion (panel veterinario o correccion manual). */
  recompute: tenantProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        date: z.coerce.date().default(() => new Date()),
        internalLoadUa: z.number().int().min(0).max(6000).optional(),
        sweatLoss: sweatLossSchema.optional(),
        strengthSession: z.boolean().optional(),
        ambientTempC: z.number().min(-20).max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return syncNutritionForDay({ tenantId: ctx.tenantId, ...input });
    }),

  /** Vista de fricción cero para el mozo de cuadras. */
  groomList: tenantProcedure
    .input(z.object({ date: z.coerce.date().default(() => new Date()) }))
    .query(async ({ ctx, input }) => {
      return getGroomList({ tenantId: ctx.tenantId, date: input.date });
    }),
});
