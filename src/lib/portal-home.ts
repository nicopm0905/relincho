import { pendingHealthDue } from "@/lib/health-due";
import { calendarDayOffset } from "@/lib/day-window";
import { buildFeed, feedByDay, type ActivityKind, type TrainingInput } from "@/lib/horse-feed";

/**
 * Portada de la app del cliente (roadmap §4 E8, v1). Motor puro: decide qué ve
 * el cliente nada más entrar y en qué orden. Primero lo que le pide una acción,
 * luego lo que le interesa de su caballo:
 *  1. incidencias sin confirmar (las graves primero);
 *  2. facturas vencidas (la más antigua primero);
 *  3. vencimientos sanitarios de los próximos 30 días (los ya pasados primero).
 * Aparte: facturas pendientes que aún no han vencido, el último herraje de
 * cada caballo, la actividad de la última semana (feed de E6, vista de
 * propietario) y los entrenamientos programados de la semana que viene. Es lo
 * que más preguntan los propietarios: si han sacado y entrenado a su caballo.
 */

/** Ventana de vencimientos que se enseñan en portada. */
export const UPCOMING_DAYS = 30;
/** Días de actividad hacia atrás (hoy incluido) y de entrenamientos hacia delante. */
export const ACTIVITY_DAYS = 7;
export const SCHEDULED_DAYS = 7;

export interface PortalHomeInput {
  now: Date;
  horses: { id: string; name: string }[];
  /** Incidencias en las que el miembro es destinatario (E5; hoy, lista vacía). */
  incidents: {
    id: string;
    horseId: string;
    category: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    occurredAt: Date;
    acknowledgedByMe: boolean;
  }[];
  /** Facturas del cliente con lo que queda por pagar (`invoiceBalance`). */
  invoices: {
    id: string;
    number: string | null;
    status: string;
    dueDate: Date | null;
    pending: number;
  }[];
  health: {
    id: string;
    type: string;
    name: string;
    date: Date;
    nextDueDate: Date | null;
    horse: { id: string; name: string };
  }[];
  /** Entrenamientos de sus caballos, hechos y programados. Las notas no se enseñan. */
  trainings: TrainingInput[];
}

export type PortalHomeItem =
  | { kind: "INCIDENT"; id: string; horseId: string; category: string; severity: "LOW" | "MEDIUM" | "HIGH"; at: Date }
  | { kind: "INVOICE_OVERDUE"; id: string; number: string | null; pending: number; dueDate: Date | null }
  | { kind: "HEALTH_DUE"; id: string; horseId: string; horseName: string; type: string; name: string; due: Date; offset: number };

export interface PortalHome {
  /** Con caballos es propietario; sin caballos, alumno (solo clases). */
  audience: "OWNER" | "STUDENT";
  /** Qué estado vacío enseñar, o `null` si hay algo que mostrar. */
  emptyState: "STUDENT_NO_HORSE" | "OWNER_ALL_CLEAR" | null;
  items: PortalHomeItem[];
  pendingInvoices: { id: string; number: string | null; pending: number; dueDate: Date | null }[];
  lastFarrier: { horseId: string; horseName: string; date: Date | null }[];
  /** Últimos `ACTIVITY_DAYS` días, de hoy hacia atrás. Vacío para el alumno. */
  activity: { day: string; items: PortalActivityItem[]; emptyLabel: string | null }[];
  scheduledTrainings: { id: string; horseId: string; horseName: string; date: Date; minutes: number; type: string | null }[];
}

export interface PortalActivityItem {
  id: string;
  horseId: string;
  horseName: string;
  source: "activity" | "training" | "health";
  kind: ActivityKind;
  at: Date;
  durationMin: number | null;
  title: string | null;
}

const SEVERITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

const isOpen = (inv: PortalHomeInput["invoices"][number]) =>
  (inv.status === "ISSUED" || inv.status === "OVERDUE") && inv.pending > 0;

