import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure, staffProcedure } from "../init";
import { assertHorseAccess, horseScope } from "../access";
import { TRPCError } from "@trpc/server";
import { withTenant, type PrismaClient } from "@/server/db/prisma";
import { CHECK_RESULTS, coveringResult } from "@/lib/reproduction";
import { reproSettingsInputSchema } from "@/lib/repro-settings";
import { mareInsight, SEASON_CATEGORIES } from "@/lib/repro-engine";
import { EXAM_TREATMENTS, MARE_CONDITIONS } from "@/lib/repro-labels";
import { seasonStats } from "@/lib/repro-stats";
import { FOALING_COMPLICATIONS } from "@/lib/repro-gestation";
import { methodLabels } from "@/lib/repro-labels";
import {
  syncGestationTasks,
  buildReproOverview,
  loadMareHistories,
  loadReproSettings,
} from "@/server/services/reproduction/overview";

const managerProcedure = roleProcedure("OWNER", "MANAGER");
/** Ecografias: tambien el veterinario externo, que es quien las hace. */
const checkProcedure = roleProcedure("OWNER", "MANAGER", "VET_EXTERNAL");
/** Vigilancia preparto: la hace quien este en la cuadra, tambien el mozo. */
const watchProcedure = roleProcedure("OWNER", "MANAGER", "GROOM", "VET_EXTERNAL");

