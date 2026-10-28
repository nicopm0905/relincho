import { createTRPCRouter, professionalProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";

/**
 * Puerta del profesional externo: veterinario, herrador, dentista… (E1a).
 *
 * `tenantProcedure` le cierra el panel del centro, así que todo lo que ve pasa
 * por aquí, y solo sobre los caballos de su `HorseAccess`.
 */
export const professionalRouter = createTRPCRouter({
  /** Los caballos que el centro le ha asignado, y ninguno más. */
  myHorses: professionalProcedure.query(({ ctx }) =>
    withTenant(ctx.tenantId, (tx) =>
      tx.horse.findMany({
        where: {
          tenantId: ctx.tenantId,
          horseAccess: { some: { membershipId: ctx.membershipId } },
        },
        select: { id: true, name: true, breed: true, boxLocation: true },
        orderBy: { name: "asc" },
      }),
    ),
  ),
});
