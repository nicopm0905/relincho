import Link from "next/link";
import { useTranslations } from "next-intl";
import { FilePdf, Heartbeat, Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/layout/page-header";
import { ListRow, ListRows, RowIcon } from "@/components/ui/list-row";
import { cn } from "@/lib/utils";

export type HealthTabItem = {
  id: string;
  type: string;
  name: string;
  /** Días hasta el vencimiento: negativo si ya venció. */
  offset: number;
};

/** What is due for this horse, then everything that has happened to it. */
export function HealthTab({
  tenantSlug,
  horseId,
  horseName,
  pending,
  history,
}: {
  tenantSlug: string;
  horseId: string;
  horseName: string;
  pending: HealthTabItem[];
  history: React.ReactNode;
}) {
  const t = useTranslations("horseDetail.health");
  const tDue = useTranslations("home.due");
  const tType = useTranslations("home.healthTypes");
  const dueLabel = (offset: number) => {
    if (offset < 0) return tDue("overdue", { days: -offset });
    if (offset === 0) return tDue("today");
    if (offset === 1) return tDue("tomorrow");
    return tDue("inDays", { days: offset });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading
          title={t("pendingTitle")}
          description={t("pendingDescription")}
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="ghost" className="hidden md:inline-flex">
                <a href={`/api/horses/${horseId}/pdf-clinico`} target="_blank" rel="noreferrer">
                  <FilePdf weight="bold" />
                  {t("exportPdf")}
                </a>
              </Button>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href={`/${tenantSlug}/entrenamiento/nuevo?horseId=${horseId}`}>
                  <Plus weight="bold" />
                  {t("training")}
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/${tenantSlug}/sanidad/nuevo?horseId=${horseId}`}>
                  <Plus weight="bold" />
                  {t("record")}
                </Link>
              </Button>
            </div>
          }
        />
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-body text-muted-foreground">
            {t("none")}
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-card px-4 shadow-card">
            <ListRows>
              {pending.map((item) => (
                <ListRow
                  key={item.id}
                  leading={
                    <RowIcon tone={item.offset < 0 ? "alert" : "neutral"}>
                      <Heartbeat />
                    </RowIcon>
                  }
                  title={item.name}
                  subtitle={tType(item.type as "OTHER")}
                  meta={
                    <span className={cn(item.offset <= 0 && "font-semibold text-state-alert-ink")}>
                      {dueLabel(item.offset)}
                    </span>
                  }
                />
              ))}
            </ListRows>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading title={t("history")} description={t("historyDescription", { name: horseName })} />
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">{history}</div>
      </section>
    </div>
  );
}
