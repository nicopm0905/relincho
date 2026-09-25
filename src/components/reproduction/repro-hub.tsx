"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Warning, WarningCircle, Info } from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  reproPhaseLabels,
  seasonCategoryLabels,
  type ReproAction,
  type ReproPhase,
} from "@/lib/repro-engine";
import type { MareOverview } from "@/server/services/reproduction/overview";
import { PhaseBadge } from "./phase-badge";

const DAY = 24 * 60 * 60 * 1000;

function fmt(date: Date | string, withTime = false) {
  const d = new Date(date);
  const hasTime = withTime && (d.getHours() !== 0 || d.getMinutes() !== 0);
  return format(d, hasTime ? "d MMM, HH:mm" : "d MMM", { locale: es });
}

function mareHref(tenantSlug: string, m: MareOverview) {
  const id = m.cycle?.id ?? m.latestCycleId;
  return id
    ? `/${tenantSlug}/reproduccion/${id}`
    : `/${tenantSlug}/caballos/${m.mare.id}`;
}

/** La linea que mas importa de cada yegua segun su fase. */
function summary(m: MareOverview): string {
  const i = m.insight;
  switch (i.phase) {
    case "IN_HEAT": {
      const parts: string[] = [];
      if (i.lastExam?.follicleMm)
        parts.push(`Folículo ${i.lastExam.follicleMm} mm`);
      if (i.ovulation)
        parts.push(`ovulación ~${fmt(i.ovulation.expected, true)}`);
      return parts.join(" · ") || "Signos de celo en la última exploración";
    }
    case "COVERED":
      return i.nextCheck
        ? `${i.nextCheck.label}: ${fmt(i.nextCheck.due)}`
        : "Pendiente de ecografía";
    case "PREGNANT":
    case "FOALING_SOON":
      return i.gestation
        ? `Día ${i.gestation.days} · parto ~${fmt(i.gestation.expected)}`
        : "Gestante";
    case "POSTPARTUM":
      return i.foalHeat
        ? `Celo del potro ${fmt(i.foalHeat.from)} – ${fmt(i.foalHeat.to)}`
        : "Recién parida";
    case "DIESTRUS":
      return i.nextEstrus
        ? `Próximo celo ~${fmt(i.nextEstrus.estrusFrom)}${i.nextEstrus.extrapolated ? " (estimado)" : ""}`
        : "Ciclando";
    case "ANESTRUS":
      return "Anestro estacional";
    default:
      return "Registra una exploración para empezar a predecir";
  }
}

// ---------------------------------------------------------------------------
// Hoy
// ---------------------------------------------------------------------------

type Row = { mare: MareOverview; action: ReproAction };

