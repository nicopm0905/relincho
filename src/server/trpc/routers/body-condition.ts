import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, roleProcedure, tenantProcedure } from "../init";
import { assertHorseAccess, allowedHorseIds } from "../access";
import { withTenant } from "@/server/db/prisma";
import { stripTime } from "@/server/services/performance/periodization";
import { getBodyCondition, syncBaseWeight } from "@/server/services/body-condition";
import {
  MEASURE_LIMITS,
  WEIGHT_METHODS,
  ageInMonths,
  weightFromMeasurements,
} from "@/lib/body-condition";

/** Pesar y puntuar lo hace quien está en la cuadra, también el veterinario. */
const recordProcedure = roleProcedure("OWNER", "MANAGER", "GROOM", "VET_EXTERNAL");
const managerProcedure = roleProcedure("OWNER", "MANAGER");

const inRange = (limits: readonly [number, number], label: string) =>
  z
    .number()
    .min(limits[0], `${label}: mínimo ${limits[0]}`)
    .max(limits[1], `${label}: máximo ${limits[1]}`);

const saveInput = z
  .object({
    horseId: z.string().uuid(),
    date: z.date().optional(),
    method: z.enum(WEIGHT_METHODS).nullable().optional(),
    weightKg: inRange(MEASURE_LIMITS.weightKg, "Peso").nullable().optional(),
    girthCm: inRange(MEASURE_LIMITS.girthCm, "Perímetro").nullable().optional(),
    lengthCm: inRange(MEASURE_LIMITS.lengthCm, "Longitud").nullable().optional(),
    bodyCondition: z
      .number()
      .min(1)
      .max(9)
      .refine((v) => Number.isInteger(v * 2), "La condición va de medio en medio punto")
      .nullable()
      .optional(),
    notes: z.string().trim().max(300).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.method === "MEDIDAS" && (v.girthCm == null || v.lengthCm == null)) {
      ctx.addIssue({ code: "custom", message: "Para calcular el peso hacen falta el perímetro y la longitud" });
    }
    if ((v.method === "BASCULA" || v.method === "CINTA") && v.weightKg == null) {
      ctx.addIssue({ code: "custom", message: "Falta el peso" });
    }
    if (!v.method && v.bodyCondition == null) {
      ctx.addIssue({ code: "custom", message: "Anota el peso, la condición corporal o los dos" });
    }
  });

export const bodyConditionRouter = createTRPCRouter({
  /** Pesajes, tendencia, condición corporal y objetivo de un caballo. */
  get: tenantProcedure
    .input(z.object({ horseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertHorseAccess(ctx, input.horseId);
      const data = await withTenant(ctx.tenantId, (tx) => getBodyCondition(tx, ctx.tenantId, input.horseId));
      if (!data) throw new TRPCError({ code: "NOT_FOUND" });
      return data;
    }),

  /**
   * Guarda el pesaje del día (uno por caballo y día: repetirlo lo corrige).
   * Si solo se anota una de las dos cosas, la otra del mismo día se respeta.
   */
  save: recordProcedure.input(saveInput).mutation(async ({ ctx, input }) => {
    await assertHorseAccess(ctx, input.horseId);
    const date = stripTime(input.date ?? new Date());
    return withTenant(ctx.tenantId, async (tx) => {
      const horse = await tx.horse.findFirst({
        where: { id: input.horseId, tenantId: ctx.tenantId },
        select: { birthDate: true },
      });
      if (!horse) throw new TRPCError({ code: "NOT_FOUND" });

      const data: Record<string, unknown> = { recordedById: ctx.user.id };
      if (input.method) {
        const weightKg =
          input.method === "MEDIDAS"
            ? weightFromMeasurements(input.girthCm!, input.lengthCm!, ageInMonths(horse.birthDate, date))
            : input.weightKg!;
        Object.assign(data, {
          method: input.method,
          weightKg,
          girthCm: input.method === "BASCULA" ? null : (input.girthCm ?? null),
          lengthCm: input.method === "MEDIDAS" ? input.lengthCm : null,
        });
      }
      if (input.bodyCondition != null) data.bodyCondition = input.bodyCondition;
      if (input.notes !== undefined) data.notes = input.notes || null;

      const saved = await tx.bodyMeasurement.upsert({
        where: { horseId_date: { horseId: input.horseId, date } },
        update: data,
        create: { tenantId: ctx.tenantId, horseId: input.horseId, date, ...data },
      });
      const baseWeightKg = await syncBaseWeight(tx, ctx.tenantId, input.horseId);
      return { id: saved.id, weightKg: saved.weightKg != null ? Number(saved.weightKg) : null, baseWeightKg };
    });
  }),

  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const row = await tx.bodyMeasurement.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          select: { horseId: true },
        });
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        await tx.bodyMeasurement.delete({ where: { id: input.id } });
        await syncBaseWeight(tx, ctx.tenantId, row.horseId);
        return input;
      });
    }),

  /** Último peso y condición de cada caballo, para el pesaje de la cuadra. */
  herd: tenantProcedure.query(async ({ ctx }) => {
    const ids = await allowedHorseIds(ctx);
    return withTenant(ctx.tenantId, async (tx) => {
      const horses = await tx.horse.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: { in: ["ACTIVE", "IN_TRAINING"] },
          ...(ids ? { id: { in: ids } } : {}),
        },
        select: {
          id: true,
          name: true,
          boxLocation: true,
          birthDate: true,
          bodyMeasurements: {
            orderBy: { date: "desc" },
            take: 6,
            select: { date: true, method: true, weightKg: true, bodyCondition: true },
          },
        },
        orderBy: { name: "asc" },
      });
      return horses.map((h) => {
        const lastWeight = h.bodyMeasurements.find((m) => m.weightKg != null) ?? null;
        const lastCondition = h.bodyMeasurements.find((m) => m.bodyCondition != null) ?? null;
        return {
          id: h.id,
          name: h.name,
          boxLocation: h.boxLocation,
          birthDate: h.birthDate,
          weightKg: lastWeight ? Number(lastWeight.weightKg) : null,
          weightDate: lastWeight?.date ?? null,
          method: lastWeight?.method ?? null,
          bodyCondition: lastCondition ? Number(lastCondition.bodyCondition) : null,
          conditionDate: lastCondition?.date ?? null,
        };
      });
    });
  }),
});
