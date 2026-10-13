import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { MareOverview } from "@/server/services/reproduction/overview";
import { cn } from "@/lib/utils";
import { mareCycleHref } from "./use-mare-summary";

const DAY = 24 * 60 * 60 * 1000;
/** Dos semanas atrás y diez por delante. */
const PAST_DAYS = 14;
const SPAN_DAYS = 84;

type Kind = "estrus" | "breeding" | "scan" | "foalHeat" | "foaling";
type Bar = { kind: Kind; from: Date; to: Date; label: string };

/** Cada franja con su tono de estado: el mismo que el pipeline y las fichas. */
const barClass: Record<Kind, string> = {
  estrus: "bg-state-heat/40",
  breeding: "bg-state-heat",
  scan: "bg-state-covered",
  foalHeat: "bg-state-foaled/70",
  foaling: "bg-state-danger/70",
};

function bars(m: MareOverview, scanLabel: (label: string) => string): { bars: Bar[]; ovulations: Date[] } {
  const i = m.insight;
  const d = (x: Date | string) => new Date(x);
  const list: Bar[] = [];
  if (i.gestation) list.push({ kind: "foaling", from: d(i.gestation.windowFrom), to: d(i.gestation.windowTo), label: "" });
  if (i.nextEstrus) list.push({ kind: "estrus", from: d(i.nextEstrus.estrusFrom), to: d(i.nextEstrus.estrusTo), label: "" });
  if (i.foalHeat) list.push({ kind: "foalHeat", from: d(i.foalHeat.from), to: d(i.foalHeat.to), label: "" });
  if (i.breeding) list.push({ kind: "breeding", from: d(i.breeding.from), to: d(i.breeding.to), label: "" });
  if (i.nextCheck) list.push({ kind: "scan", from: d(i.nextCheck.due), to: d(i.nextCheck.limit), label: scanLabel(i.nextCheck.label) });
  const ovulations = [i.ovulation?.expected, i.nextEstrus?.ovulation].filter(Boolean).map((x) => d(x!));
  return { bars: list, ovulations };
}

/** Twelve weeks of predicted heats, scans and foaling windows, one row per mare. */
export function ReproCalendar({ tracked, tenantSlug }: { tracked: MareOverview[]; tenantSlug: string }) {
  const t = useTranslations("repro.calendar");
  const format = useFormatter();
  const day = (value: Date) => format.dateTime(value, { day: "numeric", month: "short" });

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setTime(start.getTime() - PAST_DAYS * DAY);
  const end = new Date(start.getTime() + SPAN_DAYS * DAY);
  const pct = (date: Date) =>
    Math.min(100, Math.max(0, ((date.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100));
  const weeks = Array.from({ length: SPAN_DAYS / 7 }, (_, k) => new Date(start.getTime() + k * 7 * DAY));
  const todayPct = pct(new Date());
  const legend: Kind[] = ["estrus", "breeding", "scan", "foalHeat", "foaling"];

  return (
    <figure aria-label={t("label")} className="space-y-3">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-muted-foreground">
        {legend.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("h-2.5 w-4 rounded-sm", barClass[kind])} /> {t(kind)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-state-heat-ink" /> {t("ovulation")}
        </span>
      </figcaption>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[160px_1fr] border-b border-border text-caption text-muted-foreground">
            <div className="px-3 py-2">{t("mare")}</div>
            <div className="relative h-8">
              {weeks.map((w) => (
                <span
                  key={w.toISOString()}
                  className="absolute top-2 -translate-x-1/2 whitespace-nowrap tabular-nums"
                  style={{ left: `${pct(w)}%` }}
                >
                  {day(w)}
                </span>
              ))}
            </div>
          </div>
          {tracked.map((m) => {
            const { bars: list, ovulations } = bars(m, (label) => label);
            return (
              <div key={m.mare.id} className="grid grid-cols-[160px_1fr] border-b border-border last:border-b-0">
                <Link
                  href={mareCycleHref(tenantSlug, m)}
                  className="truncate px-3 py-3 text-label font-medium text-foreground hover:text-primary-ink"
                >
                  {m.mare.name}
                </Link>
                <div className="relative h-11">
                  {weeks.map((w) => (
                    <span key={w.toISOString()} aria-hidden className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${pct(w)}%` }} />
                  ))}
                  <span aria-hidden className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${todayPct}%` }} />
                  {list
                    .filter((b) => b.to > start && b.from < end)
                    .map((b) => (
                      <span
                        key={`${b.kind}-${+b.from}`}
                        title={`${b.label || t(b.kind)}: ${day(b.from)} – ${day(b.to)}`}
                        className={cn("absolute top-3.5 h-4 rounded", barClass[b.kind])}
                        style={{ left: `${pct(b.from)}%`, width: `${Math.max(0.8, pct(b.to) - pct(b.from))}%` }}
                      />
                    ))}
                  {ovulations
                    .filter((at) => at > start && at < end)
                    .map((at) => (
                      <span
                        key={+at}
                        title={`${t("ovulation")}: ${day(at)}`}
                        className="absolute top-[18px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-state-heat-ink ring-2 ring-card"
                        style={{ left: `${pct(at)}%` }}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </figure>
  );
}
