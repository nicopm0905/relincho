import { useTranslations } from "next-intl";
import { SectionHeading } from "@/components/layout/page-header";
import { ListRow, ListRows, RowIcon } from "@/components/ui/list-row";

export type ActivityEntry = {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  when: string;
  href: string;
};

/** What happened lately, quietly: context, not something to act on. */
export function RecentActivity({ entries }: { entries: ActivityEntry[] }) {
  const t = useTranslations("home.activity");
  return (
    <section aria-labelledby="activity-heading" className="space-y-2">
      <SectionHeading id="activity-heading" title={t("title")} />
      {entries.length === 0 ? (
        <p className="py-6 text-label text-muted-foreground">{t("empty")}</p>
      ) : (
        <ListRows>
          {entries.map((entry) => (
            <ListRow
              key={entry.id}
              href={entry.href}
              leading={<RowIcon>{entry.icon}</RowIcon>}
              title={entry.title}
              subtitle={entry.subtitle}
              meta={<span className="tabular-nums">{entry.when}</span>}
            />
          ))}
        </ListRows>
      )}
    </section>
  );
}