const coveringInput = z.object({
  stallionId: z.string().uuid().optional(),
  externalStallionName: z.string().trim().max(120).optional(),
  semenBatchId: z.string().uuid().nullish(),
  dosesUsed: z.number().int().min(1).max(50).nullish(),
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

const minutes = z.number().int().min(0).max(24 * 60).nullish();
const foalingInput = z.object({
  date: z.date(),
  sex: z.enum(["MALE", "FEMALE"]).optional(),
  alive: z.boolean().default(true),
  notes: z.string().optional(),
  foalStoodMinutes: minutes,
  foalSuckledMinutes: minutes,
  placentaMinutes: minutes,
  meconiumPassed: z.boolean().nullish(),
  foalIggMgDl: z.number().int().min(0).max(5000).nullish(),
  birthWeightKg: z.number().min(10).max(120).nullish(),
  complications: z.array(z.enum(FOALING_COMPLICATIONS)).max(5).optional(),
});

const semenInput = z.object({
  stallionId: z.string().uuid().nullish(),
  externalStallionName: z.string().trim().max(120).nullish(),
  semenType: z.enum(["FRESH", "REFRIGERATED", "FROZEN"]),
  provider: z.string().trim().max(120).nullish(),
  dosesTotal: z.number().int().min(1).max(10000),
  collectedAt: z.date().nullish(),
  location: z.string().trim().max(120).nullish(),
  costPerDose: z.number().min(0).max(100000).nullish(),
  notes: z.string().max(2000).nullish(),
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

/**
 * El lote es de la yeguada y le quedan dosis. `excludeCoveringId`: al editar
 * una cubricion, sus propias dosis no cuentan como gastadas.
 */
async function assertSemenBatch(
  tx: PrismaClient,
  tenantId: string,
  batchId: string | null | undefined,
  doses: number | null | undefined,
  excludeCoveringId?: string,
) {
  if (!batchId) return;
  const batch = await tx.semenBatch.findFirst({ where: { id: batchId, tenantId } });
  if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Lote de semen no encontrado" });
  const used = await tx.covering.aggregate({
    where: { semenBatchId: batchId, ...(excludeCoveringId ? { id: { not: excludeCoveringId } } : {}) },
    _sum: { dosesUsed: true },
  });
  const left = batch.dosesTotal - (used._sum.dosesUsed ?? 0);
  if ((doses ?? 1) > left) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: left > 0 ? `Solo quedan ${left} dosis en ese lote` : "Ese lote no tiene dosis disponibles",
    });
  }
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
                foalingWatch: { orderBy: { date: "desc" } },
                semenBatch: { select: { id: true, semenType: true, location: true } },
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
          // Decimal no viaja a componentes de cliente.
          coverings: cycle.coverings.map((c) => ({
            ...c,
            foaling: c.foaling
              ? { ...c.foaling, birthWeightKg: c.foaling.birthWeightKg === null ? null : Number(c.foaling.birthWeightKg) }
              : null,
          })),
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
        await assertSemenBatch(tx, ctx.tenantId, input.semenBatchId, input.dosesUsed);

        return tx.covering.create({
          data: {
            tenantId: ctx.tenantId,
            cycleId: cycle.id,
            mareId: cycle.mareId,
            stallionId: input.stallionId ?? null,
            externalStallionName: input.stallionId ? null : input.externalStallionName || null,
            semenBatchId: input.semenBatchId ?? null,
            dosesUsed: input.semenBatchId ? (input.dosesUsed ?? 1) : null,
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
        const current = await findCovering(tx, ctx.tenantId, id);
        await assertStallion(tx, ctx.tenantId, data.stallionId);
        const batchId = data.semenBatchId === undefined ? current.semenBatchId : data.semenBatchId;
        const doses = batchId ? (data.dosesUsed ?? current.dosesUsed ?? 1) : null;
        await assertSemenBatch(tx, ctx.tenantId, batchId, doses, id);
        return tx.covering.update({
          where: { id },
          data: data.semenBatchId !== undefined || data.dosesUsed !== undefined ? { ...data, dosesUsed: doses } : data,
        });
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

  // -------------------------------------------------------------------------
  // F3: preparto, neonato y tareas de hitos
  // -------------------------------------------------------------------------

  /** Vigilancia preparto: ubre, cera, calcio en leche. La registra quien este en la cuadra. */
  addFoalingWatch: watchProcedure
    .input(
      z.object({
        coveringId: z.string().uuid(),
        date: z.date(),
        udderScore: z.number().int().min(0).max(3).nullish(),
        wax: z.boolean().default(false),
        milkCalciumPpm: z.number().int().min(0).max(2000).nullish(),
        relaxation: z.boolean().default(false),
        notes: z.string().max(1000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { coveringId, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const covering = await findCovering(tx, ctx.tenantId, coveringId);
        await assertHorseAccess(ctx, covering.mareId);
        return tx.foalingWatch.create({ data: { ...data, tenantId: ctx.tenantId, coveringId } });
      });
    }),

  deleteFoalingWatch: watchProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const row = await tx.foalingWatch.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          include: { covering: { select: { mareId: true } } },
        });
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        await assertHorseAccess(ctx, row.covering.mareId);
        await tx.foalingWatch.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),

  /**
   * Da de alta al potro como caballo de la yeguada con su genealogia (madre,
   * padre si es de la casa) y fecha de nacimiento, y lo enlaza al parto.
   */
  registerFoal: managerProcedure
    .input(
      z.object({
        foalingId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        sex: z.enum(["MALE", "FEMALE"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const foaling = await tx.foaling.findFirst({
          where: { id: input.foalingId, tenantId: ctx.tenantId },
          include: { covering: { include: { mare: { select: { breed: true } } } } },
        });
        if (!foaling) throw new TRPCError({ code: "NOT_FOUND", message: "Parto no encontrado" });
        if (!foaling.alive) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El parto está registrado sin potro vivo" });
        }
        if (foaling.foalId) {
          throw new TRPCError({ code: "CONFLICT", message: "El potro ya está dado de alta" });
        }
        const sex = input.sex ?? foaling.sex;
        if (!sex) throw new TRPCError({ code: "BAD_REQUEST", message: "Indica el sexo del potro" });
        const foal = await tx.horse.create({
          data: {
            tenantId: ctx.tenantId,
            name: input.name,
            sex,
            birthDate: foaling.date,
            breed: foaling.covering.mare.breed,
            damId: foaling.covering.mareId,
            sireId: foaling.covering.stallionId,
          },
        });
        // Condicional: si otra peticion ya dio de alta al potro, esta falla y la
        // transaccion deshace el caballo recien creado.
        const linked = await tx.foaling.updateMany({
          where: { id: foaling.id, foalId: null },
          data: { foalId: foal.id, sex },
        });
        if (linked.count === 0) {
          throw new TRPCError({ code: "CONFLICT", message: "El potro ya está dado de alta" });
        }
        return foal;
      });
    }),

  /** Crea ya las tareas de los hitos de gestacion proximos (el cron lo hace cada dia). */
  syncGestationTasks: managerProcedure.mutation(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) => syncGestationTasks(tx, ctx.tenantId), { timeout: 60_000 });
  }),

  // -------------------------------------------------------------------------
  // F4: semen y estadisticas
  // -------------------------------------------------------------------------

  listSemen: staffProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      const batches = await tx.semenBatch.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          stallion: { select: { id: true, name: true } },
          coverings: {
            select: {
              id: true,
              date: true,
              dosesUsed: true,
              cycleId: true,
              mare: { select: { name: true } },
            },
            orderBy: { date: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return batches.map((b) => {
        const used = b.coverings.reduce((n, c) => n + (c.dosesUsed ?? 0), 0);
        return {
          ...b,
          costPerDose: b.costPerDose === null ? null : Number(b.costPerDose),
          stallionName: b.stallion?.name ?? b.externalStallionName ?? "Sin semental",
          dosesUsed: used,
          dosesLeft: b.dosesTotal - used,
        };
      });
    });
  }),

  createSemen: managerProcedure.input(semenInput).mutation(async ({ ctx, input }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      await assertStallion(tx, ctx.tenantId, input.stallionId ?? undefined);
      if (!input.stallionId && !input.externalStallionName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Indica el semental" });
      }
      const created = await tx.semenBatch.create({
        data: {
          ...input,
          externalStallionName: input.stallionId ? null : input.externalStallionName,
          tenantId: ctx.tenantId,
        },
      });
      return { id: created.id };
    });
  }),

  updateSemen: managerProcedure
    .input(semenInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const batch = await tx.semenBatch.findFirst({ where: { id, tenantId: ctx.tenantId } });
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Lote no encontrado" });
        await assertStallion(tx, ctx.tenantId, data.stallionId ?? undefined);
        if (data.dosesTotal !== undefined) {
          const used = await tx.covering.aggregate({ where: { semenBatchId: id }, _sum: { dosesUsed: true } });
          if (data.dosesTotal < (used._sum.dosesUsed ?? 0)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Ya se han gastado ${used._sum.dosesUsed} dosis de este lote`,
            });
          }
        }
        await tx.semenBatch.update({ where: { id }, data });
        return { id };
      });
    }),

  /** Las cubriciones que lo usaron se quedan sin lote (no se borran). */
  deleteSemen: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const batch = await tx.semenBatch.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Lote no encontrado" });
        await tx.semenBatch.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),

  stats: tenantProcedure
    .input(z.object({ season: z.number().int().min(2000).max(2100) }))
    .query(async ({ ctx, input }) => {
      const scope = await horseScope(ctx, "mareId");
      return withTenant(ctx.tenantId, async (tx) => {
        const coverings = await tx.covering.findMany({
          where: { tenantId: ctx.tenantId, ...scope },
          select: {
            mareId: true,
            date: true,
            method: true,
            dosesUsed: true,
            externalStallionName: true,
            stallion: { select: { id: true, name: true } },
            pregnancyChecks: { select: { date: true, result: true } },
            foaling: { select: { alive: true } },
          },
        });
        const rows = coverings.map((c) => ({
          ...c,
          stallionKey: c.stallion?.id ?? `ext:${c.externalStallionName ?? "?"}`,
          stallionName: c.stallion?.name ?? c.externalStallionName ?? "Sin semental",
        }));
        const seasons = [...new Set(rows.map((r) => r.date.getFullYear()))].sort((a, b) => b - a);
        return {
          current: seasonStats(rows, input.season, (m) => methodLabels[m] ?? m),
          previous: seasonStats(rows, input.season - 1, (m) => methodLabels[m] ?? m),
          seasons,
        };
      });
    }),
});
