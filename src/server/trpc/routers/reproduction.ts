import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { withTenant } from "@/server/db/prisma";

export const reproductionRouter = createTRPCRouter({
  listActiveCycles: tenantProcedure
    .input(z.object({ season: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const currentSeason = input.season || new Date().getFullYear();
      
      const cycles = await withTenant(ctx.tenantId, (tx) => tx.reproductionCycle.findMany({
        where: {
          tenantId: ctx.tenantId,
          season: currentSeason,
        },
        include: {
          mare: true,
          coverings: {
            orderBy: { date: 'desc' },
            take: 1, // Get the latest covering to determine current status
            include: {
              stallion: true,
              pregnancyChecks: {
                orderBy: { date: 'desc' },
                take: 1,
              },
              foaling: true,
            }
          }
        },
        orderBy: {
          mare: { name: 'asc' }
        }
      }));
      
      return cycles;
    }),

  getCycleDetails: tenantProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cycle = await withTenant(ctx.tenantId, (tx) => tx.reproductionCycle.findUnique({
        where: {
          id: input.cycleId,
          tenantId: ctx.tenantId,
        },
        include: {
          mare: true,
          coverings: {
            orderBy: { date: 'asc' },
            include: {
              stallion: true,
              pregnancyChecks: {
                orderBy: { date: 'asc' },
              },
              foaling: true,
            }
          }
        }
      }));

      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ciclo no encontrado" });
      }

      return cycle;
    }),

  createCycle: tenantProcedure
    .input(z.object({
      mareId: z.string(),
      season: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Comprobar que la yegua pertenece al tenant y es hembra
      const mare = await withTenant(ctx.tenantId, (tx) => tx.horse.findUnique({
        where: { id: input.mareId, tenantId: ctx.tenantId, sex: "FEMALE" },
      }));

      if (!mare) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Yegua no encontrada o no es hembra" });
      }

      // Evitar duplicados para la misma temporada
      const existing = await withTenant(ctx.tenantId, (tx) => tx.reproductionCycle.findFirst({
        where: { mareId: input.mareId, season: input.season }
      }));

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "La yegua ya tiene un ciclo para esta temporada" });
      }

      return withTenant(ctx.tenantId, (tx) => tx.reproductionCycle.create({
        data: {
          tenantId: ctx.tenantId,
          mareId: input.mareId,
          season: input.season,
          notes: input.notes,
        }
      }));
    }),

  addCovering: tenantProcedure
    .input(z.object({
      cycleId: z.string(),
      stallionId: z.string().optional(),
      method: z.enum(["NATURAL", "AI_FRESH", "AI_REFRIGERATED", "AI_FROZEN", "ET"]),
      date: z.date(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cycle = await withTenant(ctx.tenantId, (tx) => tx.reproductionCycle.findUnique({
        where: { id: input.cycleId, tenantId: ctx.tenantId }
      }));

      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ciclo no encontrado" });
      }

      return withTenant(ctx.tenantId, (tx) => tx.covering.create({
        data: {
          tenantId: ctx.tenantId,
          cycleId: cycle.id,
          mareId: cycle.mareId,
          stallionId: input.stallionId,
          method: input.method,
          date: input.date,
          result: "PENDING", // PENDING, POSITIVE, NEGATIVE, ABORTION
        }
      }));
    }),

  addPregnancyCheck: tenantProcedure
    .input(z.object({
      coveringId: z.string(),
      date: z.date(),
      result: z.string(), // e.g. "POSITIVE", "NEGATIVE", "TWINS"
      dayOfPregnancy: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const covering = await withTenant(ctx.tenantId, (tx) => tx.covering.findUnique({
        where: { id: input.coveringId, tenantId: ctx.tenantId }
      }));

      if (!covering) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cubrición no encontrada" });
      }

      const check = await withTenant(ctx.tenantId, (tx) => tx.pregnancyCheck.create({
        data: {
          coveringId: covering.id,
          date: input.date,
          result: input.result,
          dayOfPregnancy: input.dayOfPregnancy,
        }
      }));

      // Si el resultado es positivo o negativo claro, actualizamos la cubrición
      if (input.result === "POSITIVE" || input.result === "NEGATIVE") {
        await withTenant(ctx.tenantId, (tx) => tx.covering.update({
          where: { id: covering.id },
          data: { result: input.result }
        }));
      }

      return check;
    }),

  addFoaling: tenantProcedure
    .input(z.object({
      coveringId: z.string(),
      date: z.date(),
      sex: z.enum(["MALE", "FEMALE"]).optional(),
      alive: z.boolean().default(true),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const covering = await withTenant(ctx.tenantId, (tx) => tx.covering.findUnique({
        where: { id: input.coveringId, tenantId: ctx.tenantId }
      }));

      if (!covering) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cubrición no encontrada" });
      }

      return withTenant(ctx.tenantId, (tx) => tx.foaling.create({
        data: {
          coveringId: covering.id,
          date: input.date,
          sex: input.sex,
          alive: input.alive,
          notes: input.notes,
        }
      }));
    }),
});
