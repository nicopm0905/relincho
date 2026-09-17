import { z } from "zod";
import { addDays } from "date-fns";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";
import {
  generatePlan,
  getPlanSnapshot,
  markMissedDay,
  reportSession,
} from "@/server/services/performance/plan-service";
import { syncNutritionForDay } from "@/server/services/nutrition/sync";
import { projectNutrition } from "@/server/services/nutrition/projection";
import { stripTime } from "@/server/services/performance/periodization";
import { listPendingCheckIns } from "@/server/services/performance/check-in";
import {
  chipIdSchema,
  disciplineSchema,
  reproductiveStatusSchema,
  sweatLossSchema,
} from "@/lib/schemas/performance";

const dailyProcedure = roleProcedure("OWNER", "MANAGER", "GROOM");

export const performanceRouter = createTRPCRouter({
  // --- Emparejamiento chip fisico <-> caballo -----------------------------
  pairChip: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        chipId: chipIdSchema,
        kind: z.enum(["NFC", "RFID"]).default("NFC"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const horse = await tx.horse.findFirst({
          where: { id: input.horseId, tenantId: ctx.tenantId },
          select: { id: true },
        });
        if (!horse) throw new TRPCError({ code: "NOT_FOUND" });

        const existing = await tx.chipTag.findUnique({
          where: { chipId: input.chipId },
        });
        if (existing && existing.horseId !== input.horseId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ese chip ya esta vinculado a otro caballo.",
          });
        }

        return tx.chipTag.upsert({
          where: { chipId: input.chipId },
          update: {
            horseId: input.horseId,
            kind: input.kind,
            active: true,
            pairedById: ctx.user.id,
            pairedAt: new Date(),
          },
          create: {
            tenantId: ctx.tenantId,
            horseId: input.horseId,
            chipId: input.chipId,
            kind: input.kind,
            pairedById: ctx.user.id,
          },
        });
      });
    }),

  unpairChip: dailyProcedure
    .input(z.object({ chipId: chipIdSchema }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.chipTag.updateMany({
          where: { chipId: input.chipId, tenantId: ctx.tenantId },
          data: { active: false },
        }),
      );
    }),

  chipsByHorse: tenantProcedure
    .input(z.object({ horseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.chipTag.findMany({
          where: { horseId: input.horseId, tenantId: ctx.tenantId },
          orderBy: { pairedAt: "desc" },
        }),
      );
    }),

  // --- Perfil veterinario (restricciones de carga) ------------------------
  getVetProfile: tenantProcedure
    .input(z.object({ horseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.veterinaryProfile.findUnique({ where: { horseId: input.horseId } }),
      );
    }),

  upsertVetProfile: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        discipline: disciplineSchema.optional(),
        baseWeightKg: z.number().positive().max(1200).optional(),
        reproductiveStatus: reproductiveStatusSchema.default("NA"),
        gestationMonth: z.number().int().min(1).max(12).optional(),
        tendonHistoryAlert: z.boolean().default(false),
        maxImpactSurfaceMinutes: z.number().int().min(0).max(240).optional(),
        maxRpe: z.number().int().min(1).max(10).optional(),
        restrictions: z.array(z.string().max(60)).default([]),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { horseId, ...rest } = input;
      return withTenant(ctx.tenantId, (tx) =>
        tx.veterinaryProfile.upsert({
          where: { horseId },
          update: rest,
          create: { tenantId: ctx.tenantId, horseId, ...rest },
        }),
      );
    }),

  // --- Competiciones objetivo --------------------------------------------
  listCompetitions: tenantProcedure
    .input(z.object({ horseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.competitionTarget.findMany({
          where: { horseId: input.horseId, tenantId: ctx.tenantId },
          orderBy: { targetDate: "asc" },
        }),
      );
    }),

  createCompetition: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        name: z.string().min(1).max(160),
        targetDate: z.coerce.date(),
        priority: z.enum(["ALTA", "MEDIA", "BAJA"]).optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.competitionTarget.create({
          data: { tenantId: ctx.tenantId, ...input },
        }),
      );
    }),

  // --- Periodizacion ------------------------------------------------------
  generatePlan: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        competitionTargetId: z.string().uuid().optional(),
        targetDate: z.coerce.date().optional(),
        startDate: z.coerce.date().optional(),
        discipline: disciplineSchema.optional(),
        recoveryBufferPct: z.number().int().min(0).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const plan = await generatePlan({ tenantId: ctx.tenantId, ...input });
        // El plan nace con la dieta de las proximas semanas ya calculada.
        const projection = await projectNutrition({
          tenantId: ctx.tenantId,
          horseId: input.horseId,
        });
        return { ...plan, projectedRations: projection.written };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo generar el plan",
        });
      }
    }),

  /** Estado de todos los caballos con plan activo, para el panel de rendimiento. */
  overview: tenantProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      const today = stripTime(new Date());
      const horses = await tx.horse.findMany({
        where: { tenantId: ctx.tenantId, status: { in: ["ACTIVE", "IN_TRAINING"] } },
        select: {
          id: true,
          name: true,
          photoUrl: true,
          boxLocation: true,
          vetProfile: {
            select: { discipline: true, tendonHistoryAlert: true },
          },
          macrocycles: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              targetDate: true,
              competitionTarget: { select: { name: true } },
            },
          },
          dailyLoads: {
            where: { date: today },
            take: 1,
            select: {
              workType: true,
              rpeTarget: true,
              durationMinutes: true,
              status: true,
              microcycle: {
                select: {
                  weekNumber: true,
                  bufferStatus: true,
                  mesocycle: { select: { phase: true } },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return horses.map((horse) => {
        const macro = horse.macrocycles[0] ?? null;
        const today = horse.dailyLoads[0] ?? null;
        return {
          horseId: horse.id,
          name: horse.name,
          photoUrl: horse.photoUrl,
          boxLocation: horse.boxLocation,
          discipline: horse.vetProfile?.discipline ?? null,
          tendonHistoryAlert: horse.vetProfile?.tendonHistoryAlert ?? false,
          hasPlan: Boolean(macro),
          targetDate: macro?.targetDate ?? null,
          competitionName: macro?.competitionTarget?.name ?? null,
          phase: today?.microcycle.mesocycle.phase ?? null,
          weekNumber: today?.microcycle.weekNumber ?? null,
          bufferStatus: today?.microcycle.bufferStatus ?? null,
          today: today
            ? {
                workType: today.workType,
                rpeTarget: today.rpeTarget,
                durationMinutes: today.durationMinutes,
                status: today.status,
              }
            : null,
        };
      });
    });
  }),

  /**
   * Sesiones planificadas de dias anteriores que siguen sin reporte. Alimenta
   * el aviso "¿Se hizo la sesion?" del inicio: si nadie confirma las sesiones,
   * la carga semanal se queda a cero y el plan no se reajusta.
   */
  pendingCheckIns: tenantProcedure
    .input(
      z.object({ days: z.number().int().min(1).max(14).default(4) }).optional(),
    )
    .query(({ ctx, input }) =>
      withTenant(ctx.tenantId, (tx) =>
        listPendingCheckIns(tx, ctx.tenantId, input?.days ?? 4),
      ),
    ),

  snapshot: tenantProcedure
    .input(z.object({ horseId: z.string().uuid(), date: z.coerce.date().optional() }))
    .query(async ({ ctx, input }) => {
      return getPlanSnapshot({ tenantId: ctx.tenantId, ...input });
    }),

  /** Reporte de fin de sesion: recalcula el plan y resincroniza la racion. */
  reportSession: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        date: z.coerce.date().default(() => new Date()),
        minutes: z.number().int().min(0).max(600),
        rpe: z.number().int().min(0).max(10),
        riderName: z.string().max(120).optional(),
        notes: z.string().max(2000).optional(),
        sweatLoss: sweatLossSchema.optional(),
        heartRateBpm: z.number().int().min(20).max(260).optional(),
        riderReportedFatigue: z.boolean().optional(),
        strengthSession: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await reportSession({ tenantId: ctx.tenantId, ...input });
      const prescription = await syncNutritionForDay({
        tenantId: ctx.tenantId,
        horseId: input.horseId,
        date: input.date,
        internalLoadUa: result.internalLoadUa,
        sweatLoss: input.sweatLoss ?? null,
        strengthSession: input.strengthSession,
        isProjection: false,
      });

      // Si el plan se ha reajustado, la dieta prevista de los dias siguientes
      // deja de ser valida y hay que rehacerla con las cargas nuevas.
      if (result.adjustments.length > 0) {
        await projectNutrition({
          tenantId: ctx.tenantId,
          horseId: input.horseId,
          from: addDays(input.date, 1),
        });
      }

      return { ...result, prescription };
    }),

  markMissedDay: dailyProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        date: z.coerce.date(),
        reason: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await markMissedDay({ tenantId: ctx.tenantId, ...input });
        if (result.adjustments.length > 0) {
          await projectNutrition({
            tenantId: ctx.tenantId,
            horseId: input.horseId,
            from: input.date,
          });
        }
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo recalcular",
        });
      }
    }),
});
