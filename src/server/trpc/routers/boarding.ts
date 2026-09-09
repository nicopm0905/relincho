import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";

const managerProcedure = roleProcedure("OWNER", "MANAGER");

export const boardingRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) =>
      tx.boardingContract.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          horse: { select: { id: true, name: true, photoUrl: true, boxLocation: true } },
          client: { select: { id: true, name: true, phone: true } },
          extras: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { startDate: "desc" },
      })
    );
  }),

  create: managerProcedure
    .input(
      z.object({
        horseId: z.string(),
        clientId: z.string(),
        startDate: z.date(),
        monthlyFee: z.number(),
        includes: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.boardingContract.create({
          data: {
            tenantId: ctx.tenantId,
            horseId: input.horseId,
            clientId: input.clientId,
            startDate: input.startDate,
            monthlyFee: input.monthlyFee,
            includes: input.includes,
          },
        })
      );
    }),

  deactivate: managerProcedure
    .input(z.object({ id: z.string(), endDate: z.date() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.boardingContract.update({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { active: false, endDate: input.endDate },
        })
      );
    }),

  // ---------------------------------------------------------------------------
  // Extras del contrato de pupilaje (recurrentes o puntuales)
  // ---------------------------------------------------------------------------
  listExtras: managerProcedure
    .input(z.object({ boardingContractId: z.string() }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.boardingContractExtra.findMany({
          where: {
            tenantId: ctx.tenantId,
            boardingContractId: input.boardingContractId,
          },
          orderBy: { createdAt: "desc" },
        })
      );
    }),

  addExtra: managerProcedure
    .input(
      z.object({
        boardingContractId: z.string(),
        concept: z.string().min(1),
        amount: z.number(),
        vatRate: z.number().min(0).optional(),
        recurring: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const contract = await tx.boardingContract.findFirst({
          where: { id: input.boardingContractId, tenantId: ctx.tenantId },
          select: { id: true },
        });
        if (!contract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contrato no encontrado" });
        }
        return tx.boardingContractExtra.create({
          data: {
            tenantId: ctx.tenantId,
            boardingContractId: input.boardingContractId,
            concept: input.concept,
            amount: input.amount.toFixed(2),
            vatRate: (input.vatRate ?? 21).toFixed(2),
            recurring: input.recurring ?? true,
          },
        });
      });
    }),

  removeExtra: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.boardingContractExtra.deleteMany({
          where: { id: input.id, tenantId: ctx.tenantId },
        })
      );
    }),

  toggleExtraRecurring: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const extra = await tx.boardingContractExtra.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
        });
        if (!extra) throw new TRPCError({ code: "NOT_FOUND" });
        return tx.boardingContractExtra.update({
          where: { id: extra.id },
          data: { recurring: !extra.recurring },
        });
      });
    }),
});
