import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/ui/state-badge";
import { SectionHeading } from "@/components/layout/page-header";
import { gestation, GESTATION_DAYS, mareState } from "@/lib/reproduction";
import { mareStateTone } from "./horse-header";

type Covering = {
  date: Date;
  stallion: { name: string } | null;
  externalStallionName?: string | null;
  pregnancyChecks: { date: Date; result: string }[];
  foaling: unknown;
};

export type ReproTabCycle = { id: string; season: number; coverings: Covering[] };

/** The mare's breeding book: one card per season, newest first. */
export function ReproTab({
  tenantSlug,
  mareId,
  cycles,
}: {
  tenantSlug: string;
  mareId: string;
  cycles: ReproTabCycle[];
}) {
  const t = useTranslations("horseDetail.repro");
  const tState = useTranslations("horseDetail.mareState");
  const format = useFormatter();
  const date = (value: Date) => format.dateTime(value, { day: "numeric", month: "short", year: "numeric" });

  return (
    <section className="space-y-4">
      <SectionHeading
        title={t("title")}
        description={t("description")}
        action={
          <Button asChild>
            <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo?mareId=${mareId}`}>
              <Plus weight="bold" />
              {t("startCycle")}
            </Link>
          </Button>
        }
      />

      {cycles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-12 text-center text-body text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {cycles.map((cycle) => {
            const latest = cycle.coverings[0];
            const latestCheck = latest?.pregnancyChecks[0];
            const state = mareState(latest);
            const pregnant = state === "PREGNANT" || state === "TWINS";
            const g = pregnant && latest ? gestation(latest.date) : null;
            const stallion = latest?.stallion?.name ?? latest?.externalStallionName ?? t("unknownStallion");

            return (
              <li key={cycle.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-heading font-semibold text-foreground">
                        {t("season", { season: cycle.season })}
                      </h3>
                      <StateBadge tone={mareStateTone[state]}>{tState(state)}</StateBadge>
                    </div>
                    {latest ? (
                      <dl className="flex flex-wrap gap-x-8 gap-y-2">
                        <div>
                          <dt className="text-caption text-muted-foreground">{t("lastCover")}</dt>
                          <dd className="text-body font-medium text-foreground">{date(latest.date)}</dd>
                        </div>
                        <div>
                          <dt className="text-caption text-muted-foreground">{t("stallion")}</dt>
                          <dd className="text-body font-medium text-foreground">{stallion}</dd>
                        </div>
                        {latestCheck && (
                          <div>
                            <dt className="text-caption text-muted-foreground">{t("scan")}</dt>
                            <dd className="text-body font-medium text-foreground">{date(latestCheck.date)}</dd>
                          </div>
                        )}
                      </dl>
                    ) : (
                      <p className="text-label text-muted-foreground">{t("openCycle")}</p>
                    )}
                  </div>
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href={`/${tenantSlug}/reproduccion/${cycle.id}`}>{t("viewCycle")}</Link>
                  </Button>
                </div>

                {g && (
                  <div className="mt-4 rounded-xl bg-state-pregnant-soft p-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <span className="text-caption font-medium text-state-pregnant-ink">{t("gestation")}</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-title font-semibold tabular-nums text-foreground">{g.days}</span>
                          <span className="text-label text-muted-foreground">
                            {t("gestationOf", { days: GESTATION_DAYS })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-caption font-medium text-state-pregnant-ink">{t("expected")}</span>
                        <span className="text-body font-semibold text-foreground">{date(g.expected)}</span>
                      </div>
                    </div>
                    <div
                      className="mt-3 h-2 overflow-hidden rounded-full bg-card"
                      role="progressbar"
                      aria-label={t("progress")}
                      aria-valuenow={Math.round(g.percent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-state-pregnant" style={{ width: `${Math.min(100, g.percent)}%` }} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
