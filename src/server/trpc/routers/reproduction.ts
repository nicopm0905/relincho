import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { assertHorseAccess, horseScope } from "../access";
import { TRPCError } from "@trpc/server";
import { withTenant, type PrismaClient } from "@/server/db/prisma";
import { CHECK_RESULTS, coveringResult } from "@/lib/reproduction";

const managerProcedure = roleProcedure("OWNER", "MANAGER");
/** Ecografias: tambien el veterinario externo, que es quien las hace. */
const checkProcedure = roleProcedure("OWNER", "MANAGER", "VET_EXTERNAL");

const coveringInput = z.object({
  stallionId: z.string().uuid().optional(),
  method: z.enum(["NATURAL", "AI_FRESH", "AI_REFRIGERATED", "AI_FROZEN", "ET"]),
  date: z.date(),
});

const checkInput = z.object({
  date: z.date(),
  result: z.enum(CHECK_RESULTS),
  dayOfPregnancy: z.number().int().min(0).max(400).optional(),
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

/** `PregnancyCheck` y `Foaling` no llevan tenantId: se comprueba por su cubricion. */
async function findCheck(tx: PrismaClient, tenantId: string, id: string) {
  const check = await tx.pregnancyCheck.findFirst({
    where: { id, covering: { tenantId } },
    include: { covering: { select: { mareId: true } } },
  });
  if (!check) throw new TRPCError({ code: "NOT_FOUND", message: "Ecografía no encontrada" });
  return check;
}

async function findFoaling(tx: PrismaClient, tenantId: string, id: string) {
  const foaling = await tx.foaling.findFirst({ where: { id, covering: { tenantId } } });
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
  listActiveCycles: tenantProcedure
    .input(z.object({ season: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const currentSeason = input.season || new Date().getFullYear();
      const scope = await horseScope(ctx, "mareId");
      
      const cycles = await withTenant(ctx.tenantId, (tx) => tx.reproductionCycle.findMany({
        where: {
          tenantId: ctx.tenantId,
          season: currentSeason,
          ...scope,
        },
        select: {
          id: true,
          season: true,
          mare: { select: { id: true, name: true } },
          coverings: {
            orderBy: { date: 'desc' },
            take: 1, // Get the latest covering to determine current status
            select: {
              id: true,
              date: true,
              result: true,
              stallion: { select: { id: true, name: true } },
              pregnancyChecks: {
                orderBy: { date: 'desc' },
                take: 1,
                select: { result: true, date: true },
              },
              foaling: { select: { id: true, date: true } },
              _count: { select: { pregnancyChecks: true } },
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
      await assertHorseAccess(ctx, cycle.mareId);

      return cycle;
    }),

  createCycle: managerProcedure
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
            coveringId: covering.id,
            date: input.date,
            result: input.result,
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
          include: { _count: { select: { coverings: true } } },
        });
        if (!cycle) throw new TRPCError({ code: "NOT_FOUND" });
        if (cycle._count.coverings > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Borra antes sus cubriciones: el ciclo tiene historial.",
          });
        }
        await tx.reproductionCycle.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),
});
