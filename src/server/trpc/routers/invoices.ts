import { z } from "zod";
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";
import { InvoiceStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";

const managerProcedure = roleProcedure("OWNER", "MANAGER");

/** Redondeo a 2 decimales evitando errores de coma flotante. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Etiqueta legible de la serie que se guarda en `Invoice.series` (compatibilidad
 * con el codigo/consultas antiguas). Si el prefijo ya contiene el ano no se
 * duplica (p.ej. serie perezosa por defecto con prefix = "2026").
 */
function seriesLabel(prefix: string, year: number): string {
  return prefix.includes(String(year)) ? prefix : `${prefix}${year}`;
}

const lineInput = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number(),
  vatRate: z.number().min(0),
  horseId: z.string().uuid().optional(),
});

function computeTotals(
  lines: { quantity: number; unitPrice: number; vatRate: number }[],
) {
  let subtotal = 0;
  let vatTotal = 0;
  for (const l of lines) {
    const base = round2(l.quantity * l.unitPrice);
    subtotal += base;
    vatTotal += round2(base * (l.vatRate / 100));
  }
  subtotal = round2(subtotal);
  vatTotal = round2(vatTotal);
  return { subtotal, vatTotal, total: round2(subtotal + vatTotal) };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

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
          include: {
            client: { select: { id: true, name: true } },
            lines: true,
            payments: { select: { amount: true } },
          },
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
            payments: { orderBy: { date: "asc" } },
            invoiceSeries: true,
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

  updateStatus: managerProcedure
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

  // ---------------------------------------------------------------------------
  // Series de facturacion
  // ---------------------------------------------------------------------------
  seriesList: tenantProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) =>
      tx.invoiceSeries.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: [{ isDefault: "desc" }, { year: "desc" }, { code: "asc" }],
      }),
    );
  }),

  seriesUpsert: managerProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        code: z.string().min(1).optional(),
        prefix: z.string().min(1),
        year: z.number().int().min(2000).max(2100),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const code = input.code?.trim() || `${input.prefix}-${input.year}`;
      return withTenant(ctx.tenantId, async (tx) => {
        if (input.isDefault) {
          await tx.invoiceSeries.updateMany({
            where: { tenantId: ctx.tenantId, isDefault: true },
            data: { isDefault: false },
          });
        }
        if (input.id) {
          const existing = await tx.invoiceSeries.findFirst({
            where: { id: input.id, tenantId: ctx.tenantId },
          });
          if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
          return tx.invoiceSeries.update({
            where: { id: input.id },
            data: {
              code,
              prefix: input.prefix,
              year: input.year,
              isDefault: input.isDefault ?? existing.isDefault,
            },
          });
        }
        const count = await tx.invoiceSeries.count({
          where: { tenantId: ctx.tenantId },
        });
        return tx.invoiceSeries.create({
          data: {
            tenantId: ctx.tenantId,
            code,
            prefix: input.prefix,
            year: input.year,
            isDefault: input.isDefault ?? count === 0,
          },
        });
      });
    }),

  seriesSetDefault: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const series = await tx.invoiceSeries.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
        });
        if (!series) throw new TRPCError({ code: "NOT_FOUND" });
        await tx.invoiceSeries.updateMany({
          where: { tenantId: ctx.tenantId, isDefault: true },
          data: { isDefault: false },
        });
        return tx.invoiceSeries.update({
          where: { id: input.id },
          data: { isDefault: true },
        });
      });
    }),

  // ---------------------------------------------------------------------------
  // Editor manual de facturas
  // ---------------------------------------------------------------------------
  create: managerProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        seriesId: z.string().uuid(),
        issueDate: z.date(),
        dueDate: z.date().optional(),
        lines: z.array(lineInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const series = await tx.invoiceSeries.findFirst({
          where: { id: input.seriesId, tenantId: ctx.tenantId },
        });
        if (!series) throw new TRPCError({ code: "NOT_FOUND", message: "Serie no encontrada" });

        const client = await tx.contact.findFirst({
          where: { id: input.clientId, tenantId: ctx.tenantId },
          select: { id: true },
        });
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });

        const totals = computeTotals(input.lines);
        const label = seriesLabel(series.prefix, series.year);
        const number = series.nextNumber;
        const dueDate = input.dueDate ?? addDays(input.issueDate, 30);

        const invoice = await tx.invoice.create({
          data: {
            tenantId: ctx.tenantId,
            clientId: input.clientId,
            seriesId: series.id,
            series: label,
            number,
            issueDate: input.issueDate,
            dueDate,
            status: "DRAFT",
            subtotal: totals.subtotal.toFixed(2),
            vatTotal: totals.vatTotal.toFixed(2),
            total: totals.total.toFixed(2),
            lines: {
              create: input.lines.map((l) => ({
                description: l.description,
                quantity: l.quantity.toFixed(2),
                unitPrice: l.unitPrice.toFixed(2),
                vatRate: l.vatRate.toFixed(2),
                horseId: l.horseId,
              })),
            },
          },
        });

        await tx.invoiceSeries.update({
          where: { id: series.id },
          data: { nextNumber: number + 1 },
        });

        return invoice;
      });
    }),

  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        clientId: z.string().uuid().optional(),
        issueDate: z.date().optional(),
        dueDate: z.date().optional(),
        lines: z.array(lineInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
        });
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
        if (invoice.status !== "DRAFT") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Solo se pueden editar facturas en borrador",
          });
        }

        const totals = computeTotals(input.lines);

        await tx.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });

        return tx.invoice.update({
          where: { id: invoice.id },
          data: {
            clientId: input.clientId ?? invoice.clientId,
            issueDate: input.issueDate ?? invoice.issueDate,
            dueDate:
              input.dueDate ??
              (input.issueDate
                ? addDays(input.issueDate, 30)
                : invoice.dueDate),
            subtotal: totals.subtotal.toFixed(2),
            vatTotal: totals.vatTotal.toFixed(2),
            total: totals.total.toFixed(2),
            lines: {
              create: input.lines.map((l) => ({
                description: l.description,
                quantity: l.quantity.toFixed(2),
                unitPrice: l.unitPrice.toFixed(2),
                vatRate: l.vatRate.toFixed(2),
                horseId: l.horseId,
              })),
            },
          },
          include: { lines: true },
        });
      });
    }),

  addPayment: managerProcedure
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.number().positive(),
        date: z.date(),
        method: z.string().min(1),
        reference: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: input.invoiceId, tenantId: ctx.tenantId },
          include: { payments: { select: { amount: true } } },
        });
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: input.amount.toFixed(2),
            date: input.date,
            method: input.method,
            reference: input.reference,
          },
        });

        const paid =
          invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) +
          input.amount;

        const fullyPaid = round2(paid) >= Number(invoice.total);
        if (fullyPaid && invoice.status !== "PAID") {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: "PAID" },
          });
        }

        return { paid: round2(paid), fullyPaid };
      });
    }),

  // ---------------------------------------------------------------------------
  // Facturacion mensual de pupilaje
  // ---------------------------------------------------------------------------
  generateMonthly: managerProcedure
    .input(
      z
        .object({
          year: z.number().int().min(2000).max(2100).optional(),
          month: z.number().int().min(1).max(12).optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const now = new Date();
        const year = input?.year ?? now.getFullYear();
        const month = input?.month ?? now.getMonth() + 1; // 1-12

        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0); // ultimo dia del mes
        monthEnd.setHours(23, 59, 59, 999);
        const daysInMonth = monthEnd.getDate();

        // Serie por defecto del tenant (creada perezosamente).
        let series = await tx.invoiceSeries.findFirst({
          where: { tenantId: ctx.tenantId, isDefault: true },
        });
        if (!series) {
          const currentYear = now.getFullYear();
          const label = seriesLabel(String(currentYear), currentYear);
          const lastInv = await tx.invoice.findFirst({
            where: { tenantId: ctx.tenantId, series: label },
            orderBy: { number: "desc" },
            select: { number: true },
          });
          series = await tx.invoiceSeries.create({
            data: {
              tenantId: ctx.tenantId,
              code: String(currentYear),
              prefix: String(currentYear),
              year: currentYear,
              isDefault: true,
              nextNumber: (lastInv?.number ?? 0) + 1,
            },
          });
        }

        const contracts = await tx.boardingContract.findMany({
          where: { tenantId: ctx.tenantId, active: true },
          include: { horse: true, extras: true },
        });
        if (contracts.length === 0) return { generated: 0 };

        const label = seriesLabel(series.prefix, series.year);
        let nextNumber = series.nextNumber;
        let generated = 0;

        for (const contract of contracts) {
          // Evita duplicar la factura del mismo contrato y mes.
          const already = await tx.invoice.findFirst({
            where: {
              tenantId: ctx.tenantId,
              boardingContractId: contract.id,
              issueDate: { gte: monthStart, lte: monthEnd },
            },
            select: { id: true },
          });
          if (already) continue;

          // Prorrateo por dias activos dentro del mes facturado.
          const cStart = new Date(contract.startDate);
          const cEnd = contract.endDate ? new Date(contract.endDate) : null;
          const activeStart = cStart > monthStart ? cStart : monthStart;
          const activeEnd = cEnd && cEnd < monthEnd ? cEnd : monthEnd;
          if (activeEnd < activeStart) continue; // contrato fuera del mes

          const activeDays =
            Math.floor(
              (Date.UTC(
                activeEnd.getFullYear(),
                activeEnd.getMonth(),
                activeEnd.getDate(),
              ) -
                Date.UTC(
                  activeStart.getFullYear(),
                  activeStart.getMonth(),
                  activeStart.getDate(),
                )) /
                86_400_000,
            ) + 1;

          const prorated = activeDays < daysInMonth;
          const monthlyFee = Number(contract.monthlyFee);
          const baseAmount = prorated
            ? round2((monthlyFee * activeDays) / daysInMonth)
            : monthlyFee;
          const baseVat = Number(contract.vatRate);

          const lines: {
            description: string;
            quantity: number;
            unitPrice: number;
            vatRate: number;
            horseId?: string;
          }[] = [
            {
              description: prorated
                ? `Pupilaje ${contract.horse.name} (${activeDays}/${daysInMonth} dias)`
                : `Pupilaje mensual ${contract.horse.name}`,
              quantity: 1,
              unitPrice: baseAmount,
              vatRate: baseVat,
              horseId: contract.horseId,
            },
          ];

          const oneOffIds: string[] = [];
          for (const extra of contract.extras) {
            if (extra.recurring) {
              lines.push({
                description: extra.concept,
                quantity: 1,
                unitPrice: Number(extra.amount),
                vatRate: Number(extra.vatRate),
                horseId: contract.horseId,
              });
            } else if (!extra.oneOffApplied) {
              lines.push({
                description: extra.concept,
                quantity: 1,
                unitPrice: Number(extra.amount),
                vatRate: Number(extra.vatRate),
                horseId: contract.horseId,
              });
              oneOffIds.push(extra.id);
            }
          }

          const totals = computeTotals(lines);
          const issueDate = new Date();

          await tx.invoice.create({
            data: {
              tenantId: ctx.tenantId,
              clientId: contract.clientId,
              boardingContractId: contract.id,
              seriesId: series.id,
              series: label,
              number: nextNumber++,
              issueDate,
              dueDate: addDays(issueDate, 30),
              status: "ISSUED",
              subtotal: totals.subtotal.toFixed(2),
              vatTotal: totals.vatTotal.toFixed(2),
              total: totals.total.toFixed(2),
              lines: {
                create: lines.map((l) => ({
                  description: l.description,
                  quantity: l.quantity.toFixed(2),
                  unitPrice: l.unitPrice.toFixed(2),
                  vatRate: l.vatRate.toFixed(2),
                  horseId: l.horseId,
                })),
              },
            },
          });

          if (oneOffIds.length > 0) {
            await tx.boardingContractExtra.updateMany({
              where: { id: { in: oneOffIds }, tenantId: ctx.tenantId },
              data: { oneOffApplied: true },
            });
          }

          generated++;
        }

        if (generated > 0) {
          await tx.invoiceSeries.update({
            where: { id: series.id },
            data: { nextNumber },
          });
        }

        return { generated };
      });
    }),
});
