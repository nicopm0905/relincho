import Link from "next/link";
import { useTranslations } from "next-intl";
import { CaretRight, Warning } from "@phosphor-icons/react/dist/ssr";
import type { MareOverview } from "@/server/services/reproduction/overview";
import { PIPELINE_STAGES, nextAction, pipelineStage, type PipelineStage } from "@/lib/repro-board";
import { stateDotClass, type StateTone } from "@/components/ui/state-badge";
import { cn } from "@/lib/utils";
import { mareCycleHref, useMareSummary } from "./use-mare-summary";
import { useDueLabel } from "./use-due-label";

const stageTone: Record<PipelineStage, StateTone> = {
  empty: "empty",
  heat: "heat",
  covered: "covered",
  pregnant: "pregnant",
  foaled: "foaled",
};

/** Cards shown per column before the rest fold away. */
const VISIBLE = 5;

/** Within a stage, what needs looking at first goes on top. */
function sortStage(stage: PipelineStage, mares: MareOverview[]) {
  const byName = (a: MareOverview, b: MareOverview) => a.mare.name.localeCompare(b.mare.name);
  return [...mares].sort((a, b) => {
    if (stage === "pregnant") return (b.insight.gestation?.days ?? 0) - (a.insight.gestation?.days ?? 0);
    if (stage === "heat") return (b.insight.lastExam?.follicleMm ?? 0) - (a.insight.lastExam?.follicleMm ?? 0);
    const alerts = (m: MareOverview) => m.insight.alerts.filter((x) => x.level !== "info").length;
    return alerts(b) - alerts(a) || byName(a, b);
  });
}

function MareCard({ m, tenantSlug }: { m: MareOverview; tenantSlug: string }) {
  const t = useTranslations("repro");
  const summary = useMareSummary();
  const dueLabel = useDueLabel();
  const href = mareCycleHref(tenantSlug, m);
  const next = nextAction(m.insight.phase, m.insight.actions);
  const due = next?.window ? dueLabel(next.window.from, next.window.to, next.window.overdue) : null;
  const warnings = m.insight.alerts.filter((a) => a.level !== "info");
  const soon = m.insight.phase === "FOALING_SOON";

  return (
    <li
      className={cn(
        "rounded-xl border bg-card p-3 shadow-card",
        soon ? "border-state-danger/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={href} className="min-w-0 truncate text-body font-semibold text-foreground hover:text-primary-ink">
          {m.mare.name}
        </Link>
        {warnings.length > 0 && (
          <span
            title={warnings.map((w) => w.message).join("\n")}
            className="flex shrink-0 items-center gap-0.5 text-caption font-semibold text-state-alert-ink"
          >
            <Warning aria-hidden weight="fill" className="h-3.5 w-3.5 text-state-alert" />
            <span className="sr-only">{t("alerts.title")}:</span>
            {warnings.length}
          </span>
        )}
      </div>
      <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">{summary(m)}</p>
      {m.insight.gestation && (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-state-pregnant-soft"
          role="progressbar"
          aria-label={t("summary.pregnant")}
          aria-valuenow={Math.round(m.insight.gestation.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn("h-full rounded-full", soon ? "bg-state-danger" : "bg-state-pregnant")}
            style={{ width: `${Math.min(100, m.insight.gestation.percent)}%` }}
          />
        </div>
      )}
      {next && (
        <Link
          href={`${href}?accion=${next.action}`}
          aria-label={t("actionFor", { action: t(`action.${next.action}`), mare: m.mare.name })}
          className="mt-2.5 flex min-h-9 flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-lg bg-muted/70 px-2.5 py-1.5 text-caption font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary-ink"
        >
          {/* En columnas estrechas el plazo baja de línea: el verbo no se corta. */}
          <span>{t(`action.${next.action}`)}</span>
          <span
            className={cn(
              "ml-auto flex shrink-0 items-center gap-0.5",
              due?.tone === "overdue" && "text-state-alert-ink",
              due?.tone === "later" && "font-medium text-muted-foreground",
            )}
          >
            {due?.label}
            <CaretRight aria-hidden weight="bold" className="h-3 w-3" />
          </span>
        </Link>
      )}
    </li>
  );
}

/**
 * Where every mare is in the season, from open to foaled. Each card carries
 * the mare's next step as a button that opens the right form.
 */
export function ReproPipeline({ tracked, tenantSlug }: { tracked: MareOverview[]; tenantSlug: string }) {
  const t = useTranslations("repro");
  const columns = PIPELINE_STAGES.map((stage) => ({
    stage,
    mares: sortStage(
      stage,
      tracked.filter((m) => pipelineStage(m.insight.phase) === stage),
    ),
  }));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {columns.map(({ stage, mares }) => (
        <section
          key={stage}
          aria-labelledby={`stage-${stage}`}
          className="flex min-w-0 flex-col rounded-2xl bg-muted/50 p-2.5"
        >
          <header className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
            <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", stateDotClass(stageTone[stage]))} />
            <h3 id={`stage-${stage}`} className="min-w-0 truncate text-label font-semibold text-foreground">
              {t(`stages.${stage}`)}
            </h3>
            <span className="ml-auto font-serif text-heading font-medium tabular-nums text-foreground">
              {mares.length}
            </span>
          </header>
          {mares.length === 0 ? (
            <p className="px-1.5 pb-2 text-caption text-muted-foreground">{t("stageNone")}</p>
          ) : (
            <ul className="space-y-2">
              {mares.slice(0, VISIBLE).map((m) => (
                <MareCard key={m.mare.id} m={m} tenantSlug={tenantSlug} />
              ))}
              {mares.length > VISIBLE && (
                <li>
                  <details className="group">
                    <summary className="flex min-h-9 cursor-pointer list-none items-center justify-center rounded-lg text-caption font-semibold text-primary-ink hover:bg-card [&::-webkit-details-marker]:hidden">
                      {t("stageMore", { count: mares.length - VISIBLE })}
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {mares.slice(VISIBLE).map((m) => (
                        <MareCard key={m.mare.id} m={m} tenantSlug={tenantSlug} />
                      ))}
                    </ul>
                  </details>
                </li>
              )}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
