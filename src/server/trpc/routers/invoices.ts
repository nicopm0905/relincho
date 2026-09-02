import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";
import { InvoiceStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const invoicesRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z
        .object({ status: z.nativeEnum(InvoiceStatus).optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.invoice.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(input?.status ? { status: input.status } : {}),
          },
          include: { client: { select: { id: true, name: true } }, lines: true },
          orderBy: { issueDate: "desc" },
        }),
      );
    }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const inv = await withTenant(ctx.tenantId, (tx) =>
        tx.invoice.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          include: {
            client: true,
            lines: { include: { horse: { select: { id: true, name: true } } } },
            payments: true,
          },
        }),
      );
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      return inv;
    }),

  nextNumber: tenantProcedure
    .input(z.object({ series: z.string() }))
    .query(async ({ ctx, input }) => {
      const last = await withTenant(ctx.tenantId, (tx) =>
        tx.invoice.findFirst({
          where: { tenantId: ctx.tenantId, series: input.series },
          orderBy: { number: "desc" },
          select: { number: true },
        }),
      );
      return (last?.number ?? 0) + 1;
    }),

  updateStatus: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.nativeEnum(InvoiceStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) =>
        tx.invoice.update({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { status: input.status },
        }),
      );
    }),

  generateMonthly: tenantProcedure
    .mutation(async ({ ctx }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        // Buscar contratos activos
        const contracts = await tx.boardingContract.findMany({
          where: { tenantId: ctx.tenantId, active: true },
          include: { horse: true }
        });

        if (contracts.length === 0) return { generated: 0 };

        // Buscar último número de serie (asumiremos año actual ej "2026")
        const currentYear = new Date().getFullYear().toString();
        const lastInvoice = await tx.invoice.findFirst({
          where: { tenantId: ctx.tenantId, series: currentYear },
          orderBy: { number: "desc" },
        });
        
        let nextNumber = (lastInvoice?.number ?? 0) + 1;
        let generatedCount = 0;

        for (const contract of contracts) {
          const subtotal = Number(contract.monthlyFee);
          const vatRate = Number(contract.vatRate);
          const vatTotal = subtotal * (vatRate / 100);
          const total = subtotal + vatTotal;

          const invoice = await tx.invoice.create({
            data: {
              tenantId: ctx.tenantId,
              clientId: contract.clientId,
              series: currentYear,
              number: nextNumber++,
              issueDate: new Date(),
              status: "ISSUED",
              subtotal: subtotal.toFixed(2),
              vatTotal: vatTotal.toFixed(2),
              total: total.toFixed(2),
            }
          });

          await tx.invoiceLine.create({
            data: {
              invoiceId: invoice.id,
              description: `Pupilaje Mensual - ${contract.horse.name}`,
              quantity: "1",
              unitPrice: subtotal.toFixed(2),
              vatRate: vatRate.toFixed(2),
              horseId: contract.horseId
            }
          });
          generatedCount++;
        }
        
        return { generated: generatedCount };
      });
    }),
});
