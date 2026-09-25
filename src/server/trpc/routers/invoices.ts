import { z } from "zod";
import { invoiceLabel } from "@/lib/invoice-label";
import { invoiceBalance, round2 } from "@/lib/invoice-balance";
import { computeTotals } from "@/lib/invoice-rules";
import { createTRPCRouter, roleProcedure, staffProcedure } from "../init";
import { withTenant } from "@/server/db/prisma";
import { InvoiceStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { issueInvoice, voidInvoice } from "@/server/services/billing/issue";
import { invoicePdfInclude, renderInvoicePdf } from "@/server/services/billing/invoice-pdf";
import { sendInvoiceEmail } from "@/server/services/notifications/email";

const managerProcedure = roleProcedure("OWNER", "MANAGER");

/**
 * Cambios de estado manuales. Emitir (DRAFT -> ISSUED) y anular (-> CANCELLED)
 * no pasan por aqui: tienen sus procedimientos, porque generan registro
 * Veri*Factu. Nada vuelve a DRAFT y PAID/CANCELLED son finales: una factura
 * emitida no se toca, se rectifica.
 */
const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: [],
  ISSUED: ["PAID", "OVERDUE"],
  OVERDUE: ["PAID", "ISSUED"],
  PAID: [],
  CANCELLED: [],
};

/**
 * Etiqueta legible de la serie que se guarda en `Invoice.series` (compatibilidad
 * con el codigo/consultas antiguas). Si el prefijo ya contiene el ano no se
 * duplica (p.ej. serie perezosa por defecto con prefix = "2026").
 */
function seriesLabel(prefix: string, year: number): string {
  return prefix.includes(String(year)) ? prefix : `${prefix}${year}`;
}

/** Lo que hace falta de las rectificativas para calcular el saldo de la original. */
const rectifiersForBalance = {
  select: { status: true, total: true, rectificationKind: true },
  orderBy: { number: "asc" },
} as const;

