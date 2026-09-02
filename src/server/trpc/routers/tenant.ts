import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { prisma, withTenant } from "@/server/db/prisma";

export const tenantRouter = createTRPCRouter({
  update: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        nif: z.string().optional(),
        province: z.string().optional(),
        regaCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find tenant from database
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId }
      });
      if (!tenant) throw new Error("Tenant not found");

      return prisma.tenant.update({
        where: { id: ctx.tenantId },
        data: {
          name: input.name,
          nif: input.nif,
          province: input.province,
          regaCode: input.regaCode,
        },
      });
    }),
});