function ActionSection({
  title,
  rows,
  tone,
  tenantSlug,
}: {
  title: string;
  rows: Row[];
  tone?: "overdue";
  tenantSlug: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-[13px] font-semibold text-muted-foreground">
        {title} <span className="font-normal">· {rows.length}</span>
      </h3>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map(({ mare, action }, idx) => (
          <li key={`${mare.mare.id}-${action.kind}-${idx}`}>
            <Link
              href={mareHref(tenantSlug, mare)}
              className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">
                  {mare.mare.name}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {action.label}
                  </span>
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  {summary(mare)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "text-[12.5px] tabular-nums",
                    tone === "overdue"
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {fmt(action.from, true)}
                  {new Date(action.to).getTime() -
                    new Date(action.from).getTime() >
                    2 * 60 * 60 * 1000 && ` – ${fmt(action.to, true)}`}
                </span>
                <PhaseBadge phase={mare.insight.phase} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodayView({
  tracked,
  tenantSlug,
}: {
  tracked: MareOverview[];
  tenantSlug: string;
}) {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday.getTime() + DAY - 1);
  const endWeek = new Date(startToday.getTime() + 8 * DAY - 1);

  const rows: Row[] = tracked.flatMap((mare) =>
    mare.insight.actions.map((action) => ({ mare, action })),
  );
  const byStart = (a: Row, b: Row) =>
    new Date(a.action.from).getTime() - new Date(b.action.from).getTime();
  const overdue = rows.filter((r) => r.action.overdue).sort(byStart);
  const today = rows
    .filter(
      (r) =>
        !r.action.overdue &&
        new Date(r.action.from) <= endToday &&
        new Date(r.action.to) >= startToday,
    )
    .sort(byStart);
  const week = rows
    .filter(
      (r) =>
        !r.action.overdue &&
        new Date(r.action.from) > endToday &&
        new Date(r.action.from) <= endWeek,
    )
    .sort(byStart);

  const alerts = tracked
    .flatMap((mare) => mare.insight.alerts.map((alert) => ({ mare, alert })))
    .sort((a, b) => {
      const rank = { danger: 0, warning: 1, info: 2 } as const;
      return rank[a.alert.level] - rank[b.alert.level];
    });

  const empty = overdue.length + today.length + week.length === 0;

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[13px] font-semibold text-muted-foreground">
            Avisos
          </h3>
          <ul className="space-y-2">
            {alerts.map(({ mare, alert }, idx) => {
              const Icon =
                alert.level === "danger"
                  ? WarningCircle
                  : alert.level === "warning"
                    ? Warning
                    : Info;
              return (
                <li key={`${mare.mare.id}-${alert.key}-${idx}`}>
                  <Link
                    href={mareHref(tenantSlug, mare)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] transition-colors hover:bg-muted/40",
                      alert.level === "danger" &&
                        "border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10",
                      alert.level === "warning" &&
                        "border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",
                      alert.level === "info" && "border-border bg-card",
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <span className="font-medium">{mare.mare.name}:</span>{" "}
                      {alert.message}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <ActionSection
        title="Atrasado"
        rows={overdue}
        tone="overdue"
        tenantSlug={tenantSlug}
      />
      <ActionSection title="Hoy" rows={today} tenantSlug={tenantSlug} />
      <ActionSection
        title="Próximos 7 días"
        rows={week}
        tenantSlug={tenantSlug}
      />
      {empty && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[13.5px] text-muted-foreground">
          Nada pendiente esta semana. Registra exploraciones para que el sistema
          prediga celos, ovulaciones y ecografías.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tablero por fases
// ---------------------------------------------------------------------------

const BOARD_ORDER: ReproPhase[] = [
  "IN_HEAT",
  "COVERED",
  "PREGNANT",
  "FOALING_SOON",
  "POSTPARTUM",
  "DIESTRUS",
  "ANESTRUS",
  "UNTRACKED",
];

function BoardView({
  tracked,
  tenantSlug,
}: {
  tracked: MareOverview[];
  tenantSlug: string;
}) {
  const groups = BOARD_ORDER.map((phase) => ({
    phase,
    mares: tracked.filter((m) => m.insight.phase === phase),
  })).filter((g) => g.mares.length > 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {groups.map(({ phase, mares }) => (
        <section
          key={phase}
          className="rounded-2xl border border-border bg-muted/30 p-3"
        >
          <header className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-[14px] font-semibold text-foreground">
              {reproPhaseLabels[phase]}
            </h3>
            <span className="text-[12.5px] tabular-nums text-muted-foreground">
              {mares.length}
            </span>
          </header>
          <ul className="space-y-2">
            {mares.map((m) => (
              <li key={m.mare.id}>
                <Link
                  href={mareHref(tenantSlug, m)}
                  className="block rounded-xl border border-border bg-card p-3 shadow-bento transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {m.mare.name}
                    </p>
                    <Badge variant="outline">
                      {seasonCategoryLabels[m.category]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {summary(m)}
                  </p>
                  {m.insight.gestation && (
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={m.insight.gestation.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Progreso de la gestación"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${m.insight.gestation.percent}%` }}
                      />
                    </div>
                  )}
                  {m.stallionName &&
                    (m.insight.gestation || phase === "COVERED") && (
                      <p className="mt-1.5 text-[12px] text-muted-foreground">
                        Semental: {m.stallionName}
                      </p>
                    )}
                  {m.insight.alerts.some((a) => a.level !== "info") && (
                    <p className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-amber-700 dark:text-amber-400">
                      <Warning className="h-3.5 w-3.5" />{" "}
                      {
                        m.insight.alerts.filter((a) => a.level !== "info")
                          .length
                      }{" "}
                      aviso(s)
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linea temporal: 2 semanas atras y 10 adelante
// ---------------------------------------------------------------------------

const PAST_DAYS = 14;
const SPAN_DAYS = 84;

type Segment = { from: Date; to: Date; className: string; label: string };

function segments(m: MareOverview): {
  bars: Segment[];
  marks: { at: Date; className: string; label: string }[];
} {
  const i = m.insight;
  const bars: Segment[] = [];
  const marks: { at: Date; className: string; label: string }[] = [];
  const d = (x: Date | string) => new Date(x);
  if (i.gestation) {
    bars.push({
      from: d(i.gestation.windowFrom),
      to: d(i.gestation.windowTo),
      className: "bg-red-400/70",
      label: "Ventana de parto",
    });
  }
  if (i.nextEstrus) {
    bars.push({
      from: d(i.nextEstrus.estrusFrom),
      to: d(i.nextEstrus.estrusTo),
      className: "bg-amber-300/70",
      label: "Celo previsto",
    });
  }
  if (i.foalHeat) {
    bars.push({
      from: d(i.foalHeat.from),
      to: d(i.foalHeat.to),
      className: "bg-violet-300/80",
      label: "Celo del potro",
    });
  }
  if (i.breeding) {
    bars.push({
      from: d(i.breeding.from),
      to: d(i.breeding.to),
      className: "bg-amber-500",
      label: "Ventana de cubrición",
    });
  }
  if (i.nextCheck) {
    bars.push({
      from: d(i.nextCheck.due),
      to: d(i.nextCheck.limit),
      className: "bg-sky-400/80",
      label: i.nextCheck.label,
    });
  }
  if (i.ovulation)
    marks.push({
      at: d(i.ovulation.expected),
      className: "bg-amber-700",
      label: "Ovulación prevista",
    });
  if (i.nextEstrus)
    marks.push({
      at: d(i.nextEstrus.ovulation),
      className: "bg-amber-600/70",
      label: "Ovulación estimada",
    });
  if (i.lastOvulation)
    marks.push({
      at: d(i.lastOvulation),
      className: "bg-foreground/60",
      label: "Última ovulación",
    });
  return { bars, marks };
}

function TimelineView({
  tracked,
  tenantSlug,
}: {
  tracked: MareOverview[];
  tenantSlug: string;
}) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setTime(start.getTime() - PAST_DAYS * DAY);
  const end = new Date(start.getTime() + SPAN_DAYS * DAY);
  const pct = (date: Date) =>
    Math.min(
      100,
      Math.max(
        0,
        ((date.getTime() - start.getTime()) /
          (end.getTime() - start.getTime())) *
          100,
      ),
    );
  const weeks = Array.from(
    { length: SPAN_DAYS / 7 },
    (_, k) => new Date(start.getTime() + k * 7 * DAY),
  );
  const todayPct = pct(new Date());

  const legend = [
    ["bg-amber-300/70", "Celo previsto"],
    ["bg-amber-500", "Ventana de cubrición"],
    ["bg-sky-400/80", "Ecografía"],
    ["bg-violet-300/80", "Celo del potro"],
    ["bg-red-400/70", "Ventana de parto"],
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        {legend.map(([cls, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-4 rounded-sm", cls)} /> {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-700" /> Ovulación
        </span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[160px_1fr] border-b border-border text-[11.5px] text-muted-foreground">
            <div className="px-3 py-2">Yegua</div>
            <div className="relative h-8">
              {weeks.map((w) => (
                <span
                  key={w.toISOString()}
                  className="absolute top-2 -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${pct(w)}%` }}
                >
                  {format(w, "d MMM", { locale: es })}
                </span>
              ))}
            </div>
          </div>
          {tracked.map((m) => {
            const { bars, marks } = segments(m);
            return (
              <div
                key={m.mare.id}
                className="grid grid-cols-[160px_1fr] border-b border-border last:border-b-0"
              >
                <Link
                  href={mareHref(tenantSlug, m)}
                  className="truncate px-3 py-3 text-[13px] font-medium text-foreground hover:underline"
                >
                  {m.mare.name}
                </Link>
                <div className="relative h-11">
                  {weeks.map((w) => (
                    <span
                      key={w.toISOString()}
                      className="absolute inset-y-0 w-px bg-border/60"
                      style={{ left: `${pct(w)}%` }}
                    />
                  ))}
                  <span
                    className="absolute inset-y-0 w-0.5 bg-primary/70"
                    style={{ left: `${todayPct}%` }}
                    aria-hidden
                  />
                  {bars
                    .filter((b) => b.to > start && b.from < end)
                    .map((b, idx) => (
                      <span
                        key={`${b.label}-${idx}`}
                        title={`${b.label}: ${fmt(b.from, true)} – ${fmt(b.to, true)}`}
                        className={cn(
                          "absolute top-3.5 h-4 rounded",
                          b.className,
                        )}
                        style={{
                          left: `${pct(b.from)}%`,
                          width: `${Math.max(0.8, pct(b.to) - pct(b.from))}%`,
                        }}
                      />
                    ))}
                  {marks
                    .filter((k) => k.at > start && k.at < end)
                    .map((k, idx) => (
                      <span
                        key={`${k.label}-${idx}`}
                        title={`${k.label}: ${fmt(k.at, true)}`}
                        className={cn(
                          "absolute top-[18px] h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-card",
                          k.className,
                        )}
                        style={{ left: `${pct(k.at)}%` }}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ReproHub({
  tracked,
  tenantSlug,
}: {
  tracked: MareOverview[];
  tenantSlug: string;
}) {
  const pending = tracked.reduce(
    (n, m) =>
      n +
      m.insight.actions.filter(
        (a) => a.overdue || new Date(a.from).getTime() <= Date.now() + DAY,
      ).length,
    0,
  );

  return (
    <Tabs defaultValue="today" className="space-y-4">
      <TabsList>
        <TabsTrigger value="today">
          Hoy
          {pending > 0 && (
            <span className="ml-1 tabular-nums text-muted-foreground">
              ({pending})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="board">Tablero</TabsTrigger>
        <TabsTrigger value="timeline">Calendario</TabsTrigger>
      </TabsList>
      <TabsContent value="today">
        <TodayView tracked={tracked} tenantSlug={tenantSlug} />
      </TabsContent>
      <TabsContent value="board">
        <BoardView tracked={tracked} tenantSlug={tenantSlug} />
      </TabsContent>
      <TabsContent value="timeline">
        <TimelineView tracked={tracked} tenantSlug={tenantSlug} />
      </TabsContent>
    </Tabs>
  );
}
