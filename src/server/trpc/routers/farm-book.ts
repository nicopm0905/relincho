import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, roleProcedure, staffProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";
import { loadFarmBook } from "@/server/services/farm-book";

/**
 * Libro de registro de la explotación (RD 804/2011; en Andalucía, Orden de
 * 29/04/2015). Es un documento de la explotación, no de un caballo: lo ve el
 * personal (no los externos) y lo escribe el propietario o el encargado.
 */
const managerProcedure = roleProcedure("OWNER", "MANAGER");

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const settingsInput = z.object({
  farmName: text(120),
  farmAddress: text(200),
  farmMunicipality: text(80),
  farmProvince: text(60),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  holderPhone: text(30),
  holderEmail: text(120),
  legalRepName: text(120),
  legalRepNif: text(20),
  adsg: text(120),
  classification: text(80),
  capacity: z.number().int().min(0).max(100000).nullable().optional(),
  surfaceHa: z.number().min(0).max(1000000).nullable().optional(),
  installationsM2: z.number().min(0).max(10000000).nullable().optional(),
  sanitaryQualification: text(80),
});

export const farmBookRouter = createTRPCRouter({
  /** Libro completo con censo y avisos. */
  get: staffProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) => loadFarmBook(tx, ctx.tenantId), { timeout: 30_000 });
  }),

  saveSettings: managerProcedure.input(settingsInput).mutation(async ({ ctx, input }) => {
    return withTenant(ctx.tenantId, (tx) =>
      tx.farmBookSettings.upsert({
        where: { tenantId: ctx.tenantId },
        update: input,
        create: { tenantId: ctx.tenantId, ...input },
      }),
    );
  }),

  /**
   * Abre el libro: anota con causa A (apertura) a todos los caballos de la
   * cuadra que aún no tienen ningún movimiento, en la fecha indicada.
   */
  open: managerProcedure
    .input(z.object({ date: z.date() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const horses = await tx.horse.findMany({
          where: {
            tenantId: ctx.tenantId,
            status: { notIn: ["SOLD", "DEAD"] },
            movements: { none: {} },
          },
          select: { id: true },
        });
        if (horses.length > 0) {
          await tx.movement.createMany({
            data: horses.map((h) => ({
              tenantId: ctx.tenantId,
              horseId: h.id,
              direction: "IN",
              date: input.date,
              cause: "APERTURA" as const,
              reason: "Apertura del libro",
            })),
          });
        }
        await tx.farmBookSettings.upsert({
          where: { tenantId: ctx.tenantId },
          update: { openedAt: input.date },
          create: { tenantId: ctx.tenantId, openedAt: input.date },
        });
        return { added: horses.length };
      });
    }),

  // --- Incidencias en la identificación (hoja 3) --------------------------
  addIncident: managerProcedure
    .input(
      z.object({
        horseId: z.string().uuid(),
        date: z.date(),
        previousId: text(40),
        newId: text(40),
        cause: z.enum(["PERDIDA", "DETERIORO", "OTRA_REGION", "OTRA"]),
        duplicate: z.boolean().default(false),
        notes: text(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const horse = await tx.horse.count({ where: { id: input.horseId, tenantId: ctx.tenantId } });
        if (!horse) throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
        return tx.identificationIncident.create({ data: { ...input, tenantId: ctx.tenantId } });
      });
    }),

  deleteIncident: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const res = await tx.identificationIncident.deleteMany({
          where: { id: input.id, tenantId: ctx.tenantId },
        });
        if (res.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
        return input;
      });
    }),

  // --- Inspecciones y controles oficiales (anexo IV f, l) ------------------
  addInspection: managerProcedure
    .input(
      z.object({
        date: z.date(),
        reason: z.string().trim().min(1).max(200),
        actNumber: text(60),
        officialName: text(120),
        notes: text(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.farmInspection.create({ data: { ...input, tenantId: ctx.tenantId } }),
      );
    }),

  deleteInspection: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const res = await tx.farmInspection.deleteMany({ where: { id: input.id, tenantId: ctx.tenantId } });
        if (res.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
        return input;
      });
    }),

  // --- Personas al cuidado de los animales (anexo IV k) -------------------
  saveCaretaker: managerProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        documentId: text(20),
        role: text(60),
        phone: text(30),
        startDate: z.date().nullable().optional(),
        endDate: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        if (id) {
          const res = await tx.farmCaretaker.updateMany({ where: { id, tenantId: ctx.tenantId }, data });
          if (res.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
          return { id };
        }
        return tx.farmCaretaker.create({ data: { ...data, tenantId: ctx.tenantId } });
      });
    }),

  deleteCaretaker: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const res = await tx.farmCaretaker.deleteMany({ where: { id: input.id, tenantId: ctx.tenantId } });
        if (res.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
        return input;
      });
    }),
});
