import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, staffProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";
import { batchActivities } from "@/lib/horse-feed";

export const ACTIVITY_KINDS = ["PADDOCK", "RIDDEN", "LUNGED", "WALKER", "GROOMED", "FARRIER", "VET", "PHYSIO", "NOTE"] as const;

/**
 * Registro de actividad del caballo (E6): el personal marca en lote lo que
 * se ha hecho ("8 caballos al paddock"). Todo o nada: si un caballo no es
 * del centro, NOT_FOUND y no se guarda ninguno. Reintentar con el mismo
 * `clientMutationId` no duplica (se guarda `<id>:<horseId>` por caballo).
 */
export const activityRouter = createTRPCRouter({
  logBatch: staffProcedure
    .input(
      z.object({
        horseIds: z.array(z.string().min(1)).min(1).max(100),
        kind: z.enum(ACTIVITY_KINDS),
        durationMin: z.number().int().min(1).max(600).optional(),
        note: z.string().trim().max(1000).optional(),
        visibleToOwner: z.boolean().default(true),
        clientMutationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wanted = [...new Set(input.horseIds)];
      return withTenant(ctx.tenantId, async (tx) => {
        const found = await tx.horse.count({ where: { tenantId: ctx.tenantId, id: { in: wanted } } });
        if (found !== wanted.length) throw new TRPCError({ code: "NOT_FOUND" });

        const rows = batchActivities({
          horseIds: wanted,
          kind: input.kind,
          at: new Date(),
          authorMembershipId: ctx.membershipId,
          durationMin: input.durationMin ?? null,
        });
        const { count } = await tx.horseActivity.createMany({
          data: rows.map((r) => ({
            ...r,
            tenantId: ctx.tenantId,
            note: input.note || null,
            visibleToOwner: input.visibleToOwner,
            clientMutationId: input.clientMutationId ? `${input.clientMutationId}:${r.horseId}` : null,
          })),
          skipDuplicates: true,
        });
        return { created: count };
      });
    }),
});
