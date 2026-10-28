import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { HealthEventType } from "@prisma/client";
import { createTRPCRouter, professionalProcedure } from "../init";
import { prisma, withTenant } from "@/server/db/prisma";
import { healthTypesFor } from "@/lib/permissions";
import { planVisit } from "@/lib/professional-visit";

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

  /** Los actos que puede registrar según su especialidad (para el formulario). */
  allowedTypes: professionalProcedure.query(async ({ ctx }) => {
    const m = await prisma.membership.findUniqueOrThrow({
      where: { id: ctx.membershipId },
      select: { specialty: true },
    });
    return healthTypesFor({ role: ctx.role, specialty: m.specialty });
  }),

  /**
   * Visita a uno o varios caballos (E7): un acto sanitario por caballo con su
   * autoría. Todo o nada: si falta acceso a un caballo, no se guarda ninguno.
   * Con `clientMutationId`, reintentar desde el móvil no duplica.
   */
  recordVisit: professionalProcedure
    .input(
      z.object({
        horseIds: z.array(z.string().uuid()).min(1).max(50),
        type: z.nativeEnum(HealthEventType),
        name: z.string().trim().min(1).max(120),
        date: z.date(),
        nextDueDate: z.date().nullish(),
        notes: z.string().max(1000).nullish(),
        clientMutationId: z.string().min(8).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const m = await prisma.membership.findUniqueOrThrow({
        where: { id: ctx.membershipId },
        select: { specialty: true },
      });
      if (!healthTypesFor({ role: ctx.role, specialty: m.specialty }).includes(input.type)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const wanted = [...new Set(input.horseIds)];
      return withTenant(ctx.tenantId, async (tx) => {
        const horses = await tx.horse.findMany({
          where: {
            id: { in: wanted },
            tenantId: ctx.tenantId,
            horseAccess: { some: { membershipId: ctx.membershipId } },
          },
          select: { id: true, farrierIntervalWeeks: true },
        });
        // NOT_FOUND y no FORBIDDEN: a un externo no le decimos que existe.
        if (horses.length !== wanted.length) throw new TRPCError({ code: "NOT_FOUND" });

        const events = planVisit({
          horses,
          type: input.type,
          name: input.name,
          date: input.date,
          nextDueDate: input.nextDueDate,
          notes: input.notes,
          authorMembershipId: ctx.membershipId,
        });
        const { count } = await tx.healthEvent.createMany({
          data: events.map((e) => ({
            ...e,
            tenantId: ctx.tenantId,
            clientMutationId: input.clientMutationId
              ? `${input.clientMutationId}:${e.horseId}`
              : null,
          })),
          skipDuplicates: true,
        });
        return { created: count };
      });
    }),
});
