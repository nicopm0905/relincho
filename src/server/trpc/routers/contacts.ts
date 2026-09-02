import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";

export const contactsRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ kind: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.contact.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.kind ? { kind: input.kind } : {}),
          },
          orderBy: { name: "asc" },
        })
      );
    }),
});
