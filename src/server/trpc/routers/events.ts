import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, roleProcedure } from "../init";
import { withTenant, type PrismaClient } from "@/server/db/prisma";

/** Eventos del calendario los apunta el personal de la yeguada. */
const staffWrite = roleProcedure("OWNER", "MANAGER", "GROOM");

export const EVENT_KINDS = ["VET_VISIT", "FARRIER", "COMPETITION", "VISIT", "OTHER"] as const;

const eventInput = z
  .object({
    kind: z.enum(EVENT_KINDS),
    title: z.string().trim().min(1).max(200),
    startsAt: z.date(),
    endsAt: z.date().nullish(),
    location: z.string().trim().max(200).nullish(),
    notes: z.string().trim().max(2000).nullish(),
    horseId: z.string().uuid().nullish(),
  });

async function assertHorse(tx: PrismaClient, tenantId: string, horseId?: string | null) {
  if (!horseId) return;
  const horse = await tx.horse.count({ where: { id: horseId, tenantId } });
  if (!horse) throw new TRPCError({ code: "NOT_FOUND", message: "Caballo no encontrado" });
}

function assertRange(startsAt?: Date, endsAt?: Date | null) {
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "El final no puede ser anterior al inicio" });
  }
}

/** Visitas, herrador, concursos... lo que no sale de otro modulo. */
export const eventsRouter = createTRPCRouter({
  create: staffWrite.input(eventInput).mutation(async ({ ctx, input }) => {
    assertRange(input.startsAt, input.endsAt);
    return withTenant(ctx.tenantId, async (tx) => {
      await assertHorse(tx, ctx.tenantId, input.horseId);
      return tx.event.create({ data: { ...input, tenantId: ctx.tenantId } });
    });
  }),

  update: staffWrite
    .input(eventInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.event.findFirst({ where: { id, tenantId: ctx.tenantId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        assertRange(data.startsAt ?? existing.startsAt, data.endsAt === undefined ? existing.endsAt : data.endsAt);
        await assertHorse(tx, ctx.tenantId, data.horseId);
        return tx.event.update({ where: { id }, data });
      });
    }),

  delete: staffWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.event.count({ where: { id: input.id, tenantId: ctx.tenantId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await tx.event.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),
});
