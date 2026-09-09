import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { prisma, withTenant } from "@/server/db/prisma";
import { HorseStatus, Sex } from "@prisma/client";
import { TRPCError } from "@trpc/server";

const horseInput = z.object({
  name: z.string().min(1),
  sex: z.nativeEnum(Sex),
  status: z.nativeEnum(HorseStatus).default("ACTIVE"),
  breed: z.string().optional(),
  coat: z.string().optional(),
  birthDate: z.date().optional(),
  uelnCode: z.string().optional(),
  microchip: z.string().optional(),
  hierro: z.string().optional(),
  boxLocation: z.string().optional(),
  photoUrl: z.string().optional(),
  sireId: z.string().uuid().optional(),
  damId: z.string().uuid().optional(),
  currentOwnerId: z.string().uuid().optional(),
});

export const horsesRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z
        .object({
          status: z.nativeEnum(HorseStatus).optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.horse.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.status ? { status: input.status } : {}),
            ...(input?.search
              ? { name: { contains: input.search, mode: "insensitive" } }
              : {}),
          },
          include: { owner: { select: { id: true, name: true } } },
          orderBy: { name: "asc" },
        }),
      );
    }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const horse = await withTenant(ctx.tenantId, (tx) =>
        tx.horse.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          include: {
            owner: true,
            feedingPlan: true,
            sire: { select: { id: true, name: true, sire: { select: { id: true, name: true } }, dam: { select: { id: true, name: true } } } },
            dam: { select: { id: true, name: true, sire: { select: { id: true, name: true } }, dam: { select: { id: true, name: true } } } },
            healthEvents: { orderBy: { date: "desc" }, take: 10 },
            documents: { orderBy: { createdAt: "desc" } },
            reproCycles: {
              orderBy: { season: "desc" },
              include: {
                coverings: {
                  orderBy: { date: "desc" },
                  include: {
                    stallion: true,
                    pregnancyChecks: { orderBy: { date: "desc" }, take: 1 },
                    foaling: true,
                  }
                }
              }
            },
          },
        }),
      );
      if (!horse) throw new TRPCError({ code: "NOT_FOUND" });
      return horse;
    }),

  create: tenantProcedure.input(horseInput).mutation(async ({ ctx, input }) => {
    return withTenant(ctx.tenantId, (tx) =>
      tx.horse.create({
        data: { ...input, tenantId: ctx.tenantId },
      }),
    );
  }),

  bulkImport: tenantProcedure
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              name: z.string().min(1),
              sex: z.nativeEnum(Sex),
              status: z.nativeEnum(HorseStatus).default("ACTIVE"),
              breed: z.string().optional(),
              coat: z.string().optional(),
              birthDate: z.coerce.date().optional(),
              uelnCode: z.string().optional(),
              microchip: z.string().optional(),
              hierro: z.string().optional(),
              boxLocation: z.string().optional(),
            }),
          )
          .min(1)
          .max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        // No volvemos a crear un caballo cuyo microchip o UELN ya esta dado
        // de alta: asi el usuario puede reimportar el Excel sin duplicar.
        const microchips = input.rows
          .map((r) => r.microchip)
          .filter((v): v is string => !!v);
        const uelnCodes = input.rows
          .map((r) => r.uelnCode)
          .filter((v): v is string => !!v);

        const existing =
          microchips.length || uelnCodes.length
            ? await tx.horse.findMany({
                where: {
                  tenantId: ctx.tenantId,
                  OR: [
                    ...(microchips.length
                      ? [{ microchip: { in: microchips } }]
                      : []),
                    ...(uelnCodes.length
                      ? [{ uelnCode: { in: uelnCodes } }]
                      : []),
                  ],
                },
                select: { microchip: true, uelnCode: true },
              })
            : [];

        const takenChips = new Set(
          existing.map((h) => h.microchip).filter(Boolean),
        );
        const takenUeln = new Set(
          existing.map((h) => h.uelnCode).filter(Boolean),
        );

        const toCreate = input.rows.filter((row) => {
          if (row.microchip && takenChips.has(row.microchip)) return false;
          if (row.uelnCode && takenUeln.has(row.uelnCode)) return false;
          return true;
        });

        if (toCreate.length === 0) {
          return { created: 0, skipped: input.rows.length };
        }

        const result = await tx.horse.createMany({
          data: toCreate.map((row) => ({ ...row, tenantId: ctx.tenantId })),
        });

        return {
          created: result.count,
          skipped: input.rows.length - toCreate.length,
        };
      });
    }),

  update: tenantProcedure
    .input(z.object({ id: z.string().uuid() }).merge(horseInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, (tx) =>
        tx.horse.update({
          where: { id, tenantId: ctx.tenantId },
          data,
        }),
      );
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await withTenant(ctx.tenantId, (tx) =>
        tx.horse.delete({ where: { id: input.id, tenantId: ctx.tenantId } }),
      );
    }),

  timeline: tenantProcedure
    .input(z.object({ horseId: z.string().uuid(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const [health, trainings, movements, coverings, foalings] = await Promise.all([
          tx.healthEvent.findMany({
            where: { horseId: input.horseId, tenantId: ctx.tenantId },
            orderBy: { date: "desc" },
            take: input.limit,
          }),
          tx.trainingSession.findMany({
            where: { horseId: input.horseId, tenantId: ctx.tenantId },
            orderBy: { date: "desc" },
            take: input.limit,
          }),
          tx.movement.findMany({
            where: { horseId: input.horseId, tenantId: ctx.tenantId },
            orderBy: { date: "desc" },
            take: input.limit,
          }),
          tx.covering.findMany({
            where: { mareId: input.horseId, tenantId: ctx.tenantId },
            orderBy: { date: "desc" },
            take: input.limit,
            include: { stallion: { select: { name: true } } }
          }),
          tx.foaling.findMany({
            where: { covering: { mareId: input.horseId, tenantId: ctx.tenantId } },
            orderBy: { date: "desc" },
            take: input.limit,
          })
        ]);

        const events = [
          ...health.map(e => ({ ...e, _model: "HealthEvent" as const })),
          ...trainings.map(e => ({ ...e, _model: "TrainingSession" as const })),
          ...movements.map(e => ({ ...e, _model: "Movement" as const })),
          ...coverings.map(e => ({ ...e, _model: "Covering" as const })),
          ...foalings.map(e => ({ ...e, _model: "Foaling" as const })),
        ];

        return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, input.limit);
      });
    }),
});
