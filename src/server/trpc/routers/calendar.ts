import { z } from "zod";
import { invoiceLabel } from "@/lib/invoice-label";
import { createTRPCRouter, tenantProcedure } from "../init";
import { allowedHorseIds } from "../access";
import { withTenant } from "@/server/db/prisma";
import { buildReproOverview } from "@/server/services/reproduction/overview";

export type CalendarKind = "health" | "task" | "heat" | "check" | "foaling" | "invoice" | "event";

export type CalendarItem = {
  id: string;
  date: Date;
  kind: CalendarKind;
  title: string;
  subtitle: string;
  /** Ruta relativa a la yeguada (sin el slug). */
  path: string;
  /** Solo en eventos propios: lo que hace falta para editarlos. */
  event?: {
    id: string;
    kind: string;
    title: string;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    notes: string | null;
    horseId: string | null;
  };
};

export const eventKindLabels: Record<string, string> = {
  VET_VISIT: "Veterinario",
  FARRIER: "Herrador",
  COMPETITION: "Concurso / feria",
  VISIT: "Visita",
  OTHER: "Otro",
};

const healthLabels: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro",
};

/**
 * Calendario de la yeguada: las fechas que ya salen de otros modulos (proximas
 * dosis, tareas, ecografias que tocan, partos previstos, vencimientos de
 * facturas) mas los eventos propios (visitas, herrador, concursos).
 */
export const calendarRouter = createTRPCRouter({
  range: tenantProcedure
    .input(
      z
        .object({ from: z.date(), to: z.date() })
        .refine((r) => r.to > r.from && r.to.getTime() - r.from.getTime() <= 100 * 86_400_000, {
          message: "Rango de fechas no válido (máximo 100 días)",
        }),
    )
    .query(async ({ ctx, input }) => {
      const { from, to } = input;
      const ids = await allowedHorseIds(ctx);
      const horseScope = ids ? { horseId: { in: ids } } : {};
      const staff = ctx.role === "OWNER" || ctx.role === "MANAGER" || ctx.role === "GROOM";

      return withTenant(ctx.tenantId, async (tx) => {
        const items: CalendarItem[] = [];

        // Sanidad: proximas dosis, sin las ya repetidas (hay otra del mismo
        // tipo, posterior, en ese caballo).
        const dues = await tx.healthEvent.findMany({
          where: { tenantId: ctx.tenantId, nextDueDate: { gte: from, lt: to }, ...horseScope },
          select: {
            id: true,
            name: true,
            type: true,
            date: true,
            nextDueDate: true,
            horseId: true,
            horse: { select: { name: true } },
          },
        });
        const later = dues.length
          ? await tx.healthEvent.findMany({
              where: {
                tenantId: ctx.tenantId,
                horseId: { in: [...new Set(dues.map((d) => d.horseId))] },
                date: { gt: new Date(Math.min(...dues.map((d) => d.date.getTime()))) },
              },
              select: { id: true, horseId: true, type: true, date: true },
            })
          : [];
        for (const due of dues) {
          const repeated = later.some(
            (l) => l.id !== due.id && l.horseId === due.horseId && l.type === due.type && l.date > due.date,
          );
          if (repeated) continue;
          items.push({
            id: `health-${due.id}`,
            date: due.nextDueDate!,
            kind: "health",
            title: due.name,
            subtitle: `${due.horse.name} · ${healthLabels[due.type] ?? due.type}`,
            path: "sanidad",
          });
        }

        // Tareas pendientes. Un externo solo ve las de sus caballos.
        const tasks = await tx.task.findMany({
          where: {
            tenantId: ctx.tenantId,
            doneAt: null,
            dueDate: { gte: from, lt: to },
            ...(ids ? { horseId: { in: ids } } : {}),
          },
          select: { id: true, title: true, dueDate: true, notes: true },
        });
        for (const task of tasks) {
          items.push({
            id: `task-${task.id}`,
            date: task.dueDate,
            kind: "task",
            title: task.title,
            subtitle: task.notes || "Tarea",
            path: "tareas",
          });
        }

        // Reproduccion, del mismo motor que la pantalla de Reproduccion. Incluye
        // las gestaciones de la temporada anterior (un parto de febrero viene
        // de una cubricion del año pasado).
        const repro = await buildReproOverview(
          tx,
          ctx.tenantId,
          new Date().getFullYear(),
          ids ? { id: { in: ids } } : {},
        );
        const inRange = (d: Date) => d >= from && d < to;
        const dm = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        for (const m of repro.tracked) {
          const i = m.insight;
          const path = `reproduccion/${m.cycle?.id ?? m.latestCycleId ?? ""}`;
          const push = (key: string, date: Date, kind: CalendarKind, title: string, subtitle: string) =>
            inRange(date) &&
            items.push({ id: `${key}-${m.mare.id}`, date, kind, title: `${title} · ${m.mare.name}`, subtitle, path });
          if (i.gestation) {
            push(
              "foaling",
              i.gestation.expected,
              "foaling",
              "Parto previsto",
              `Probable entre el ${dm(i.gestation.windowFrom)} y el ${dm(i.gestation.windowTo)}`,
            );
          }
          if (i.nextCheck) {
            push("check", i.nextCheck.due, "check", i.nextCheck.label, `Días ${i.nextCheck.from}-${i.nextCheck.to} tras la cubrición`);
          }
          if (i.breeding) {
            push("breed", i.breeding.from, "heat", "Ventana de cubrición", `Hasta el ${dm(i.breeding.to)}`);
          }
          if (i.nextEstrus) {
            push(
              "estrus",
              i.nextEstrus.estrusFrom,
              "heat",
              "Celo previsto",
              i.nextEstrus.extrapolated ? "Estimado sin exploraciones recientes" : `Ovulación ~${dm(i.nextEstrus.ovulation)}`,
            );
          }
          if (i.foalHeat) {
            push("foalheat", i.foalHeat.from, "heat", "Celo del potro", `Hasta el ${dm(i.foalHeat.to)}`);
          }
        }

        // Eventos propios. Un externo solo ve los de sus caballos.
        const events = await tx.event.findMany({
          where: {
            tenantId: ctx.tenantId,
            startsAt: { gte: from, lt: to },
            ...(ids ? { horseId: { in: ids } } : {}),
          },
          include: { horse: { select: { name: true } } },
        });
        for (const event of events) {
          items.push({
            id: `event-${event.id}`,
            date: event.startsAt,
            kind: "event",
            title: event.title,
            subtitle: [eventKindLabels[event.kind] ?? event.kind, event.horse?.name, event.location]
              .filter(Boolean)
              .join(" · "),
            path: "calendario",
            event: {
              id: event.id,
              kind: event.kind,
              title: event.title,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              location: event.location,
              notes: event.notes,
              horseId: event.horseId,
            },
          });
        }

        // Cobros: solo personal de la yeguada.
        if (staff) {
          const invoices = await tx.invoice.findMany({
            where: {
              tenantId: ctx.tenantId,
              status: { in: ["ISSUED", "OVERDUE"] },
              dueDate: { gte: from, lt: to },
            },
            select: { id: true, series: true, number: true, dueDate: true, client: { select: { name: true } } },
          });
          for (const invoice of invoices) {
            items.push({
              id: `invoice-${invoice.id}`,
              date: invoice.dueDate!,
              kind: "invoice",
              title: `Vence factura ${invoiceLabel(invoice)}`,
              subtitle: invoice.client?.name ?? "Sin cliente",
              path: `facturacion/${invoice.id}`,
            });
          }
        }

        return items.sort((a, b) => a.date.getTime() - b.date.getTime());
      });
    }),
});