/** Vencida si el cron ya la marcó o si su vencimiento pasó y aún no lo ha hecho. */
const isOverdue = (inv: PortalHomeInput["invoices"][number], now: Date) =>
  isOpen(inv) && (inv.status === "OVERDUE" || (inv.dueDate !== null && inv.dueDate < now));

export function portalHome(input: PortalHomeInput): PortalHome {
  const { now } = input;
  const audience = input.horses.length > 0 ? "OWNER" : "STUDENT";

  const incidents: PortalHomeItem[] = input.incidents
    .filter((i) => !i.acknowledgedByMe)
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.occurredAt.getTime() - a.occurredAt.getTime(),
    )
    .map((i) => ({ kind: "INCIDENT", id: i.id, horseId: i.horseId, category: i.category, severity: i.severity, at: i.occurredAt }));

  const overdue: PortalHomeItem[] = input.invoices
    .filter((inv) => isOverdue(inv, now))
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .map((inv) => ({ kind: "INVOICE_OVERDUE", id: inv.id, number: inv.number, pending: inv.pending, dueDate: inv.dueDate }));

  const dues: PortalHomeItem[] = pendingHealthDue(input.health, { withinDays: UPCOMING_DAYS, now }).map(
    ({ event, due, offset }) => ({
      kind: "HEALTH_DUE",
      id: event.id,
      horseId: event.horse.id,
      horseName: event.horse.name,
      type: event.type,
      name: event.name,
      due,
      offset,
    }),
  );

  const pendingInvoices = input.invoices
    .filter((inv) => isOpen(inv) && !isOverdue(inv, now))
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
    .map(({ id, number, pending, dueDate }) => ({ id, number, pending, dueDate }));

  const lastFarrier = input.horses.map((h) => {
    const dates = input.health
      .filter((e) => e.horse.id === h.id && e.type === "FARRIER" && e.date <= now)
      .map((e) => e.date.getTime());
    return { horseId: h.id, horseName: h.name, date: dates.length ? new Date(Math.max(...dates)) : null };
  });

  const items = [...incidents, ...overdue, ...dues];
  const emptyState =
    audience === "STUDENT"
      ? "STUDENT_NO_HORSE"
      : items.length === 0 && pendingInvoices.length === 0
        ? "OWNER_ALL_CLEAR"
        : null;

  // Feed de la semana: `HorseActivity` llega con E6-2; hasta entonces, solo
  // entrenamientos hechos y actos sanitarios ya ocurridos.
  const nameOf = new Map(input.horses.map((h) => [h.id, h.name]));
  const horseOf = new Map<string, string>();
  const past = input.trainings.filter((t) => t.date <= now);
  const pastHealth = input.health.filter((e) => e.date <= now);
  for (const t of past) horseOf.set(t.id, t.horseId);
  for (const e of pastHealth) horseOf.set(e.id, e.horse.id);
  const feed = buildFeed(
    {
      activities: [],
      trainings: past,
      health: pastHealth.map((e) => ({ id: e.id, horseId: e.horse.id, type: e.type, name: e.name, date: e.date })),
    },
    { viewer: "OWNER" },
  );
  const activity =
    audience === "STUDENT"
      ? []
      : feedByDay(feed, { now, days: ACTIVITY_DAYS }).map(({ day, items: dayItems, emptyLabel }) => ({
          day,
          emptyLabel,
          items: dayItems.map((f): PortalActivityItem => {
            const horseId = horseOf.get(f.id) ?? "";
            return {
              id: f.id,
              horseId,
              horseName: nameOf.get(horseId) ?? "",
              source: f.source,
              kind: f.kind,
              at: f.at,
              durationMin: f.durationMin,
              title: f.title,
            };
          }),
        }));

  const scheduledTrainings = input.trainings
    .filter((t) => t.date > now && calendarDayOffset(t.date, now) <= SCHEDULED_DAYS)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((t) => ({
      id: t.id,
      horseId: t.horseId,
      horseName: nameOf.get(t.horseId) ?? "",
      date: t.date,
      minutes: t.minutes,
      type: t.type,
    }));

  return { audience, emptyState, items, pendingInvoices, lastFarrier, activity, scheduledTrainings };
}