const lineInput = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number(),
  vatRate: z.number().min(0),
  horseId: z.string().uuid().optional(),
});

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const invoicesRouter = createTRPCRouter({
  /**
   * Lo que queda por cobrar: total pendiente de las emitidas y vencidas, y el
   * detalle de las vencidas. Para el Inicio, sin cargar lineas.
   */
  receivables: staffProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      const open = await tx.invoice.findMany({
        // Las rectificativas no se cobran: su importe ya ajusta la original.
        where: { tenantId: ctx.tenantId, status: { in: ["ISSUED", "OVERDUE"] }, rectifiesId: null },
        select: {
          id: true,
          series: true,
          number: true,
          status: true,
          dueDate: true,
          total: true,
          client: { select: { name: true } },
          payments: { select: { amount: true } },
          rectifiedBy: rectifiersForBalance,
        },
        orderBy: { dueDate: "asc" },
      });
      const rows = open
        .map((inv) => ({
          id: inv.id,
          label: invoiceLabel(inv),
          client: inv.client?.name ?? "Sin cliente",
          dueDate: inv.dueDate,
          overdue: inv.status === "OVERDUE",
          pending: invoiceBalance({ total: inv.total, payments: inv.payments, rectifiers: inv.rectifiedBy }).pending,
        }))
        // Saldo cero (anulada por rectificativa) o negativo (a devolver): no se cobra.
        .filter((r) => r.pending > 0);
      return {
        pendingTotal: round2(rows.reduce((sum, r) => sum + r.pending, 0)),
        openCount: rows.length,
        overdue: rows.filter((r) => r.overdue),
      };
    });
  }),

  list: staffProcedure
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
            rectifiedBy: rectifiersForBalance,
          },
          orderBy: { issueDate: "desc" },
        }),
      );
    }),

  byId: staffProcedure
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
            rectifies: { select: { id: true, series: true, number: true, issueDate: true } },
            rectifiedBy: { select: { id: true, series: true, number: true, status: true, total: true, rectificationKind: true }, orderBy: { number: "asc" } },
            verifactuRecords: {
              select: { id: true, kind: true, hash: true, status: true, generatedAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
        }),
      );
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      return inv;
    }),

  nextNumber: staffProcedure
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
      return withTenant(ctx.tenantId, async (tx) => {
        const current = await tx.invoice.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          select: { status: true },
        });
        if (!current) throw new TRPCError({ code: "NOT_FOUND" });
        if (current.status === input.status) return tx.invoice.findFirstOrThrow({ where: { id: input.id } });

        if (!STATUS_TRANSITIONS[current.status].includes(input.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              current.status === "PAID"
                ? "Una factura pagada ya no cambia de estado."
                : current.status === "CANCELLED"
                  ? "Una factura anulada ya no cambia de estado."
                  : current.status === "DRAFT"
                    ? "Un borrador se emite con «Emitir», no cambiando su estado."
                    : input.status === "CANCELLED"
                      ? "Para anular una factura emitida usa «Anular» (genera el registro de anulación)."
                      : "Una factura emitida no vuelve a borrador ni se modifica: para corregirla hay que emitir una rectificativa.",
          });
        }
        return tx.invoice.update({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { status: input.status },
        });
      });
    }),

  // ---------------------------------------------------------------------------
  // Series de facturacion
  // ---------------------------------------------------------------------------
  seriesList: staffProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) =>
      tx.invoiceSeries.findMany({
        // Las de rectificativas se usan solo desde «Rectificar».
        where: { tenantId: ctx.tenantId, isRectifying: false },
        orderBy: [{ isDefault: "desc" }, { year: "desc" }, { code: "asc" }],
      }),
    );
  }),

  /** Todas las series (tambien la de rectificativas) con cuantas facturas llevan emitidas. */
  seriesOverview: staffProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      const series = await tx.invoiceSeries.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: [{ isRectifying: "asc" }, { isDefault: "desc" }, { year: "desc" }, { code: "asc" }],
        include: { _count: { select: { invoices: { where: { number: { not: null } } } } } },
      });
      return series.map(({ _count, ...s }) => ({ ...s, issuedCount: _count.invoices }));
    });
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
      const label = seriesLabel(input.prefix, input.year);
      return withTenant(ctx.tenantId, async (tx) => {
        // Dos series con la misma etiqueta compartirian numeracion en `Invoice.series`.
        const others = await tx.invoiceSeries.findMany({
          where: { tenantId: ctx.tenantId, ...(input.id ? { id: { not: input.id } } : {}) },
          select: { code: true, prefix: true, year: true },
        });
        if (others.some((o) => o.code === code)) {
          throw new TRPCError({ code: "CONFLICT", message: `Ya existe una serie con el código ${code}.` });
        }
        if (others.some((o) => seriesLabel(o.prefix, o.year) === label)) {
          throw new TRPCError({ code: "CONFLICT", message: `Ya existe una serie que numera como ${label}.` });
        }
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
          if (existing.isRectifying) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "La serie de rectificativas la gestiona el sistema." });
          }
          const changesIdentity =
            existing.code !== code || existing.prefix !== input.prefix || existing.year !== input.year;
          if (changesIdentity) {
            // La numeracion de una serie con facturas emitidas es correlativa y no se reescribe.
            const used = await tx.invoice.count({ where: { seriesId: existing.id } });
            if (used > 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Esta serie ya tiene facturas (o borradores): no se cambia su prefijo ni su año. Crea una serie nueva.",
              });
            }
          }
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
        if (series.isRectifying) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Una serie de rectificativas no puede ser la de por defecto." });
        }
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
        if (series.isRectifying) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esa serie es de rectificativas: se usa desde «Rectificar» en la factura original.",
          });
        }

        const client = await tx.contact.findFirst({
          where: { id: input.clientId, tenantId: ctx.tenantId },
          select: { id: true },
        });
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });

        const totals = computeTotals(input.lines);
        const label = seriesLabel(series.prefix, series.year);
        const dueDate = input.dueDate ?? addDays(input.issueDate, 30);

        const invoice = await tx.invoice.create({
          data: {
            tenantId: ctx.tenantId,
            clientId: input.clientId,
            seriesId: series.id,
            series: label,
            // Sin numero: se asigna al emitir (ver issueInvoice).
            number: null,
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
            // La rectificativa es del cliente de la original: no se cambia.
            clientId: invoice.rectifiesId ? invoice.clientId : (input.clientId ?? invoice.clientId),
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

  /** Emitir: numero, fecha, huella Veri*Factu y QR. Despues, inalterable. */
  issue: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) => issueInvoice(tx, ctx.tenantId, input.id));
    }),

  /** Enviar la factura emitida al cliente por email, con el PDF adjunto. */
  send: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        to: z.string().trim().email("Email no válido"),
        message: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await withTenant(ctx.tenantId, (tx) =>
        tx.invoice.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          include: invoicePdfInclude,
        }),
      );
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.status === "DRAFT" || invoice.status === "CANCELLED" || invoice.number == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo se envían facturas emitidas y vigentes.",
        });
      }

      const { buffer, label } = await renderInvoicePdf(invoice);
      const result = await sendInvoiceEmail({
        to: input.to,
        replyTo: ctx.user?.email ?? undefined,
        issuerName: invoice.tenant.fiscalName || invoice.tenant.name,
        clientName: invoice.client.name,
        invoiceLabel: label,
        total: `${Number(invoice.total).toFixed(2).replace(".", ",")} €`,
        dueDate: invoice.dueDate
          ? invoice.dueDate.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })
          : null,
        message: input.message || undefined,
        pdf: buffer,
        isRectification: Boolean(invoice.rectifiesId),
      });
      if (result.skipped) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El envío de email no está configurado en este entorno.",
        });
      }
      if (!result.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo enviar el email. Inténtalo de nuevo." });
      }
      return { sentTo: input.to };
    }),

  /** Anular una factura emitida por error (con registro de anulacion). */
  void: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) => voidInvoice(tx, ctx.tenantId, input.id));
    }),

  /**
   * Borrar un borrador. Solo si no tiene numero: uno antiguo con numero ya
   * reservado dejaria un hueco en la serie.
   */
  deleteDraft: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          select: { status: true, number: true },
        });
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
        if (invoice.status !== "DRAFT") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se borran borradores" });
        }
        if (invoice.number != null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Este borrador ya tiene número reservado: emítelo y, si sobra, anúlalo.",
          });
        }
        await tx.invoice.delete({ where: { id: input.id } });
        return { id: input.id };
      });
    }),

  /**
   * Crear la rectificativa de una factura emitida, como borrador en la serie
   * de rectificativas. `S` (sustitucion): las lineas son la factura correcta
   * completa. `I` (diferencias): las lineas son solo la diferencia, en
   * negativo lo que se descuenta. `cancelAll` rectifica el total a cero.
   */
  rectify: managerProcedure
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        kind: z.enum(["S", "I"]),
        /** R1 error fundado en derecho/art. 80 uno-dos-seis LIVA, R2 concurso, R3 incobrable, R4 resto. */
        code: z.enum(["R1", "R2", "R3", "R4"]).default("R4"),
        reason: z.string().trim().min(3, "Indica el motivo de la rectificación").max(500),
        cancelAll: z.boolean().default(false),
        lines: z.array(lineInput).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const original = await tx.invoice.findFirst({
          where: { id: input.invoiceId, tenantId: ctx.tenantId },
          include: { lines: true, payments: { select: { amount: true } }, rectifiedBy: rectifiersForBalance },
        });
        if (!original) throw new TRPCError({ code: "NOT_FOUND" });
        if (!["ISSUED", "PAID", "OVERDUE"].includes(original.status) || original.number == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se rectifican facturas emitidas" });
        }
        if (original.rectifiesId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta ya es una rectificativa: rectifica la factura original.",
          });
        }

        const balance = invoiceBalance({
          total: original.total,
          payments: original.payments,
          rectifiers: original.rectifiedBy,
        });
        if (balance.voided) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Esta factura ya está anulada por una rectificativa." });
        }
        if (input.cancelAll && balance.rectified) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ya tiene rectificativas: corrige la diferencia que falta en vez de anular el importe entero.",
          });
        }

        let lines: z.infer<typeof lineInput>[];
        let kind = input.kind;
        if (input.cancelAll) {
          // Anulacion economica: por diferencias, todas las lineas en negativo.
          kind = "I";
          lines = original.lines.map((l) => ({
            description: `Anulación: ${l.description}`,
            quantity: Number(l.quantity),
            unitPrice: -Number(l.unitPrice),
            vatRate: Number(l.vatRate),
            horseId: l.horseId ?? undefined,
          }));
        } else if (input.lines && input.lines.length > 0) {
          lines = input.lines;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Añade las líneas de la rectificativa" });
        }

        const year = new Date().getFullYear();
        const series =
          (await tx.invoiceSeries.findFirst({
            where: { tenantId: ctx.tenantId, isRectifying: true, year },
          })) ??
          (await tx.invoiceSeries.create({
            data: {
              tenantId: ctx.tenantId,
              code: `R-${year}`,
              prefix: "R",
              year,
              isRectifying: true,
            },
          }));

        const totals = computeTotals(lines);
        return tx.invoice.create({
          data: {
            tenantId: ctx.tenantId,
            clientId: original.clientId,
            seriesId: series.id,
            series: seriesLabel(series.prefix, series.year),
            number: null,
            issueDate: new Date(),
            dueDate: addDays(new Date(), 30),
            status: "DRAFT",
            invoiceType: input.code,
            rectifiesId: original.id,
            rectificationKind: kind,
            rectificationReason: input.reason,
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
      });
    }),

  addPayment: managerProcedure
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        /** Positivo: cobro. Negativo: devolucion al cliente (solo si le debemos). */
        amount: z.number().refine((n) => n !== 0, "El importe no puede ser 0"),
        date: z.date(),
        method: z.string().min(1),
        reference: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: input.invoiceId, tenantId: ctx.tenantId },
          include: { payments: { select: { amount: true } }, rectifiedBy: rectifiersForBalance },
        });
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
        if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Solo se registran cobros de facturas emitidas.",
          });
        }
        if (invoice.rectifiesId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Los cobros y devoluciones se registran en la factura original, no en su rectificativa.",
          });
        }

        const balance = invoiceBalance({
          total: invoice.total,
          payments: invoice.payments,
          rectifiers: invoice.rectifiedBy,
        });
        const amount = round2(input.amount);
        if (amount > 0 && amount > balance.pending) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El cobro supera lo pendiente (${Math.max(balance.pending, 0).toFixed(2)} €).`,
          });
        }
        if (amount < 0 && amount < balance.pending) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              balance.pending < 0
                ? `La devolución supera lo que se debe al cliente (${(-balance.pending).toFixed(2)} €).`
                : "No hay nada que devolver: la factura no está cobrada de más.",
          });
        }

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: amount.toFixed(2),
            date: input.date,
            method: input.method,
            reference: input.reference,
          },
        });

        const paid = round2(balance.paid + amount);
        const fullyPaid = round2(balance.effectiveTotal - paid) <= 0;
        // Una factura anulada del todo por rectificativa no pasa a «cobrada»:
        // solo cuando hubo dinero de por medio y ya esta saldada.
        if (fullyPaid && invoice.status !== "PAID" && !(balance.voided && paid === 0)) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: "PAID" },
          });
        }

        return { paid, fullyPaid };
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
        const periodMonth = `${year}-${String(month).padStart(2, "0")}`;
        const drafts: string[] = [];

        for (const contract of contracts) {
          // Evita duplicar la factura del mismo contrato y mes. Antes se miraba
          // la fecha de emision dentro del mes, y generar septiembre en octubre
          // (fecha de octubre) duplicaba al repetir.
          const already = await tx.invoice.findFirst({
            where: { boardingContractId: contract.id, periodMonth },
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

          const draft = await tx.invoice.create({
            data: {
              tenantId: ctx.tenantId,
              clientId: contract.clientId,
              boardingContractId: contract.id,
              periodMonth,
              seriesId: series.id,
              series: label,
              number: null,
              issueDate,
              dueDate: addDays(issueDate, 30),
              status: "DRAFT",
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
            select: { id: true },
          });
          drafts.push(draft.id);

          if (oneOffIds.length > 0) {
            await tx.boardingContractExtra.updateMany({
              where: { id: { in: oneOffIds }, tenantId: ctx.tenantId },
              data: { oneOffApplied: true },
            });
          }

        }

        // Se emiten por el mismo camino que una manual (numero, huella, QR).
        // La que no se puede emitir (cliente sin NIF por encima del limite de
        // la simplificada, yeguada sin datos fiscales) se queda en borrador y
        // se explica.
        let issued = 0;
        const pending: string[] = [];
        for (const id of drafts) {
          try {
            await issueInvoice(tx, ctx.tenantId, id);
            issued++;
          } catch (err) {
            if (err instanceof TRPCError && err.code === "PRECONDITION_FAILED") {
              pending.push(err.message);
              continue;
            }
            throw err;
          }
        }
        return {
          generated: drafts.length,
          issued,
          pendingReasons: [...new Set(pending)],
        };
      });
    }),
});
