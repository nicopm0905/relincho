import { Suspense } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  Baby,
  CheckSquare,
  Heartbeat,
  Horse,
  Stethoscope,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { InicioSkeleton } from "@/components/inicio/inicio-skeleton";
import { SessionCheckIn } from "@/components/rendimiento/session-check-in";
import { HeatCard } from "@/components/rendimiento/heat-card";
import { QuickActions } from "@/components/inicio/quick-actions";
import {
  AttentionBoard,
  type AttentionGroup,
  type AttentionItem,
  type AttentionTone,
} from "@/components/inicio/attention-board";
import { RecentActivity, type ActivityEntry } from "@/components/inicio/recent-activity";
import { InicioEmpty } from "@/components/inicio/inicio-empty";
import { calendarDayOffset } from "@/lib/day-window";
import { pendingHealthDue } from "@/lib/health-due";
import { horseCategory } from "@/lib/horse-category";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const [{ tenantSlug }, t] = await Promise.all([params, getTranslations("home")]);
  return { title: `${t("metaTitle")} — ${tenantSlug}` };
}

/** Días por delante que cuentan como "ya" en cada bloque. */
const REPRO_AHEAD_DAYS = 2;
const HEALTH_AHEAD_DAYS = 7;

type Due = AttentionItem["due"] & { overdue: boolean };

export default function InicioPage({ params }: PageProps) {
  return (
    <Suspense fallback={<InicioSkeleton />}>
      <InicioContent params={params} />
    </Suspense>
  );
}

