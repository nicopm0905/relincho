import Link from "next/link";
import { useTranslations } from "next-intl";
import { CaretRight, Sun } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

export type AttentionTone = "danger" | "alert" | "neutral";

export type AttentionItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  due: { label: string; tone: AttentionTone };
  /** Ya pasó su fecha: cuenta en el resumen de vencidos. */
  overdue?: boolean;
};

export type AttentionGroup = {
  key: string;
  title: string;
  icon: React.ReactNode;
  /** Where "view all" goes: the module the items come from. */
  href: string;
  items: AttentionItem[];
};

const VISIBLE_ITEMS = 4;

const toneText: Record<AttentionTone, string> = {
  danger: "font-semibold text-state-danger-ink",
  alert: "font-semibold text-state-alert-ink",
  neutral: "text-muted-foreground",
};

const toneChip: Record<AttentionTone, string> = {
  danger: "bg-state-danger-soft text-state-danger-ink",
  alert: "bg-state-alert-soft text-state-alert-ink",
  neutral: "bg-muted text-muted-foreground",
};

function groupTone(items: AttentionItem[]): AttentionTone {
  if (items.some((item) => item.due.tone === "danger")) return "danger";
  if (items.some((item) => item.due.tone === "alert")) return "alert";
  return "neutral";
}

/**
 * What needs doing, grouped by the job it belongs to. The count on each card
 * is readable at a glance; the rows say exactly what and when, and each one
 * opens the record it comes from.
 */
export function AttentionBoard({
  groups,
  summary,
}: {
  groups: AttentionGroup[];
  summary: string;
}) {
  const t = useTranslations("home.attention");
  const visible = groups.filter((group) => group.items.length > 0);

  return (
    <section aria-labelledby="attention-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="attention-heading" className="text-heading font-semibold text-foreground">
          {t("title")}
        </h2>
        {visible.length > 0 && (
          <p className="text-label text-muted-foreground">{summary}</p>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-state-ok-soft text-state-ok-ink">
            <Sun aria-hidden weight="duotone" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-body font-semibold text-foreground">{t("allClear")}</p>
            <p className="text-label text-muted-foreground">{t("allClearBody")}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((group) => {
            const tone = groupTone(group.items);
            const hidden = group.items.length - VISIBLE_ITEMS;
            return (
              <article
                key={group.key}
                aria-labelledby={`attention-${group.key}`}
                className="flex min-w-0 flex-col rounded-2xl border border-border bg-card shadow-card"
              >
                <header className="flex items-center gap-3 px-4 pt-4 pb-2 sm:px-5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&>svg]:h-[18px] [&>svg]:w-[18px]",
                      toneChip[tone],
                    )}
                  >
                    {group.icon}
                  </span>
                  <h3
                    id={`attention-${group.key}`}
                    className="min-w-0 flex-1 truncate text-body font-semibold text-foreground"
                  >
                    {group.title}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-label font-semibold tabular-nums",
                      toneChip[tone],
                    )}
                  >
                    {group.items.length}
                  </span>
                </header>
                <ul className="flex-1 divide-y divide-border/70 px-2 sm:px-3">
                  {group.items.slice(0, VISIBLE_ITEMS).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-primary/[0.05]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-medium text-foreground">
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span className="block truncate text-label text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                        <span className={cn("shrink-0 text-right text-label", toneText[item.due.tone])}>
                          {item.due.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <footer className="px-4 pt-1 pb-3 sm:px-5">
                  <Link
                    href={group.href}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md text-label font-semibold text-primary-ink hover:underline"
                  >
                    {hidden > 0 ? t("more", { count: hidden }) : t("viewAll")}
                    <CaretRight aria-hidden weight="bold" className="h-3 w-3" />
                  </Link>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
