import { z } from "zod";

import { createTRPCRouter, roleProcedure } from "../init";
import { assertHorseAccess } from "../access";
import { prisma, withTenant } from "@/server/db/prisma";
import { TRPCError } from "@trpc/server";
import { buildFeed } from "@/lib/horse-feed";

const DAY_MS = 86_400_000;

/**
 * Feed de actividad de un caballo (E6): actividades, entrenamientos y actos
 * sanitarios fusionados al leer por `buildFeed`. El propietario solo ve sus
 * caballos (NOT_FOUND al resto) y no ve lo marcado como interno.
 */
export const feedRouter = createTRPCRouter({
  forHorse: roleProcedure("OWNER", "MANAGER", "GROOM", "OWNER_EXTERNAL")
    .input(z.object({ horseId: z.string().min(1), days: z.number().int().min(1).max(60).default(14) }))
    .query(async ({ ctx, input }) => {
      await assertHorseAccess(ctx, input.horseId);
      const since = new Date(Date.now() - input.days * DAY_MS);
      const until = new Date();
      const where = { tenantId: ctx.tenantId, horseId: input.horseId };
      const data = await withTenant(ctx.tenantId, async (tx) => {
        const horse = await tx.horse.findFirst({ where: { id: input.horseId, tenantId: ctx.tenantId }, select: { id: true } });
        if (!horse) throw new TRPCError({ code: "NOT_FOUND" });
        const activities = await tx.horseActivity.findMany({
          where: { ...where, at: { gte: since, lte: until } },
          select: { id: true, horseId: true, kind: true, at: true, durationMin: true, note: true, authorMembershipId: true, visibleToOwner: true },
        });
        const trainings = await tx.trainingSession.findMany({
          where: { ...where, date: { gte: since, lte: until } },
          select: { id: true, horseId: true, date: true, minutes: true, type: true, notes: true },
        });
        const health = await tx.healthEvent.findMany({
          where: { ...where, date: { gte: since, lte: until } },
          select: { id: true, horseId: true, type: true, name: true, date: true, authorMembershipId: true },
        });
        return { activities, trainings, health };
      });
      const items = buildFeed(data, { viewer: ctx.role === "OWNER_EXTERNAL" ? "OWNER" : "STAFF" });
      // «Le vio el herrador»: el nombre del autor, solo de membresías de este centro.
      const authorIds = [...new Set(items.flatMap((i) => (i.authorMembershipId ? [i.authorMembershipId] : [])))];
      const authors = authorIds.length
        ? await prisma.membership.findMany({
            where: { tenantId: ctx.tenantId, id: { in: authorIds } },
            select: { id: true, user: { select: { name: true } } },
          })
        : [];
      const nameOf = new Map(authors.map((a) => [a.id, a.user.name]));
      return {
        items: items.map((i) => ({
          ...i,
          authorName: i.authorMembershipId ? (nameOf.get(i.authorMembershipId) ?? null) : null,
        })),
      };
    }),
});
