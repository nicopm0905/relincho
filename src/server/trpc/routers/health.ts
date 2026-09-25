import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { allowedHorseIds, assertHorseAccess } from "../access";
import { inSequence, withTenant, type PrismaClient } from "@/server/db/prisma";
import { TRPCError } from "@trpc/server";
import { HealthEventType } from "@prisma/client";
import { MEDICINAL_TYPES } from "@/lib/treatments";

/**
 * Registrar y corregir tratamientos. Incluye al veterinario externo: es quien
 * los pone, y asi queda anotado en el momento. Solo sobre sus caballos: lo
 * comprueba `assertHorseAccess` en cada mutacion.
 */
const treatmentProcedure = roleProcedure("OWNER", "MANAGER", "GROOM", "VET_EXTERNAL");
const managerProcedure = roleProcedure("OWNER", "MANAGER");

/** Texto opcional: vacío o solo espacios cuenta como "sin dato" (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : value === undefined ? undefined : null));

const healthEventInput = z.object({
  type: z.nativeEnum(HealthEventType),
  name: z.string().trim().min(1).max(200),
  date: z.date(),
  nextDueDate: z.date().nullish(),
  dose: optionalText(100),
  vetContactId: z.string().uuid().nullish(),
  cost: z.number().positive().nullish(),
  notes: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
  // Libro de tratamientos (RD 666/2023, art. 41). Ver `src/lib/treatments.ts`.
  prescriptionNumber: optionalText(60),
  /** Días; 0 es un valor válido y distinto de "sin anotar". */
  withdrawalDays: z.number().int().min(0).max(3650).nullish(),
  durationDays: z.number().int().min(1).max(365).nullish(),
  supplier: optionalText(200),
  purchaseReference: optionalText(80),
  batchNumber: optionalText(60),
});

/** Campos que ve el historial y que necesita el aviso de libro incompleto. */
const healthEventSelect = {
  id: true,
  type: true,
  name: true,
  date: true,
  nextDueDate: true,
  dose: true,
  notes: true,
  vetContactId: true,
  prescriptionNumber: true,
  withdrawalDays: true,
  durationDays: true,
  supplier: true,
  purchaseReference: true,
  batchNumber: true,
  horse: {
    select: {
      id: true,
      name: true,
      uelnCode: true,
      microchip: true,
      excludedFromFoodChain: true,
    },
  },
} as const;

/** El libro lo consultan el personal y el veterinario, no el propietario externo. */
const bookProcedure = roleProcedure("OWNER", "MANAGER", "GROOM", "VET_EXTERNAL");

/** La FK solo exige que el caballo exista, no que sea de esta yeguada. */
async function assertHorsesInTenant(tx: PrismaClient, tenantId: string, horseIds: string[]) {
  const found = await tx.horse.count({ where: { tenantId, id: { in: horseIds } } });
  if (found !== horseIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
  }
}

