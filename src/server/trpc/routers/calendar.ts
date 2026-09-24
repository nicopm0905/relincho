import { z } from "zod";
import { invoiceLabel } from "@/lib/invoice-label";
import { createTRPCRouter, tenantProcedure } from "../init";
import { allowedHorseIds } from "../access";
import { withTenant } from "@/server/db/prisma";
import { gestation, mareState, nextCheckpoint } from "@/lib/reproduction";

export type CalendarKind = "health" | "task" | "check" | "foaling" | "invoice" | "event";

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

        // Reproduccion: ciclos de esta temporada y la anterior (un parto de
        // febrero viene de una cubricion del año pasado).
        const year = new Date().getFullYear();
        const cycles = await tx.reproductionCycle.findMany({
          where: {
            tenantId: ctx.tenantId,
            season: { in: [year - 1, year] },
            ...(ids ? { mareId: { in: ids } } : {}),
          },
          select: {
            id: true,
            mare: { select: { name: true } },
            coverings: {
              orderBy: { date: "desc" },
              take: 1,
              select: {
                date: true,
                foaling: { select: { id: true } },
                pregnancyChecks: { orderBy: { date: "desc" }, take: 1, select: { date: true, result: true } },
                _count: { select: { pregnancyChecks: true } },
              },
            },
          },
        });
        for (const cycle of cycles) {
          const covering = cycle.coverings[0];
          if (!covering) continue;
          const state = mareState(covering);
          if (state === "PREGNANT" || state === "TWINS") {
            const g = gestation(covering.date);
            if (g.expected >= from && g.expected < to) {
              items.push({
                id: `foaling-${cycle.id}`,
                date: g.expected,
                kind: "foaling",
                title: `Parto previsto · ${cycle.mare.name}`,
                subtitle: "Ventana normal de 335 a 342 días",
                path: `reproduccion/${cycle.id}`,
              });
            }
          }
          if (state === "COVERED" || state === "PREGNANT" || state === "TWINS") {
            const next = nextCheckpoint(covering.date, covering._count.pregnancyChecks);
            if (next && next.due >= from && next.due < to) {
              items.push({
                id: `check-${cycle.id}`,
                date: next.due,
                kind: "check",
                title: `${next.label} · ${cycle.mare.name}`,
                subtitle: `Días ${next.from}-${next.to} tras la cubrición`,
                path: `reproduccion/${cycle.id}`,
              });
            }
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
