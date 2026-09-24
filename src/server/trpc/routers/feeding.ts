import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure, staffProcedure } from "../init";
import { assertHorseAccess } from "../access";
import { withTenant } from "@/server/db/prisma";

const dailyProcedure = roleProcedure("OWNER", "MANAGER", "GROOM");

export const feedingRouter = createTRPCRouter({
  // Obtiene los caballos con plan de dieta y su estado actual para la comida indicada
  getDailyStatus: staffProcedure
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

        // Racion calculada por el motor de nutricion para hoy, si la hay.
        const prescriptionDay = new Date(
          Date.UTC(
            startOfDay.getFullYear(),
            startOfDay.getMonth(),
            startOfDay.getDate(),
          ),
        );

        // Caballos en la cuadra (tambien en doma y retirados: comen igual) con
        // dieta o con racion calculada para hoy. Antes solo "ACTIVE", y se
        // quedaban fuera los de doma, que son los que tienen racion calculada.
        const horses = await tx.horse.findMany({
          where: {
            tenantId: ctx.tenantId,
            status: { notIn: ["SOLD", "DEAD"] },
            OR: [
              { feedingPlan: { isNot: null } },
              { nutritionPrescriptions: { some: { date: prescriptionDay } } },
            ],
          },
          include: {
            feedingPlan: true,
            nutritionPrescriptions: {
              where: { date: prescriptionDay },
              take: 1,
            },
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
          const prescription = horse.nutritionPrescriptions?.[0];
          // La dieta fija se guarda como {meal, food, quantity}: solo las de
          // esta toma. Antes se mandaba entera y la tarjeta leia otros campos
          // (feedName, unit), asi que no salia que pienso era.
          const planItems = Array.isArray(horse.feedingPlan?.items)
            ? (horse.feedingPlan!.items as { meal?: string; food?: string; quantity?: string }[])
            : [];
          const diet = planItems
            .filter((item) => item.meal === input.mealType && item.food)
            .map((item) => ({ food: String(item.food), quantity: String(item.quantity ?? "") }));
          return {
            horseId: horse.id,
            horseName: horse.name,
            photoUrl: horse.photoUrl,
            boxLocation: horse.boxLocation,
            diet,
            status: log ? log.status : "PENDING",
            // Ajuste del dia calculado a partir de la carga de entrenamiento.
            dynamic: prescription
              ? {
                  forageKg: Number(prescription.forageKg),
                  concentrateKg: Number(prescription.concentrateKg),
                  extraGrams: prescription.extraConcentrateGrams,
                  electrolytesGrams: prescription.electrolytesGrams,
                  totalMeals: prescription.totalMeals,
                  instructions: prescription.instructionsForStaff,
                }
              : null,
          };
        });
      });
    }),

  // Marca una ración como completada o saltada
  logMeal: dailyProcedure
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
      await assertHorseAccess(ctx, input.horseId);
      return withTenant(ctx.tenantId, (tx) =>
        tx.feedingPlan.findUnique({
          where: { horseId: input.horseId }
        })
      );
    }),

  // Crea o actualiza la dieta / plan de alimentación
  upsertPlan: dailyProcedure
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
