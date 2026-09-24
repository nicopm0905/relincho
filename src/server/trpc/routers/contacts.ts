import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, roleProcedure, staffProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";
import { isValidNif, normalizeNif } from "@/lib/nif";

/** Dar de alta o cambiar contactos es cosa de propietario y encargado. */
const managerProcedure = roleProcedure("OWNER", "MANAGER");

export const CONTACT_KINDS = ["VET", "FARRIER", "CLIENT", "OWNER", "SUPPLIER", "OTHER"] as const;

/** Texto opcional: vacio cuenta como "sin dato", no como cadena vacia. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const contactInput = z.object({
  kind: z.enum(CONTACT_KINDS),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  nif: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeNif(value) : null))
    .refine((value) => value === null || isValidNif(value), {
      message: "El NIF no es válido: revisa la letra o el dígito de control",
    }),
  // Un email vacio no es un email invalido: es "sin email".
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toLowerCase() : null))
    .refine((value) => value === null || z.string().email().safeParse(value).success, {
      message: "El email no es válido",
    }),
  phone: optionalText(40),
  address: optionalText(300),
});

export const contactsRouter = createTRPCRouter({
  list: staffProcedure
    .input(
      z
        .object({
          kind: z.string().optional(),
          /** Varios tipos a la vez: a quien se factura es cliente o propietario. */
          kinds: z.array(z.string()).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.contact.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.kind ? { kind: input.kind } : {}),
            ...(input?.kinds ? { kind: { in: input.kinds } } : {}),
          },
          include: {
            _count: { select: { invoices: true, horses: true, boardingContracts: true } },
          },
          orderBy: { name: "asc" },
        })
      );
    }),

  create: managerProcedure.input(contactInput).mutation(async ({ ctx, input }) => {
    return withTenant(ctx.tenantId, (tx) =>
      tx.contact.create({ data: { ...input, tenantId: ctx.tenantId } }),
    );
  }),

  update: managerProcedure
    .input(contactInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.contact.count({ where: { id, tenantId: ctx.tenantId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        return tx.contact.update({ where: { id }, data });
      });
    }),

  /**
   * Solo se borra un contacto sin historial. Una factura tiene que conservar a
   * su destinatario, y un caballo o un contrato de pupilaje perderian a su
   * propietario o cliente sin avisar.
   */
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const contact = await tx.contact.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          include: {
            _count: { select: { invoices: true, horses: true, boardingContracts: true } },
          },
        });
        if (!contact) throw new TRPCError({ code: "NOT_FOUND" });

        const { invoices, horses, boardingContracts } = contact._count;
        if (invoices || horses || boardingContracts) {
          const reasons = [
            invoices && `${invoices} factura${invoices === 1 ? "" : "s"}`,
            horses && `${horses} caballo${horses === 1 ? "" : "s"}`,
            boardingContracts &&
              `${boardingContracts} contrato${boardingContracts === 1 ? "" : "s"} de pupilaje`,
          ].filter(Boolean);
          throw new TRPCError({
            code: "CONFLICT",
            message: `No se puede eliminar: tiene ${reasons.join(", ")}.`,
          });
        }

        await tx.contact.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),
});
