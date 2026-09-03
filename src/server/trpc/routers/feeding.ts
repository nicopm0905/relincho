import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";

export const feedingRouter = createTRPCRouter({
  // Obtiene los caballos con plan de dieta y su estado actual para la comida indicada
  getDailyStatus: tenantProcedure
    .input(z.object({
      mealType: z.string(), // "MAÑANA", "MEDIODIA", "TARDE"
      date: z.string(), // YYYY-MM-DD local time string
    }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const startOfDay = new Date(input.date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(input.date);
        endOfDay.setHours(23, 59, 59, 999);

        // Traer caballos activos con plan de dieta
        const horses = await tx.horse.findMany({
          where: {
            tenantId: ctx.tenantId,
            status: "ACTIVE",
            feedingPlan: { isNot: null }
          },
          include: {
            feedingPlan: true,
            feedingLogs: {
              where: {
                mealType: input.mealType,
                date: {
                  gte: startOfDay,
                  lte: endOfDay
                }
              }
            }
          },
          orderBy: {
            boxLocation: "asc" // Agrupación natural por ubicación
          }
        });

        return horses.map(horse => {
          const log = horse.feedingLogs?.[0];
          return {
            horseId: horse.id,
            horseName: horse.name,
            photoUrl: horse.photoUrl,
            boxLocation: horse.boxLocation,
            diet: horse.feedingPlan?.items || [],
            status: log ? log.status : "PENDING"
          };
        });
      });
    }),

  // Marca una ración como completada o saltada
  logMeal: tenantProcedure
    .input(z.object({
      horseId: z.string(),
      mealType: z.string(),
      status: z.enum(["DONE", "SKIPPED"]),
      date: z.string() // YYYY-MM-DD
    }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const targetDate = new Date(input.date);
        // Normalize time to noon to avoid timezone issues when fetching by day
        targetDate.setHours(12, 0, 0, 0);

        // Upsert log
        return tx.feedingLog.upsert({
          where: {
            horseId_date_mealType: {
              horseId: input.horseId,
              date: targetDate,
              mealType: input.mealType
            }
          },
          update: {
            status: input.status
          },
          create: {
            tenantId: ctx.tenantId,
            horseId: input.horseId,
            date: targetDate,
            mealType: input.mealType,
            status: input.status
          }
        });
      });
    }),

  // Obtiene el plan de alimentación de un caballo
  getByHorseId: tenantProcedure
    .input(z.object({ horseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.feedingPlan.findUnique({
          where: { horseId: input.horseId }
        })
      );
    }),

  // Crea o actualiza la dieta / plan de alimentación
  upsertPlan: tenantProcedure
    .input(
      z.object({
        horseId: z.string(),
        items: z.array(
          z.object({
            meal: z.string(),
            food: z.string(),
            quantity: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.feedingPlan.upsert({
          where: { horseId: input.horseId },
          update: { items: input.items },
          create: { tenantId: ctx.tenantId, horseId: input.horseId, items: input.items },
        })
      );
    }),
});
