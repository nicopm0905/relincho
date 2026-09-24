import { z } from "zod";
import { createTRPCRouter, roleProcedure } from "../init";
import { prisma } from "@/server/db/prisma";
import { isValidNif, normalizeNif } from "@/lib/nif";
import { isValidRega, normalizeCode } from "@/lib/identifiers";

const managerProcedure = roleProcedure("OWNER", "MANAGER");

/** Texto opcional: vacio borra el dato. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

export const tenantRouter = createTRPCRouter({
  /**
   * Datos de la yeguada. Los fiscales (NIF, razon social, direccion) son los
   * que salen como emisor en cada factura: sin ellos no se puede emitir.
   */
  update: managerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).optional(),
        fiscalName: text(200),
        nif: z
          .string()
          .trim()
          .optional()
          .transform((value) => (value === undefined ? undefined : value ? normalizeNif(value) : null))
          .refine((value) => !value || isValidNif(value), {
            message: "El NIF no es válido: revisa la letra o el dígito de control",
          }),
        address: text(300),
        postalCode: z
          .string()
          .trim()
          .optional()
          .transform((value) => (value === undefined ? undefined : value || null))
          .refine((value) => !value || /^\d{5}$/.test(value), { message: "El código postal tiene 5 dígitos" }),
        city: text(120),
        province: text(120),
        regaCode: z
          .string()
          .trim()
          .optional()
          .transform((value) => (value === undefined ? undefined : value ? normalizeCode(value) : null))
          .refine((value) => !value || isValidRega(value), {
            message: "El código REGA es ES seguido de 12 dígitos",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return prisma.tenant.update({
        where: { id: ctx.tenantId },
        data: input,
      });
    }),
});