export const healthRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        horseId: z.string().uuid().optional(),
        type: z.nativeEnum(HealthEventType).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ids = await allowedHorseIds(ctx);
      if (ids && input.horseId && !ids.includes(input.horseId)) return [];
      const horseWhere = ids
        ? { horseId: input.horseId ?? { in: ids } }
        : input.horseId
          ? { horseId: input.horseId }
          : {};
      return withTenant(ctx.tenantId, (tx) =>
        tx.healthEvent.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...horseWhere,
            ...(input.type ? { type: input.type } : {}),
          },
          select: healthEventSelect,
          orderBy: { date: "desc" },
        }),
      );
    }),

  upcoming: tenantProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const ids = await allowedHorseIds(ctx);
      const until = new Date();
      until.setDate(until.getDate() + input.days);
      return withTenant(ctx.tenantId, (tx) =>
        tx.healthEvent.findMany({
          where: {
            tenantId: ctx.tenantId,
            nextDueDate: { lte: until, gte: new Date() },
            ...(ids ? { horseId: { in: ids } } : {}),
          },
          select: {
            id: true,
            type: true,
            name: true,
            nextDueDate: true,
            horse: { select: { id: true, name: true } },
          },
          orderBy: { nextDueDate: "asc" },
        }),
      );
    }),

  /**
   * Libro de registro de tratamientos para un periodo: medicamentos
   * (vacunas, desparasitaciones y tratamientos) y visitas veterinarias. Es lo
   * que se enseña en una inspección; el PDF sale de aquí.
   */
  treatmentBook: bookProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
        horseId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ids = await allowedHorseIds(ctx);
      if (ids && input.horseId && !ids.includes(input.horseId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const horseWhere = input.horseId
        ? { horseId: input.horseId }
        : ids
          ? { horseId: { in: ids } }
          : {};
      const dateWhere = { gte: input.from, lte: input.to };

      return withTenant(ctx.tenantId, async (tx) => {
        const [tenant, treatments, visits] = await inSequence([
          () => tx.tenant.findUniqueOrThrow({
            where: { id: ctx.tenantId },
            select: {
              name: true,
              fiscalName: true,
              nif: true,
              regaCode: true,
              address: true,
              city: true,
              province: true,
            },
          }),
          () => tx.healthEvent.findMany({
            where: {
              tenantId: ctx.tenantId,
              ...horseWhere,
              type: { in: [...MEDICINAL_TYPES] },
              date: dateWhere,
            },
            select: healthEventSelect,
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          }),
          () => tx.healthEvent.findMany({
            where: {
              tenantId: ctx.tenantId,
              ...horseWhere,
              type: "VET_CHECKUP",
              date: dateWhere,
            },
            select: healthEventSelect,
            orderBy: { date: "asc" },
          }),
        ]);
        // Solo los contactos que aparecen como veterinario en el periodo: el
        // veterinario externo no tiene por qué ver el resto de la agenda.
        const vetIds = [
          ...new Set(
            [...treatments, ...visits]
              .map((row) => row.vetContactId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const vets = vetIds.length
          ? await tx.contact.findMany({
              where: { tenantId: ctx.tenantId, id: { in: vetIds } },
              select: { id: true, name: true, phone: true, email: true },
            })
          : [];
        const vetById = new Map(vets.map((v) => [v.id, v]));
        const withVet = <T extends { vetContactId: string | null }>(row: T) => ({
          ...row,
          vet: row.vetContactId ? (vetById.get(row.vetContactId) ?? null) : null,
        });
        return {
          tenant,
          treatments: treatments.map(withVet),
          visits: visits.map(withVet),
        };
      });
    }),

  create: treatmentProcedure
    .input(healthEventInput.extend({ horseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        await assertHorsesInTenant(tx, ctx.tenantId, [input.horseId]);
        await assertHorseAccess(ctx, input.horseId);
        return tx.healthEvent.create({
          data: {
            ...input,
            tenantId: ctx.tenantId,
            cost: input.cost ? input.cost.toString() : undefined,
          },
        });
      });
    }),

  /**
   * El mismo tratamiento a varios caballos (vacunar o desparasitar la cuadra
   * entera). Todo o nada: si un caballo no es de la yeguada, no se guarda
   * ninguno.
   */
  createMany: treatmentProcedure
    .input(
      healthEventInput.extend({
        horseIds: z.array(z.string().uuid()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { horseIds, ...event } = input;
      const unique = [...new Set(horseIds)];
      return withTenant(ctx.tenantId, async (tx) => {
        await assertHorsesInTenant(tx, ctx.tenantId, unique);
        const visible = await allowedHorseIds(ctx);
        if (visible && unique.some((id) => !visible.includes(id))) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
        }
        const result = await tx.healthEvent.createMany({
          data: unique.map((horseId) => ({
            ...event,
            horseId,
            tenantId: ctx.tenantId,
            cost: event.cost ? event.cost.toString() : undefined,
          })),
        });
        return { count: result.count };
      });
    }),

  /** Corregir un registro mal metido sin tener que borrarlo y rehacerlo. */
  update: treatmentProcedure
    .input(healthEventInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.healthEvent.findFirst({
          where: { id, tenantId: ctx.tenantId },
          select: { horseId: true },
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await assertHorseAccess(ctx, existing.horseId);
        return tx.healthEvent.update({
          where: { id, tenantId: ctx.tenantId },
          data: {
            ...data,
            // `null` borra la proxima fecha (tratamiento sin repeticion).
            nextDueDate: data.nextDueDate === undefined ? undefined : data.nextDueDate,
            cost:
              data.cost === undefined ? undefined : data.cost === null ? null : data.cost.toString(),
          },
        });
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await withTenant(ctx.tenantId, (tx) =>
        tx.healthEvent.delete({
          where: { id: input.id, tenantId: ctx.tenantId },
        }),
      );
    }),
});
