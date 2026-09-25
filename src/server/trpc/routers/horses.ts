import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { allowedHorseIds, assertHorseAccess } from "../access";
import { inSequence, withTenant, type PrismaClient } from "@/server/db/prisma";
import { isValidMicrochip, isValidUeln, normalizeCode } from "@/lib/identifiers";
import { HorseStatus, Sex } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/** Identificador opcional: se guarda normalizado y con su formato oficial. */
const identifier = (valid: (value: string) => boolean, message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeCode(value) : undefined))
    .refine((value) => value === undefined || valid(value), { message });

const horseInput = z.object({
  name: z.string().trim().min(1),
  sex: z.nativeEnum(Sex),
  status: z.nativeEnum(HorseStatus).default("ACTIVE"),
  breed: z.string().optional(),
  coat: z.string().optional(),
  birthDate: z.date().optional(),
  uelnCode: identifier(isValidUeln, "El UELN tiene 15 caracteres (ej. 724015240123456)"),
  microchip: identifier(isValidMicrochip, "El microchip tiene 15 dígitos"),
  hierro: z.string().optional(),
  boxLocation: z.string().optional(),
  photoUrl: z.string().optional(),
  // `null` quita el padre, la madre o el propietario.
  sireId: z.string().uuid().nullish(),
  damId: z.string().uuid().nullish(),
  currentOwnerId: z.string().uuid().nullish(),
  /** Inscripcion en el LG PRE: formato libre, lo asigna ANCCE. */
  lgNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
  breederId: z.string().uuid().nullish(),
});

/**
 * Las FK solo exigen que existan: sin esto se podia poner de padre a una
 * yegua, a un caballo de otra yeguada o al propio caballo.
 */
async function assertHorseRefs(
  tx: PrismaClient,
  tenantId: string,
  horseId: string | undefined,
  data: {
    sireId?: string | null;
    damId?: string | null;
    currentOwnerId?: string | null;
    breederId?: string | null;
    microchip?: string;
  },
) {
  if (horseId && (data.sireId === horseId || data.damId === horseId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Un caballo no puede ser su propio padre o madre" });
  }
  if (data.sireId) {
    const sire = await tx.horse.count({ where: { id: data.sireId, tenantId, sex: "MALE" } });
    if (!sire) throw new TRPCError({ code: "BAD_REQUEST", message: "El padre tiene que ser un macho de la yeguada" });
  }
  if (data.damId) {
    const dam = await tx.horse.count({ where: { id: data.damId, tenantId, sex: "FEMALE" } });
    if (!dam) throw new TRPCError({ code: "BAD_REQUEST", message: "La madre tiene que ser una yegua de la yeguada" });
  }
  if (data.currentOwnerId) {
    const owner = await tx.contact.count({ where: { id: data.currentOwnerId, tenantId } });
    if (!owner) throw new TRPCError({ code: "BAD_REQUEST", message: "Propietario no encontrado" });
  }
  if (data.breederId) {
    const breeder = await tx.contact.count({ where: { id: data.breederId, tenantId } });
    if (!breeder) throw new TRPCError({ code: "BAD_REQUEST", message: "Criador no encontrado" });
  }
  if (data.microchip) {
    const clash = await tx.horse.findFirst({
      where: { tenantId, microchip: data.microchip, ...(horseId ? { id: { not: horseId } } : {}) },
      select: { name: true },
    });
    if (clash) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Ese microchip ya está asignado a ${clash.name}`,
      });
    }
  }
}

const managerProcedure = roleProcedure("OWNER", "MANAGER");

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
      const ids = await allowedHorseIds(ctx);
      return withTenant(ctx.tenantId, (tx) =>
        tx.horse.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(ids ? { id: { in: ids } } : {}),
            ...(input?.status ? { status: input.status } : {}),
            ...(input?.search
              ? { name: { contains: input.search, mode: "insensitive" } }
              : {}),
          },
          // La lista alimenta tarjetas y selectores; no necesita el objeto
          // completo del propietario ni el resto de relaciones del caballo.
          select: {
            id: true,
            name: true,
            sex: true,
            status: true,
            breed: true,
            coat: true,
            birthDate: true,
            photoUrl: true,
            uelnCode: true,
            boxLocation: true,
          },
          orderBy: { name: "asc" },
        }),
      );
    }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ids = await allowedHorseIds(ctx);
      if (ids && !ids.includes(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const horse = await withTenant(ctx.tenantId, (tx) =>
        tx.horse.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          include: {
            owner: true,
            breeder: { select: { id: true, name: true } },
            feedingPlan: true,
            vetProfile: { select: { baseWeightKg: true } },
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

  create: managerProcedure.input(horseInput).mutation(async ({ ctx, input }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      await assertHorseRefs(tx, ctx.tenantId, undefined, input);
      return tx.horse.create({
        data: { ...input, tenantId: ctx.tenantId },
      });
    });
  }),

  bulkImport: managerProcedure
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

  update: managerProcedure
    .input(z.object({ id: z.string().uuid() }).merge(horseInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        await assertHorseRefs(tx, ctx.tenantId, id, data);
        return tx.horse.update({
          where: { id, tenantId: ctx.tenantId },
          data,
        });
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Borrar arrastraria en cascada sanidad y movimientos (el libro oficial
      // de explotacion), y con cubriciones, pupilaje o facturas fallaria por
      // clave ajena. Solo se borra un alta hecha por error; lo demas se da de
      // baja con un movimiento de venta o muerte.
      await withTenant(ctx.tenantId, async (tx) => {
        const horse = await tx.horse.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          select: {
            _count: {
              select: {
                healthEvents: true,
                movements: true,
                coverings: true,
                sirings: true,
                reproCycles: true,
                invoiceLines: true,
                sireOf: true,
                damOf: true,
                trainings: true,
                documents: true,
              },
            },
            boardingContract: { select: { id: true } },
          },
        });
        if (!horse) throw new TRPCError({ code: "NOT_FOUND" });
        const c = horse._count;
        const history =
          c.healthEvents + c.movements + c.coverings + c.sirings + c.reproCycles +
          c.invoiceLines + c.sireOf + c.damOf + c.trainings + c.documents;
        if (history > 0 || horse.boardingContract) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Este caballo tiene historial y no se puede borrar. Si ha salido de la cuadra, regístralo en Movimientos como venta o muerte.",
          });
        }
        await tx.horse.delete({ where: { id: input.id } });
      });
    }),

  timeline: tenantProcedure
    .input(z.object({ horseId: z.string().uuid(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      await assertHorseAccess(ctx, input.horseId);
      return withTenant(ctx.tenantId, async (tx) => {
        const [health, trainings, movements, coverings, foalings] = await inSequence([
          () => tx.healthEvent.findMany({
            where: { horseId: input.horseId, tenantId: ctx.tenantId },
            orderBy: { date: "desc" },
            take: input.limit,
          }),
          () => tx.trainingSession.findMany({
            where: { horseId: input.horseId, tenantId: ctx.tenantId },
            orderBy: { date: "desc" },
            take: input.limit,
          }),
          () => tx.movement.findMany({
            where: { horseId: input.horseId, tenantId: ctx.tenantId },
            orderBy: { date: "desc" },
            take: input.limit,
          }),
          () => tx.covering.findMany({
            where: { mareId: input.horseId, tenantId: ctx.tenantId },
            orderBy: { date: "desc" },
            take: input.limit,
            include: { stallion: { select: { name: true } } }
          }),
          () => tx.foaling.findMany({
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
