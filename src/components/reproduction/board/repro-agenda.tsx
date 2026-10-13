import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Baby, Stethoscope, Syringe, Warning, WarningCircle, Info } from "@phosphor-icons/react/dist/ssr";
import type { MareOverview } from "@/server/services/reproduction/overview";
import { calendarDayOffset } from "@/lib/day-window";
import { nextAction } from "@/lib/repro-board";
import { SectionHeading } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { mareCycleHref } from "./use-mare-summary";
import { useDueLabel } from "./use-due-label";

const AHEAD_DAYS = 14;
const FOALING_AHEAD_DAYS = 30;
const MAX_ROWS = 15;

type AgendaRow = {
  id: string;
  /** Día en que se agrupa: hoy para lo que ya está abierto. */
  dayOffset: number;
  overdue: boolean;
  mare: string;
  label: string;
  href: string;
  icon: "scan" | "task" | "foaling";
  from: Date;
  to: Date;
};

/** What is coming, day by day: scans, heats, gestation milestones and foalings. */
export function ReproAgenda({ tracked, tenantSlug }: { tracked: MareOverview[]; tenantSlug: string }) {
  const t = useTranslations("repro.agenda");
  const format = useFormatter();
  const dueLabel = useDueLabel();
  const now = new Date();

  const rows: AgendaRow[] = tracked.flatMap((m) => {
    const href = mareCycleHref(tenantSlug, m);
    const action = nextAction(m.insight.phase, m.insight.actions);
    const actions = m.insight.actions
      .filter((a) => a.kind !== "foaling_watch")
      .filter((a) => a.overdue || calendarDayOffset(new Date(a.from), now) <= AHEAD_DAYS)
      .map((a) => ({
        id: `${m.mare.id}-${a.kind}-${+new Date(a.from)}`,
        dayOffset: Math.max(0, calendarDayOffset(new Date(a.from), now)),
        overdue: a.overdue,
        mare: m.mare.name,
        label: a.label,
        // El hito no tiene formulario propio: lleva a la temporada.
        href: a.kind === "milestone" || !action ? href : `${href}?accion=${action.action}`,
        icon: a.kind === "milestone" ? ("task" as const) : ("scan" as const),
        from: new Date(a.from),
        to: new Date(a.to),
      }));
    const g = m.insight.gestation;
    const foaling =
      g && calendarDayOffset(new Date(g.expected), now) <= FOALING_AHEAD_DAYS
        ? [
            {
              id: `${m.mare.id}-foaling`,
              dayOffset: Math.max(0, calendarDayOffset(new Date(g.expected), now)),
              overdue: false,
              mare: m.mare.name,
              label: t("foaling"),
              href: `${href}?accion=vigilancia`,
              icon: "foaling" as const,
              from: new Date(g.windowFrom),
              to: new Date(g.windowTo),
            },
          ]
        : [];
    return [...actions, ...foaling];
  });

  const sorted = rows
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dayOffset - b.dayOffset || +a.from - +b.from)
    .slice(0, MAX_ROWS);
  const groups = new Map<string, { title: string; rows: AgendaRow[] }>();
  for (const row of sorted) {
    const key = row.overdue ? "overdue" : `d${row.dayOffset}`;
    const title = row.overdue
      ? t("overdue")
      : row.dayOffset === 0
        ? t("today")
        : row.dayOffset === 1
          ? t("tomorrow")
          : format.dateTime(new Date(now.getTime() + row.dayOffset * 86_400_000), {
              weekday: "long",
              day: "numeric",
              month: "short",
            });
    const group = groups.get(key) ?? { title, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  const icons = { scan: Stethoscope, task: Syringe, foaling: Baby };

  return (
    <section aria-labelledby="agenda-heading" className="space-y-3">
      <SectionHeading id="agenda-heading" title={t("title")} description={t("description")} />
      {groups.size === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-body text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          {[...groups.entries()].map(([key, group]) => (
            <div key={key} className="space-y-1">
              <h3
                className={cn(
                  "text-micro font-semibold uppercase first-letter:uppercase",
                  key === "overdue" ? "text-state-alert-ink" : "text-muted-foreground",
                )}
              >
                {group.title}
              </h3>
              <ul className="divide-y divide-border/70">
                {group.rows.map((row) => {
                  const Icon = icons[row.icon];
                  const due = dueLabel(row.from, row.to, row.overdue, now);
                  return (
                    <li key={row.id}>
                      <Link
                        href={row.href}
                        className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-primary/[0.05]"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            row.icon === "foaling"
                              ? "bg-state-danger-soft text-state-danger-ink"
                              : row.overdue
                                ? "bg-state-alert-soft text-state-alert-ink"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-medium text-foreground">{row.mare}</span>
                          <span className="block truncate text-label text-muted-foreground">{row.label}</span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-label",
                            due.tone === "overdue" && "font-semibold text-state-alert-ink",
                            due.tone === "now" && "font-semibold text-foreground",
                            due.tone === "later" && "text-muted-foreground",
                          )}
                        >
                          {due.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Warnings from the engine (foaling signs, losses, fluid after covering). */
export function ReproAlerts({ tracked, tenantSlug }: { tracked: MareOverview[]; tenantSlug: string }) {
  const t = useTranslations("repro.alerts");
  const rank = { danger: 0, warning: 1, info: 2 } as const;
  const alerts = tracked
    .flatMap((m) => m.insight.alerts.map((alert) => ({ m, alert })))
    .sort((a, b) => rank[a.alert.level] - rank[b.alert.level]);

  return (
    <section aria-labelledby="alerts-heading" className="space-y-3">
      <SectionHeading id="alerts-heading" title={t("title")} />
      {alerts.length === 0 ? (
        <p className="text-body text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map(({ m, alert }) => {
            const Icon = alert.level === "danger" ? WarningCircle : alert.level === "warning" ? Warning : Info;
            return (
              <li key={`${m.mare.id}-${alert.key}`}>
                <Link
                  href={mareCycleHref(tenantSlug, m)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-label transition-colors hover:brightness-[0.98]",
                    alert.level === "danger" && "border-state-danger/30 bg-state-danger-soft text-state-danger-ink",
                    alert.level === "warning" && "border-state-alert/30 bg-state-alert-soft text-state-alert-ink",
                    alert.level === "info" && "border-border bg-card text-muted-foreground",
                  )}
                >
                  <Icon aria-hidden weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-semibold">{m.mare.name}.</span> {alert.message}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
