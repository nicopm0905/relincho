import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ReproNav } from "@/components/reproduction/board/repro-nav";
import { cn } from "@/lib/utils";
import type { RateRow } from "@/lib/repro-stats";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ temporada?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const [{ tenantSlug }, t] = await Promise.all([params, getTranslations("repro.stats")]);
  return { title: `${t("metaTitle")} — ${tenantSlug}` };
}

/** Barra de porcentaje con el valor escrito: el color nunca va solo. */
function RateBar({ value, label, muted }: { value: number | null; label: string; muted?: boolean }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className={cn("h-full rounded-full", muted ? "bg-state-empty" : "bg-state-pregnant")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-label font-semibold tabular-nums text-foreground">
        {value === null ? "—" : `${pct} %`}
      </span>
    </div>
  );
}

export default async function ReproStatsPage({ params, searchParams }: PageProps) {
  const [{ tenantSlug }, { temporada }, t, tKpi, format] = await Promise.all([
    params,
    searchParams,
    getTranslations("repro.stats"),
    getTranslations("repro.kpi"),
    getFormatter(),
  ]);
  const thisYear = new Date().getFullYear();
  const season = Number(temporada) >= 2000 && Number(temporada) <= 2100 ? Number(temporada) : thisYear;
  const caller = await createServerCaller(tenantSlug);
  const { current: s, previous: prev, seasons } = await caller.reproduction.stats({ season });
  const options = [...new Set([thisYear, ...seasons])].sort((a, b) => b - a);

  const pct = (v: number | null) => (v === null ? "—" : format.number(v, { style: "percent" }));
  const euros = (v: number) => format.number(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const decimal = (v: number | null) => (v === null ? "—" : format.number(v, { maximumFractionDigits: 1 }));
  const delta = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return undefined;
    const diff = Math.round(current * 100) - Math.round(previous * 100);
    // Las mismas frases que el panel: "+7 puntos frente a 2025".
    if (diff > 0) return tKpi("fertilityUp", { diff, previous: prev.season });
    if (diff < 0) return tKpi("fertilityDown", { diff, previous: prev.season });
    return tKpi("fertilitySame", { previous: prev.season });
  };

  const hasPrevious = prev.cyclesBred > 0;

  const rateTable = (title: string, rows: RateRow[]) => (
    <section className="space-y-3">
      <SectionHeading title={title} />
      {rows.length === 0 ? (
        <p className="text-body text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[480px] text-body">
            <thead className="border-b border-border text-left text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">
                  <span className="sr-only">{title}</span>
                </th>
                <th className="px-2 py-2.5 text-right font-medium">{t("mares")}</th>
                <th className="px-2 py-2.5 text-right font-medium">{t("cycles")}</th>
                <th className="px-2 py-2.5 text-right font-medium">{t("pregnant")}</th>
                <th className="w-[40%] px-4 py-2.5 font-medium">{t("rate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.label}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{r.mares}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{r.cycles}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{r.pregnantCycles}</td>
                  <td className="px-4 py-2.5">
                    <RateBar value={r.perCycleRate} label={t("rateOf", { label: r.label })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <ReproNav tenantSlug={tenantSlug} />

      <nav aria-label={t("seasons")} className="flex flex-wrap gap-2">
        {options.map((y) => (
          <Link
            key={y}
            href={`/${tenantSlug}/reproduccion/estadisticas?temporada=${y}`}
            aria-current={y === season ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3.5 text-label font-semibold tabular-nums transition-colors",
              y === season
                ? "border-transparent bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {y}
          </Link>
        ))}
      </nav>

      {s.maresBred === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-body text-muted-foreground">
          {t("empty", { season })}
        </p>
      ) : (
        <>
          {/* Las tres cifras que se defienden delante de un socio. */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            <StatCard
              prominent
              label={t("perCycle")}
              value={pct(s.perCycleRate)}
              hint={delta(s.perCycleRate, prev.perCycleRate) ?? t("ofCycles", { pregnant: s.pregnantCycles, cycles: s.cyclesBred })}
            />
            <StatCard
              prominent
              label={t("cost")}
              value={s.semenCostPerPregnancy === null ? "—" : euros(s.semenCostPerPregnancy)}
              hint={s.semenCostPerPregnancy === null ? t("costNone") : t("costTotal", { total: euros(s.semenCostTotal) })}
            />
            <StatCard
              prominent
              label={t("maresPregnant")}
              value={pct(s.seasonRate)}
              hint={delta(s.seasonRate, prev.seasonRate) ?? t("ofMares", { pregnant: s.maresPregnant, mares: s.maresBred })}
            />
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t("maresBred")} value={s.maresBred} hint={t("cyclesBred", { count: s.cyclesBred })} />
            <StatCard label={t("cyclesPerPregnancy")} value={decimal(s.cyclesPerPregnancy)} />
            {/* Los potros de una temporada nacen al año siguiente: en la temporada
                en curso un cero no dice nada malo, solo que aún no han nacido. */}
            <StatCard
              label={t("liveFoals")}
              value={s.season >= thisYear ? "—" : s.liveFoals}
              hint={
                s.season >= thisYear
                  ? t("liveFoalsPending", { year: s.season + 1 })
                  : t("liveFoalsHint", { rate: pct(s.liveFoalRate) })
              }
            />
            <StatCard
              label={t("losses")}
              value={pct(s.lossRate)}
              hint={t("lossesHint", { count: s.losses })}
              emphasis={(s.lossRate ?? 0) > 0.15}
            />
          </section>

          <section className="space-y-3">
            <SectionHeading title={t("compare", { season: s.season, previous: prev.season })} />
            {hasPrevious ? (
              <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-card md:grid-cols-3">
                {(
                  [
                    [t("perCycle"), s.perCycleRate, prev.perCycleRate],
                    [t("maresPregnant"), s.seasonRate, prev.seasonRate],
                    [t("losses"), s.lossRate, prev.lossRate],
                  ] as const
                ).map(([label, now, before]) => (
                  <div key={label} className="space-y-2">
                    <p className="text-label font-semibold text-foreground">{label}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-caption tabular-nums text-muted-foreground">{s.season}</span>
                        <div className="flex-1">
                          <RateBar value={now} label={`${label} ${s.season}`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-caption tabular-nums text-muted-foreground">{prev.season}</span>
                        <div className="flex-1">
                          <RateBar value={before} label={`${label} ${prev.season}`} muted />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body text-muted-foreground">{t("compareNone")}</p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {rateTable(t("byStallion"), s.byStallion)}
            {rateTable(t("byMethod"), s.byMethod)}
          </div>

          <p className="text-caption text-muted-foreground">{t("footnote")}</p>
        </>
      )}
    </div>
  );
}