async function InicioContent({ params }: PageProps) {
  const { tenantSlug } = await params;
  const now = new Date();
  const season = now.getFullYear();
  const [caller, session, t, format] = await Promise.all([
    createServerCaller(tenantSlug),
    getSession(),
    getTranslations("home"),
    getFormatter(),
  ]);
  const [{ membership }, data] = await Promise.all([
    getTenantAccess(tenantSlug, session?.user?.id),
    Promise.all([
      caller.horses.list(),
      caller.health.list({}),
      caller.reproduction.overview({}),
      caller.reproduction.stats({ season }),
      caller.tasks.list({ done: false }),
      caller.tasks.list({ done: true }),
      caller.performance.overview(),
      caller.performance.pendingCheckIns({}),
      // Facturacion es solo del personal: un veterinario externo ve el Inicio
      // sin cobros.
      caller.invoices.receivables().catch(() => null),
      caller.tasks.assignees().catch(() => []),
      // El tiempo de la finca: se consulta solo, nadie lo apunta.
      caller.weather.heat().catch(() => null),
    ]),
  ]);
  const [
    horses,
    healthEvents,
    repro,
    stats,
    openTasks,
    doneTasks,
    performance,
    pendingCheckIns,
    receivables,
    assignees,
    heat,
  ] = data;

  // Una yeguada recién creada no necesita un panel de ceros: necesita saber
  // por dónde empezar.
  if (horses.length === 0) {
    return (
      <div className="animate-in fade-in-0 space-y-8 duration-300">
        <PageHeader title={t("title")} description={format.dateTime(now, { dateStyle: "full" })} />
        <InicioEmpty tenantSlug={tenantSlug} />
      </div>
    );
  }

  const canRecordHealth = ["OWNER", "MANAGER", "GROOM", "VET_EXTERNAL"].includes(
    membership?.role ?? "",
  );
  const shortDate = (date: Date) => format.dateTime(date, { day: "numeric", month: "short" });

  // ── Cuándo vence cada cosa, en palabras ───────────────────────────────────
  const pointDue = (date: Date): Due => {
    const offset = calendarDayOffset(date, now);
    if (offset < 0) return { label: t("due.overdue", { days: -offset }), tone: "alert", overdue: true };
    if (offset === 0) return { label: t("due.today"), tone: "alert", overdue: false };
    if (offset === 1) return { label: t("due.tomorrow"), tone: "neutral", overdue: false };
    return { label: t("due.inDays", { days: offset }), tone: "neutral", overdue: false };
  };
  /** Ventanas (eco del día 28 al 35, celo...): solo vencen cuando se cierran. */
  const windowDue = (from: Date, to: Date, overdue: boolean): Due => {
    if (overdue) {
      const days = Math.max(0, -calendarDayOffset(to, now));
      return { label: t("due.overdue", { days }), tone: "alert", overdue: true };
    }
    if (calendarDayOffset(from, now) > 0) return pointDue(from);
    if (calendarDayOffset(to, now) <= 0) return pointDue(to);
    return { label: t("due.until", { date: shortDate(to) }), tone: "alert", overdue: false };
  };

  const mareHref = (m: (typeof repro.tracked)[number]) => {
    const id = m.cycle?.id ?? m.latestCycleId;
    return id ? `/${tenantSlug}/reproduccion/${id}` : `/${tenantSlug}/caballos/${m.mare.id}`;
  };
  const horseHref = (id: string) => `/${tenantSlug}/caballos/${id}`;

  const item = ({ due, ...entry }: Omit<AttentionItem, "due" | "overdue"> & { due: Due }): AttentionItem => ({
    ...entry,
    due: { label: due.label, tone: due.tone },
    overdue: due.overdue,
  });
  const notice = (tone: AttentionTone): Due => ({ label: t("due.alert"), tone, overdue: false });

  // ── Partos ──────────────────────────────────────────────────────────────
  const foaling = repro.tracked
    .filter((m) => m.insight.phase === "FOALING_SOON" && m.insight.gestation)
    .sort((a, b) => +a.insight.gestation!.expected - +b.insight.gestation!.expected)
    .map((m) => {
      const g = m.insight.gestation!;
      // La vigilancia preparto (ubre, calcio) es lo más urgente de la pantalla.
      const watch = m.insight.alerts.find((a) => a.key === "foaling_watch" && a.level !== "info");
      const due = windowDue(g.windowFrom, g.windowTo, false);
      return item({
        id: `foaling-${m.mare.id}`,
        title: m.mare.name,
        subtitle: watch?.message ?? t("foaling.subtitle", { date: shortDate(g.expected), day: g.days }),
        href: mareHref(m),
        due: watch ? { ...due, tone: "danger" } : due,
      });
    });

  // ── Reproducción: avisos, ecografías, celos e hitos de gestación ─────────
  const reproAlerts = repro.tracked.flatMap((m) =>
    m.insight.alerts
      .filter((a) => a.level !== "info" && a.key !== "foaling_watch")
      .map((a) =>
        item({
          id: `alert-${m.mare.id}-${a.key}`,
          title: m.mare.name,
          subtitle: a.message,
          href: mareHref(m),
          due: notice(a.level === "danger" ? "danger" : "alert"),
        }),
      ),
  );
  const reproActions = repro.tracked
    .flatMap((m) =>
      m.insight.actions
        .filter((a) => a.kind !== "foaling_watch")
        .filter((a) => a.overdue || calendarDayOffset(new Date(a.from), now) <= REPRO_AHEAD_DAYS)
        .map((a) => ({ m, a })),
    )
    .sort(
      (x, y) =>
        Number(y.a.overdue) - Number(x.a.overdue) || +new Date(x.a.from) - +new Date(y.a.from),
    )
    .map(({ m, a }) =>
      item({
        id: `action-${m.mare.id}-${a.kind}-${+new Date(a.from)}`,
        title: m.mare.name,
        subtitle: a.label,
        href: mareHref(m),
        due: windowDue(new Date(a.from), new Date(a.to), a.overdue),
      }),
    );

  // ── Sanidad: vencido o en los próximos días ──────────────────────────────
  const healthType = (type: string) => t(`healthTypes.${type}` as "healthTypes.OTHER");
  const health = pendingHealthDue(healthEvents, { withinDays: HEALTH_AHEAD_DAYS, now }).map(
    ({ event, due }) =>
      item({
        id: `health-${event.id}`,
        title: event.horse.name,
        subtitle: `${healthType(event.type)} · ${event.name}`,
        href: `${horseHref(event.horse.id)}?tab=sanidad`,
        due: pointDue(due),
      }),
  );

  // ── Tareas de hoy y atrasadas ────────────────────────────────────────────
  const tasks = openTasks
    .filter((task) => calendarDayOffset(new Date(task.dueDate), now) <= 0)
    .map((task) =>
      item({
        id: `task-${task.id}`,
        title: task.title,
        subtitle: [task.horseName, task.assigneeName].filter(Boolean).join(" · ") || undefined,
        href: `/${tenantSlug}/tareas`,
        due: pointDue(new Date(task.dueDate)),
      }),
    );

  // ── Otros: tendones y cobros vencidos ────────────────────────────────────
  const euros = (value: number) => format.number(value, { style: "currency", currency: "EUR" });
  const other = [
    ...performance
      .filter((h) => h.tendonHistoryAlert || h.bufferStatus === "exhausted")
      .map((h) =>
        item({
          id: `performance-${h.horseId}`,
          title: h.name,
          subtitle: [
            h.tendonHistoryAlert ? t("performance.tendon") : null,
            h.bufferStatus === "exhausted" ? t("performance.exhausted") : null,
          ]
            .filter(Boolean)
            .join(" · "),
          href: `/${tenantSlug}/rendimiento/${h.horseId}`,
          due: notice("alert"),
        }),
      ),
    ...(receivables?.overdue ?? []).map((invoice) =>
      item({
        id: `invoice-${invoice.id}`,
        title: t("invoice.title", { client: invoice.client }),
        subtitle: t("invoice.subtitle", { label: invoice.label, amount: euros(invoice.pending) }),
        href: `/${tenantSlug}/facturacion/${invoice.id}`,
        due: pointDue(invoice.dueDate ? new Date(invoice.dueDate) : now),
      }),
    ),
  ];

  const groups: AttentionGroup[] = [
    { key: "foaling", title: t("groups.foaling"), icon: <Baby />, href: `/${tenantSlug}/reproduccion`, items: foaling },
    {
      key: "repro",
      title: t("groups.repro"),
      icon: <Stethoscope />,
      href: `/${tenantSlug}/reproduccion`,
      items: [...reproAlerts, ...reproActions],
    },
    { key: "health", title: t("groups.health"), icon: <Heartbeat />, href: `/${tenantSlug}/sanidad`, items: health },
    { key: "tasks", title: t("groups.tasks"), icon: <CheckSquare />, href: `/${tenantSlug}/tareas`, items: tasks },
    { key: "other", title: t("groups.other"), icon: <Warning />, href: `/${tenantSlug}/rendimiento`, items: other },
  ];
  const attentionItems = groups.flatMap((g) => g.items);
  const overdueCount = attentionItems.filter((i) => i.overdue).length;

  // ── KPIs de cría ─────────────────────────────────────────────────────────
  const pregnant = repro.tracked.filter((m) => m.insight.gestation).length;
  const covered = repro.tracked.filter((m) => m.insight.phase === "COVERED").length;

  const { current, previous } = stats;
  const points = (rate: number) => Math.round(rate * 100);
  const fertilityHint = (() => {
    if (current.perCycleRate === null) return t("kpi.fertilityNone");
    if (previous.perCycleRate === null) {
      return t("kpi.fertilityCycles", { pregnant: current.pregnantCycles, cycles: current.cyclesBred });
    }
    const diff = points(current.perCycleRate) - points(previous.perCycleRate);
    if (diff > 0) return t("kpi.fertilityUp", { diff, previous: previous.season });
    if (diff < 0) return t("kpi.fertilityDown", { diff, previous: previous.season });
    return t("kpi.fertilitySame", { previous: previous.season });
  })();

  const gestations = repro.tracked
    .filter((m) => m.insight.gestation)
    .map((m) => ({ name: m.mare.name, expected: new Date(m.insight.gestation!.expected) }))
    .sort((a, b) => +a.expected - +b.expected);
  const foalingsThisMonth = gestations.filter(
    (g) => g.expected.getFullYear() === now.getFullYear() && g.expected.getMonth() === now.getMonth(),
  ).length;
  const nextFoaling = gestations.find((g) => calendarDayOffset(g.expected, now) >= 0);

  const census = horses.filter((h) => h.status === "ACTIVE" || h.status === "IN_TRAINING");
  const categories = census.map((h) => horseCategory(h, now));
  const young = categories.filter((c) => c === "colt" || c === "filly").length;
  const mares = categories.filter((c) => c === "mare").length;
  const stallions = categories.filter((c) => c === "stallion").length;

  // ── Actividad reciente: contexto, no cosas que hacer ─────────────────────
  const activity: (Omit<ActivityEntry, "when"> & { at: Date })[] = [
    ...healthEvents
      .filter((e) => new Date(e.date) <= now)
      .slice(0, 8)
      .map((e) => ({
        id: `h-${e.id}`,
        at: new Date(e.date),
        icon: <Heartbeat />,
        title: e.horse.name,
        subtitle: `${healthType(e.type)} · ${e.name}`,
        href: horseHref(e.horse.id),
      })),
    ...repro.tracked
      .filter((m) => m.insight.lastExam && new Date(m.insight.lastExam.date) <= now)
      .map((m) => ({
        id: `e-${m.mare.id}`,
        at: new Date(m.insight.lastExam!.date),
        icon: <Stethoscope />,
        title: m.mare.name,
        subtitle: m.insight.lastExam!.follicleMm
          ? t("activity.examFollicle", { mm: m.insight.lastExam!.follicleMm })
          : t("activity.exam"),
        href: mareHref(m),
      })),
    ...doneTasks
      .filter((task) => task.doneAt)
      .map((task) => ({
        id: `t-${task.id}`,
        at: new Date(task.doneAt!),
        icon: <CheckSquare />,
        title: task.title,
        subtitle: [t("activity.taskDone"), task.horseName].filter(Boolean).join(" · "),
        href: `/${tenantSlug}/tareas`,
      })),
    ...horses
      .filter((h) => h.birthDate && calendarDayOffset(new Date(h.birthDate), now) >= -60)
      .map((h) => ({
        id: `b-${h.id}`,
        at: new Date(h.birthDate!),
        icon: <Horse />,
        title: h.name,
        subtitle: t("activity.birth"),
        href: horseHref(h.id),
      })),
  ]
    .sort((a, b) => +b.at - +a.at)
    .slice(0, 6);

  return (
    <div className="animate-in fade-in-0 space-y-10 duration-300">
      <PageHeader
        title={t("title")}
        description={t("subtitle", {
          date: format.dateTime(now, { weekday: "long", day: "numeric", month: "long" }),
          season,
        })}
      />

      <AttentionBoard
        groups={groups}
        summary={t("attention.summary", { total: attentionItems.length, overdue: overdueCount })}
      />

      <section aria-label={t("kpi.census")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          prominent
          label={t("kpi.pregnant")}
          value={pregnant}
          hint={t("kpi.pregnantHint", { covered })}
          href={`/${tenantSlug}/reproduccion`}
        />
        <StatCard
          prominent
          label={t("kpi.fertility", { season })}
          value={
            current.perCycleRate === null
              ? "—"
              : format.number(current.perCycleRate, { style: "percent" })
          }
          hint={fertilityHint}
          href={`/${tenantSlug}/reproduccion/estadisticas`}
        />
        <StatCard
          prominent
          label={t("kpi.foalings")}
          value={foalingsThisMonth}
          hint={
            nextFoaling
              ? t("kpi.foalingsNext", { name: nextFoaling.name, date: shortDate(nextFoaling.expected) })
              : t("kpi.foalingsNone")
          }
          href={`/${tenantSlug}/reproduccion`}
        />
        <StatCard
          prominent
          label={t("kpi.census")}
          value={census.length}
          hint={t("kpi.censusHint", { mares, stallions, young })}
          href={`/${tenantSlug}/caballos`}
        />
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <RecentActivity
          entries={activity.map(({ at, ...entry }) => ({ ...entry, when: shortDate(at) }))}
        />
        <div className="space-y-8">
          <QuickActions
            tenantSlug={tenantSlug}
            horses={horses.map((horse) => ({
              id: horse.id,
              name: horse.name,
              status: horse.status,
              excludedFromFoodChain: horse.excludedFromFoodChain,
              weightKg: horse.weightKg,
            }))}
            assignees={assignees}
            canRecordHealth={canRecordHealth}
          />
          <HeatCard heat={heat} tenantSlug={tenantSlug} collapseWhenNormal />
          <SessionCheckIn sessions={pendingCheckIns} />
        </div>
      </div>
    </div>
  );
}
