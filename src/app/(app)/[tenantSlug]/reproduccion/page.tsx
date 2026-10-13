import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Egg, Plus } from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { calendarDayOffset } from "@/lib/day-window";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StartSeasonButton } from "@/components/reproduction/start-season-button";
import { ReproNav } from "@/components/reproduction/board/repro-nav";
import { ReproViews } from "@/components/reproduction/board/repro-views";
import { ReproPipeline } from "@/components/reproduction/board/repro-pipeline";
import { ReproCalendar } from "@/components/reproduction/board/repro-calendar";
import { ReproAgenda, ReproAlerts } from "@/components/reproduction/board/repro-agenda";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

/** Ventana de "partos próximos" del KPI. */
const FOALING_DAYS = 60;

export async function generateMetadata({ params }: PageProps) {
  const [{ tenantSlug }, t] = await Promise.all([params, getTranslations("repro")]);
  return { title: `${t("metaTitle")} — ${tenantSlug}` };
}

export default async function ReproductionPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const [caller, t, format] = await Promise.all([
    createServerCaller(tenantSlug),
    getTranslations("repro"),
    getFormatter(),
  ]);
  const { tracked, untracked, season } = await caller.reproduction.overview({});
  const { current, previous } = await caller.reproduction.stats({ season });
  const now = new Date();
  const euros = (value: number) =>
    format.number(value, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const day = (value: Date) => format.dateTime(value, { day: "numeric", month: "short" });

  // ── KPIs como argumento de negocio ───────────────────────────────────────
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
  const foalings = tracked
    .filter((m) => m.insight.gestation)
    .map((m) => ({ name: m.mare.name, expected: new Date(m.insight.gestation!.expected) }))
    .filter((g) => calendarDayOffset(g.expected, now) <= FOALING_DAYS)
    .sort((a, b) => +a.expected - +b.expected);
  const nextFoaling = foalings.find((g) => calendarDayOffset(g.expected, now) >= 0);

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title={t("title")}
        description={t("description", { season, count: tracked.length })}
        actions={
          <Button asChild variant="outline">
            <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo`}>
              <Plus weight="bold" />
              {t("newSeason")}
            </Link>
          </Button>
        }
      />
      <ReproNav tenantSlug={tenantSlug} />

      {untracked.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-label text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t("untracked", { count: untracked.length, season })}
            </span>
            {": "}
            {untracked
              .slice(0, 6)
              .map((m) => m.name)
              .join(", ")}
            {untracked.length > 6 ? "…" : ""}
          </p>
          <StartSeasonButton season={season} count={untracked.length} />
        </div>
      )}

      {tracked.length === 0 ? (
        <EmptyState
          icon={<Egg />}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            <Button asChild size="lg">
              <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo`}>
                <Plus weight="bold" />
                {t("empty.action")}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label={t("title")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            <StatCard
              prominent
              label={t("kpi.fertility", { season })}
              value={current.perCycleRate === null ? "—" : format.number(current.perCycleRate, { style: "percent" })}
              hint={fertilityHint}
              href={`/${tenantSlug}/reproduccion/estadisticas`}
            />
            <StatCard
              prominent
              label={t("kpi.cost")}
              value={current.semenCostPerPregnancy === null ? "—" : euros(current.semenCostPerPregnancy)}
              hint={
                current.semenCostPerPregnancy === null
                  ? t("kpi.costNone")
                  : t("kpi.costHint", { total: euros(current.semenCostTotal) })
              }
              href={`/${tenantSlug}/reproduccion/estadisticas`}
            />
            <StatCard
              prominent
              label={t("kpi.foalings")}
              value={foalings.length}
              hint={
                nextFoaling
                  ? t("kpi.foalingsNext", { name: nextFoaling.name, date: day(nextFoaling.expected) })
                  : t("kpi.foalingsNone")
              }
            />
          </section>

          <ReproViews
            board={<ReproPipeline tracked={tracked} tenantSlug={tenantSlug} />}
            calendar={<ReproCalendar tracked={tracked} tenantSlug={tenantSlug} />}
          />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ReproAgenda tracked={tracked} tenantSlug={tenantSlug} />
            <ReproAlerts tracked={tracked} tenantSlug={tenantSlug} />
          </div>
        </>
      )}
    </div>
  );
}
