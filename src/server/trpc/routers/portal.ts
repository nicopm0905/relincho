import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, roleProcedure } from "../init";
import { inSequence, withTenant } from "@/server/db/prisma";
import { withDownloadUrls } from "@/server/services/documents";
import type { PrismaClient } from "@prisma/client";

/**
 * Portal del propietario externo (Fase 1).
 *
 * Un `Membership` con rol `OWNER_EXTERNAL` es un cliente de pupilaje: sólo puede
 * ver SUS caballos (los de su `HorseAccess`), sus facturas y su saldo.
 *
 * Se apoya en `roleProcedure("OWNER_EXTERNAL")` (Fase 0), que ya deja en el
 * contexto `tenantId`, `role` y `membershipId` no nulos; aquí sólo añadimos el
 * email del usuario para el match factura ↔ propietario.
 */
const portalProcedure = roleProcedure("OWNER_EXTERNAL").use(({ ctx, next }) =>
  next({ ctx: { ...ctx, userEmail: ctx.user.email ?? null } }),
);

/** IDs de los caballos a los que el miembro tiene acceso explícito. */
async function myHorseIds(
  tx: PrismaClient,
  tenantId: string,
  membershipId: string,
): Promise<string[]> {
  const rows = await tx.horse.findMany({
    where: { tenantId, horseAccess: { some: { membershipId } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Facturas del propietario. Match factura <-> propietario:
 *  1. `Invoice.clientId` apunta a un `Contact` del tenant cuyo `email` coincide
 *     con el email del usuario, O
 *  2. la factura tiene alguna línea (`InvoiceLine.horseId`) de uno de sus
 *     caballos.
 */
async function myInvoices(
  tx: PrismaClient,
  args: { tenantId: string; membershipId: string; userEmail: string | null },
) {
  const { tenantId, membershipId, userEmail } = args;
  const horseIds = await myHorseIds(tx, tenantId, membershipId);

  const contacts = userEmail
    ? await tx.contact.findMany({
        where: { tenantId, email: userEmail },
        select: { id: true },
      })
    : [];
  const contactIds = contacts.map((c) => c.id);

  const or: Array<Record<string, unknown>> = [];
  if (contactIds.length) or.push({ clientId: { in: contactIds } });
  if (horseIds.length)
    or.push({ lines: { some: { horseId: { in: horseIds } } } });

  if (or.length === 0) return [];

  return tx.invoice.findMany({
    where: { tenantId, OR: or },
    include: {
      payments: true,
      client: { select: { id: true, name: true } },
      lines: { include: { horse: { select: { id: true, name: true } } } },
    },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
  });
}

export const portalRouter = createTRPCRouter({
  /** Caballos del miembro vía `HorseAccess`. */
  myHorses: portalProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) =>
      tx.horse.findMany({
        where: {
          tenantId: ctx.tenantId,
          horseAccess: { some: { membershipId: ctx.membershipId } },
        },
        select: {
          id: true,
          name: true,
          coat: true,
          breed: true,
          birthDate: true,
          boxLocation: true,
          photoUrl: true,
          sex: true,
          status: true,
        },
        orderBy: { name: "asc" },
      }),
    );
  }),

  /** Ficha de un caballo + sanidad + entrenamientos. Valida el acceso. */
  horseDetail: portalProcedure
    .input(z.object({ horseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const horse = await withTenant(ctx.tenantId, (tx) =>
        tx.horse.findFirst({
          where: {
            id: input.horseId,
            tenantId: ctx.tenantId,
            horseAccess: { some: { membershipId: ctx.membershipId } },
          },
          include: {
            healthEvents: { orderBy: { date: "desc" } },
            trainings: { orderBy: { date: "desc" } },
            documents: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
            },
          },
        }),
      );
      if (!horse) throw new TRPCError({ code: "NOT_FOUND" });
      // La URL se firma fuera de la transaccion y solo cuando la pide el
      // propietario que tiene acceso a este caballo.
      return { ...horse, documents: await withDownloadUrls(horse.documents) };
    }),

  /**
   * Próximos eventos de sanidad/herraje y entrenamiento de sus caballos, sólo
   * lectura, ventana de los próximos 60 días.
   */
  agenda: portalProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      const horseIds = await myHorseIds(tx, ctx.tenantId, ctx.membershipId);
      if (horseIds.length === 0) return { health: [], trainings: [] };

      const now = new Date();
      const until = new Date();
      until.setDate(until.getDate() + 60);

      const [health, trainings] = await inSequence([
        () => tx.healthEvent.findMany({
          where: {
            tenantId: ctx.tenantId,
            horseId: { in: horseIds },
            OR: [
              { nextDueDate: { gte: now, lte: until } },
              { date: { gte: now, lte: until } },
            ],
          },
          include: { horse: { select: { id: true, name: true } } },
          orderBy: { date: "asc" },
        }),
        () => tx.trainingSession.findMany({
          where: {
            tenantId: ctx.tenantId,
            horseId: { in: horseIds },
            date: { gte: now, lte: until },
          },
          include: { horse: { select: { id: true, name: true } } },
          orderBy: { date: "asc" },
        }),
      ]);

      return { health, trainings };
    });
  }),

  /** Facturas del propietario, con sus pagos. */
  myInvoices: portalProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, (tx) =>
      myInvoices(tx, {
        tenantId: ctx.tenantId,
        membershipId: ctx.membershipId,
        userEmail: ctx.userEmail,
      }),
    );
  }),

  /**
   * Saldo actual = suma de `total` de facturas ISSUED + OVERDUE menos los
   * `Payment` asociados.
   */
  balance: portalProcedure.query(async ({ ctx }) => {
    return withTenant(ctx.tenantId, async (tx) => {
      const invoices = await myInvoices(tx, {
        tenantId: ctx.tenantId,
        membershipId: ctx.membershipId,
        userEmail: ctx.userEmail,
      });

      let balance = 0;
      for (const inv of invoices) {
        if (inv.status !== "ISSUED" && inv.status !== "OVERDUE") continue;
        const paid = inv.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        balance += Number(inv.total) - paid;
      }
      return Math.round(balance * 100) / 100;
    });
  }),

  /** Documentos vinculados a sus caballos. */
  myDocuments: portalProcedure.query(async ({ ctx }) => {
    const rows = await withTenant(ctx.tenantId, async (tx) => {
      const horseIds = await myHorseIds(tx, ctx.tenantId, ctx.membershipId);
      if (horseIds.length === 0) return [];
      return tx.document.findMany({
        where: {
          tenantId: ctx.tenantId,
          horseId: { in: horseIds },
          deletedAt: null,
        },
        include: { horse: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
    });
    // Las URLs firmadas se generan fuera de la transaccion: firmar no es una
    // consulta y no debe alargar el tiempo en que el contexto RLS esta abierto.
    return withDownloadUrls(rows);
  }),
});
