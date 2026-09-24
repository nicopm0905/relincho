import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CaretLeft, CaretRight, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { CalendarKind } from "@/server/trpc/routers/calendar";
import { EventDialog } from "@/components/calendario/event-dialog";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ mes?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Calendario — ${tenantSlug}` };
}

const KIND: Record<CalendarKind, { label: string; dot: string; chip: string }> = {
  health: { label: "Sanidad", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200" },
  check: { label: "Ecografía", dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700 border-violet-200" },
  foaling: { label: "Parto", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  task: { label: "Tarea", dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 border-sky-200" },
  invoice: { label: "Cobro", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  event: { label: "Evento", dot: "bg-slate-600", chip: "bg-slate-100 text-slate-700 border-slate-300" },
};

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

/** "2026-09" -> 1 de septiembre de 2026. Si no es valido, el mes actual. */
function parseMonth(value: string | undefined) {
  const match = value && /^(\d{4})-(\d{2})$/.exec(value);
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return new Date(Number(match[1]), month - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const monthParam = (date: Date) => format(date, "yyyy-MM");
const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

export default async function CalendarioPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const { mes } = await searchParams;
  const month = parseMonth(mes);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);

  // La rejilla empieza el lunes de la semana del dia 1 y acaba el domingo de
  // la semana del ultimo dia; se piden los eventos de todo ese tramo.
  const gridStart = new Date(month);
  gridStart.setDate(1 - ((month.getDay() + 6) % 7));
  const lastDay = new Date(next.getTime() - 86_400_000);
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (7 - ((lastDay.getDay() + 6) % 7)));

  const caller = await createServerCaller(tenantSlug);
  const [items, horses] = await Promise.all([
    caller.calendar.range({ from: gridStart, to: gridEnd }),
    caller.horses.list(),
  ]);
  const horseOptions = horses.map((h) => ({ id: h.id, name: h.name }));

  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    const key = dayKey(new Date(item.date));
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  const days: Date[] = [];
  for (let d = new Date(gridStart); d < gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  const todayKey = dayKey(new Date());
  const monthItems = items.filter((item) => {
    const date = new Date(item.date);
    return date >= month && date < next;
  });
  const agendaDays = [...new Set(monthItems.map((item) => dayKey(new Date(item.date))))];

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300">
      <PageHeader
        title="Calendario"
        description="Vacunas, herrador, ecografías, partos, tareas y cobros de la yeguada"
        actions={<EventDialog horses={horseOptions} />}
      />

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-2xl capitalize text-foreground">
          {format(month, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon-sm" aria-label="Mes anterior">
            <Link href={`/${tenantSlug}/calendario?mes=${monthParam(prev)}`}>
              <CaretLeft weight="bold" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/${tenantSlug}/calendario`}>Hoy</Link>
          </Button>
          <Button asChild variant="outline" size="icon-sm" aria-label="Mes siguiente">
            <Link href={`/${tenantSlug}/calendario?mes=${monthParam(next)}`}>
              <CaretRight weight="bold" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Leyenda">
        {(Object.keys(KIND) as CalendarKind[]).map((kind) => (
          <span key={kind} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", KIND[kind].dot)} />
            {KIND[kind].label}
          </span>
        ))}
      </div>

      {/* Rejilla del mes: en movil solo puntos; en escritorio, titulos. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-bento">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-semibold tracking-wider text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dayKey(day);
            const dayItems = byDay.get(key) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            return (
              <div
                key={key}
                className={cn(
                  "min-h-16 border-r border-b border-border/60 p-1.5 last:border-r-0 sm:min-h-24 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    key === todayKey
                      ? "bg-primary font-semibold text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60",
                  )}
                >
                  {day.getDate()}
                </div>
                <div className="flex flex-wrap gap-1 sm:hidden">
                  {dayItems.slice(0, 4).map((item) => (
                    <span key={item.id} className={cn("h-1.5 w-1.5 rounded-full", KIND[item.kind].dot)} />
                  ))}
                </div>
                <ul className="hidden space-y-1 sm:block">
                  {dayItems.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      {item.event ? (
                        <EventDialog
                          horses={horseOptions}
                          event={item.event}
                          trigger={
                            <button
                              type="button"
                              title={`${item.title} — ${item.subtitle}`}
                              className={cn(
                                "block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-80",
                                KIND[item.kind].chip,
                              )}
                            >
                              {format(new Date(item.date), "HH:mm")} {item.title}
                            </button>
                          }
                        />
                      ) : (
                        <Link
                          href={`/${tenantSlug}/${item.path}`}
                          title={`${item.title} — ${item.subtitle}`}
                          className={cn(
                            "block truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight transition-opacity hover:opacity-80",
                            KIND[item.kind].chip,
                          )}
                        >
                          {item.title}
                        </Link>
                      )}
                    </li>
                  ))}
                  {dayItems.length > 3 && (
                    <li className="px-1 text-[11px] text-muted-foreground">+{dayItems.length - 3} más</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda del mes: la vista util en el movil. */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Agenda del mes</h3>
        {agendaDays.length === 0 ? (
          <EmptyState
            icon={<CalendarBlank weight="duotone" />}
            title="Nada previsto este mes"
            description="Aquí aparecen las próximas dosis, ecografías, partos, tareas, cobros y los eventos que añadas."
          />
        ) : (
          <ol className="space-y-4">
            {agendaDays.map((key) => {
              const date = new Date(`${key}T12:00:00`);
              return (
                <li key={key} className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <p
                    className={cn(
                      "text-sm font-semibold capitalize",
                      key === todayKey ? "text-primary-ink" : "text-foreground",
                    )}
                  >
                    {format(date, "EEEE d", { locale: es })}
                  </p>
                  <ul className="space-y-1.5">
                    {(byDay.get(key) ?? []).map((item) => {
                      const row = (
                        <>
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", KIND[item.kind].dot)} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-foreground">
                              {item.event && `${format(new Date(item.date), "HH:mm")} · `}
                              {item.title}
                            </span>
                            <span className="block truncate text-[12.5px] text-muted-foreground">
                              {item.subtitle}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {KIND[item.kind].label}
                          </span>
                        </>
                      );
                      const rowClass =
                        "flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-foreground/20";
                      return (
                        <li key={item.id}>
                          {item.event ? (
                            <EventDialog
                              horses={horseOptions}
                              event={item.event}
                              trigger={
                                <button type="button" className={rowClass}>
                                  {row}
                                </button>
                              }
                            />
                          ) : (
                            <Link href={`/${tenantSlug}/${item.path}`} className={rowClass}>
                              {row}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
