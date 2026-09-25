import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { assertHorseAccess, horseScope } from "../access";
import { TRPCError } from "@trpc/server";
import { withTenant, type PrismaClient } from "@/server/db/prisma";
import { CHECK_RESULTS, coveringResult } from "@/lib/reproduction";
import { reproSettingsInputSchema } from "@/lib/repro-settings";
import { mareInsight, SEASON_CATEGORIES } from "@/lib/repro-engine";
import { EXAM_TREATMENTS, MARE_CONDITIONS } from "@/lib/repro-labels";
import {
  buildReproOverview,
  loadMareHistories,
  loadReproSettings,
} from "@/server/services/reproduction/overview";

const managerProcedure = roleProcedure("OWNER", "MANAGER");
/** Ecografias: tambien el veterinario externo, que es quien las hace. */
const checkProcedure = roleProcedure("OWNER", "MANAGER", "VET_EXTERNAL");

const coveringInput = z.object({
  stallionId: z.string().uuid().optional(),
  method: z.enum(["NATURAL", "AI_FRESH", "AI_REFRIGERATED", "AI_FROZEN", "ET"]),
  date: z.date(),
  notes: z.string().max(1000).optional(),
});

const checkInput = z.object({
  date: z.date(),
  result: z.enum(CHECK_RESULTS),
  dayOfPregnancy: z.number().int().min(0).max(400).optional(),
  vesicleMm: z.number().int().min(1).max(200).optional(),
  heartbeat: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

const mm = z.number().int().min(0).max(80);
const examInput = z.object({
  date: z.date(),
  teasingScore: z.number().int().min(0).max(4).nullish(),
  leftFollicleMm: mm.nullish(),
  rightFollicleMm: mm.nullish(),
  corpusLuteum: z.enum(["NONE", "LEFT", "RIGHT", "BOTH"]).nullish(),
  uterineEdema: z.number().int().min(0).max(3).nullish(),
  uterineFluidMm: z.number().int().min(0).max(100).nullish(),
  cervix: z.enum(["CLOSED", "RELAXING", "OPEN"]).nullish(),
  ovulated: z.boolean().default(false),
  ovulationSide: z.enum(["LEFT", "RIGHT"]).nullish(),
  treatments: z.array(z.enum(EXAM_TREATMENTS)).max(8).default([]),
  notes: z.string().max(2000).nullish(),
});

const foalingInput = z.object({
  date: z.date(),
  sex: z.enum(["MALE", "FEMALE"]).optional(),
  alive: z.boolean().default(true),
  notes: z.string().optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;
function dayOfPregnancy(coveringDate: Date, checkDate: Date) {
  const days = Math.round((checkDate.getTime() - coveringDate.getTime()) / DAY_MS);
  return days >= 0 ? days : undefined;
}

async function findCovering(tx: PrismaClient, tenantId: string, id: string) {
  const covering = await tx.covering.findFirst({ where: { id, tenantId } });
  if (!covering) throw new TRPCError({ code: "NOT_FOUND", message: "Cubrición no encontrada" });
  return covering;
}

async function findCheck(tx: PrismaClient, tenantId: string, id: string) {
  const check = await tx.pregnancyCheck.findFirst({
    where: { id, tenantId },
    include: { covering: { select: { mareId: true } } },
  });
  if (!check) throw new TRPCError({ code: "NOT_FOUND", message: "Ecografía no encontrada" });
  return check;
}

async function findFoaling(tx: PrismaClient, tenantId: string, id: string) {
  const foaling = await tx.foaling.findFirst({ where: { id, tenantId } });
  if (!foaling) throw new TRPCError({ code: "NOT_FOUND", message: "Parto no encontrado" });
  return foaling;
}

async function assertStallion(tx: PrismaClient, tenantId: string, stallionId?: string) {
  if (!stallionId) return;
  const stallion = await tx.horse.count({ where: { id: stallionId, tenantId, sex: "MALE" } });
  if (!stallion) throw new TRPCError({ code: "NOT_FOUND", message: "Semental no encontrado" });
}

/**
 * `Covering.result` refleja siempre su ultima ecografia (ver `coveringResult`).
 * Antes solo se actualizaba con positiva o negativa, y gemelos, reabsorcion o
 * aborto dejaban la cubricion en el estado anterior.
 */
async function syncCoveringResult(tx: PrismaClient, coveringId: string) {
  const checks = await tx.pregnancyCheck.findMany({
    where: { coveringId },
    select: { date: true, result: true },
  });
  await tx.covering.update({
    where: { id: coveringId },
    data: { result: coveringResult(checks) },
  });
}

export const reproductionRouter = createTRPCRouter({
  getCycleDetails: tenantProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await withTenant(ctx.tenantId, async (tx) => {
        const cycle = await tx.reproductionCycle.findUnique({
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
            },
            exams: { orderBy: { date: "asc" } },
          }
        });
        if (!cycle) return null;
        const settings = await loadReproSettings(tx, ctx.tenantId);
        const history = (await loadMareHistories(tx, ctx.tenantId, [cycle.mareId])).get(cycle.mareId)!;
        const seasons = await tx.reproductionCycle.findMany({
          where: { tenantId: ctx.tenantId, mareId: cycle.mareId },
          select: { id: true, season: true },
          orderBy: { season: "desc" },
        });
        return {
          ...cycle,
          settings,
          profile: await tx.mareReproProfile.findUnique({ where: { horseId: cycle.mareId } }),
          seasons,
          insight: mareInsight(history, settings),
        };
      });

      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ciclo no encontrado" });
      }
      await assertHorseAccess(ctx, result.mareId);

      return result;
    }),

  /**
   * Situacion de todas las yeguas: fase, predicciones, avisos y acciones.
   * Es la fuente de la pantalla de Reproduccion, Inicio y el calendario.
   */
  overview: tenantProcedure
    .input(z.object({ season: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const season = input?.season ?? new Date().getFullYear();
      const scope = await horseScope(ctx, "id");
      return withTenant(ctx.tenantId, (tx) =>
        buildReproOverview(tx, ctx.tenantId, season, scope),
      );
    }),

  getSettings: tenantProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) => loadReproSettings(tx, ctx.tenantId));
  }),

  updateSettings: managerProcedure
    .input(reproSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      await withTenant(ctx.tenantId, (tx) =>
        tx.reproSettings.upsert({
          where: { tenantId: ctx.tenantId },
          create: { tenantId: ctx.tenantId, config: input },
          update: { config: input },
        }),
      );
      return input;
    }),

  /** Vuelve a los valores por defecto (los de la literatura veterinaria). */
  resetSettings: managerProcedure.mutation(async ({ ctx }) => {
    await withTenant(ctx.tenantId, (tx) =>
      tx.reproSettings.deleteMany({ where: { tenantId: ctx.tenantId } }),
    );
    return { ok: true };
  }),

  /** Correcciones manuales de la yegua; vacio = aprender del historial. */
  upsertMareProfile: checkProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        cycleLengthDays: z.number().int().min(15).max(30).nullable(),
        estrusLengthDays: z.number().int().min(2).max(10).nullable(),
        gestationDays: z.number().int().min(300).max(380).nullable(),
        preovulatoryFollicleMm: z.number().int().min(25).max(55).nullable(),
        conditions: z.array(z.enum(MARE_CONDITIONS)).max(10),
        notes: z.string().max(2000).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertHorseAccess(ctx, input.horseId);
      const { horseId, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const mare = await tx.horse.count({
          where: { id: horseId, tenantId: ctx.tenantId, sex: "FEMALE" },
        });
        if (!mare) throw new TRPCError({ code: "NOT_FOUND", message: "Yegua no encontrada" });
        return tx.mareReproProfile.upsert({
          where: { horseId },
          create: { tenantId: ctx.tenantId, horseId, ...data },
          update: data,
        });
      });
    }),

  /** Inicia la temporada a todas las yeguas activas que aun no la tienen. */
  startSeasonForAll: managerProcedure
    .input(
      z.object({
        season: z.number().int().min(2000).max(2100),
        mareIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const mares = await tx.horse.findMany({
          where: {
            tenantId: ctx.tenantId,
            sex: "FEMALE",
            status: "ACTIVE",
            ...(input.mareIds ? { id: { in: input.mareIds } } : {}),
            reproCycles: { none: { season: input.season } },
          },
          select: { id: true },
        });
        if (mares.length === 0) return { created: 0 };
        await tx.reproductionCycle.createMany({
          data: mares.map((m) => ({ tenantId: ctx.tenantId, mareId: m.id, season: input.season })),
        });
        return { created: mares.length };
      });
    }),

  /** Exploracion ginecologica. Tambien el veterinario externo, que es quien la hace. */
  addExam: checkProcedure
    .input(examInput.extend({ cycleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { cycleId, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const cycle = await tx.reproductionCycle.findFirst({
          where: { id: cycleId, tenantId: ctx.tenantId },
        });
        if (!cycle) throw new TRPCError({ code: "NOT_FOUND", message: "Temporada no encontrada" });
        await assertHorseAccess(ctx, cycle.mareId);
        return tx.reproExam.create({
          data: {
            ...data,
            ovulationSide: data.ovulated ? data.ovulationSide : null,
            tenantId: ctx.tenantId,
            cycleId: cycle.id,
            mareId: cycle.mareId,
            createdByUserId: ctx.user.id,
          },
        });
      });
    }),

  updateExam: checkProcedure
    .input(examInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const exam = await tx.reproExam.findFirst({ where: { id, tenantId: ctx.tenantId } });
        if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "Exploración no encontrada" });
        await assertHorseAccess(ctx, exam.mareId);
        return tx.reproExam.update({
          where: { id },
          data: data.ovulated === false ? { ...data, ovulationSide: null } : data,
        });
      });
    }),

  deleteExam: checkProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const exam = await tx.reproExam.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
        if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "Exploración no encontrada" });
        await assertHorseAccess(ctx, exam.mareId);
        await tx.reproExam.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),

  createCycle: managerProcedure
    .input(z.object({
      mareId: z.string(),
      season: z.number(),
      category: z.enum(SEASON_CATEGORIES).optional(),
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
          category: input.category,
          notes: input.notes,
        }
      }));
    }),

  addCovering: managerProcedure
    .input(coveringInput.extend({ cycleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const cycle = await tx.reproductionCycle.findFirst({
          where: { id: input.cycleId, tenantId: ctx.tenantId },
        });
        if (!cycle) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Ciclo no encontrado" });
        }
        await assertStallion(tx, ctx.tenantId, input.stallionId);

        return tx.covering.create({
          data: {
            tenantId: ctx.tenantId,
            cycleId: cycle.id,
            mareId: cycle.mareId,
            stallionId: input.stallionId ?? null,
            method: input.method,
            date: input.date,
            notes: input.notes,
            result: "PENDING",
          },
        });
      });
    }),

  updateCovering: managerProcedure
    .input(coveringInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        await findCovering(tx, ctx.tenantId, id);
        await assertStallion(tx, ctx.tenantId, data.stallionId);
        return tx.covering.update({ where: { id }, data });
      });
    }),

  /** Borra la cubricion con sus ecografias y su parto (cascada en BD). */
  deleteCovering: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        await findCovering(tx, ctx.tenantId, input.id);
        await tx.covering.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),

  addPregnancyCheck: checkProcedure
    .input(checkInput.extend({ coveringId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const covering = await findCovering(tx, ctx.tenantId, input.coveringId);
        await assertHorseAccess(ctx, covering.mareId);

        const check = await tx.pregnancyCheck.create({
          data: {
            tenantId: ctx.tenantId,
            coveringId: covering.id,
            date: input.date,
            result: input.result,
            vesicleMm: input.vesicleMm,
            heartbeat: input.heartbeat,
            notes: input.notes,
            // Si no lo dan, se calcula desde la cubricion.
            dayOfPregnancy: input.dayOfPregnancy ?? dayOfPregnancy(covering.date, input.date),
          },
        });
        await syncCoveringResult(tx, covering.id);
        return check;
      });
    }),

  updatePregnancyCheck: checkProcedure
    .input(checkInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const check = await findCheck(tx, ctx.tenantId, id);
        await assertHorseAccess(ctx, check.covering.mareId);
        const updated = await tx.pregnancyCheck.update({ where: { id }, data });
        await syncCoveringResult(tx, check.coveringId);
        return updated;
      });
    }),

  deletePregnancyCheck: checkProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const check = await findCheck(tx, ctx.tenantId, input.id);
        await assertHorseAccess(ctx, check.covering.mareId);
        await tx.pregnancyCheck.delete({ where: { id: input.id } });
        await syncCoveringResult(tx, check.coveringId);
        return { id: input.id };
      });
    }),

  addFoaling: managerProcedure
    .input(foalingInput.extend({ coveringId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const covering = await findCovering(tx, ctx.tenantId, input.coveringId);
        const existing = await tx.foaling.count({ where: { coveringId: covering.id } });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Esta cubrición ya tiene un parto registrado" });
        }
        if (input.date < covering.date) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El parto no puede ser anterior a la cubrición" });
        }
        return tx.foaling.create({
          data: {
            tenantId: ctx.tenantId,
            coveringId: covering.id,
            date: input.date,
            sex: input.sex,
            alive: input.alive,
            notes: input.notes,
          },
        });
      });
    }),

  updateFoaling: managerProcedure
    .input(foalingInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        await findFoaling(tx, ctx.tenantId, id);
        return tx.foaling.update({ where: { id }, data });
      });
    }),

  deleteFoaling: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        await findFoaling(tx, ctx.tenantId, input.id);
        await tx.foaling.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),

  /** Solo un ciclo vacio: con cubriciones hay historial que no se tira de golpe. */
  deleteCycle: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const cycle = await tx.reproductionCycle.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          include: { _count: { select: { coverings: true, exams: true } } },
        });
        if (!cycle) throw new TRPCError({ code: "NOT_FOUND" });
        if (cycle._count.coverings > 0 || cycle._count.exams > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Borra antes sus cubriciones y exploraciones: la temporada tiene historial.",
          });
        }
        await tx.reproductionCycle.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),
});
