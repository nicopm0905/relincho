import Link from "next/link";
import { useTranslations } from "next-intl";
import { Baby, Heartbeat, Horse, Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { HorseImportDialog } from "@/components/horses/horse-import-dialog";

/**
 * Home for a farm with no horses yet. A dashboard of zeros explains nothing;
 * this says what the screen will show and offers the one step that gets there
 * fastest: importing the spreadsheet the farm already keeps.
 */
export function InicioEmpty({ tenantSlug }: { tenantSlug: string }) {
  const t = useTranslations("home.empty");
  const steps = [
    { icon: <Horse aria-hidden weight="duotone" />, label: t("stepHorses") },
    { icon: <Heartbeat aria-hidden weight="duotone" />, label: t("stepHealth") },
    { icon: <Baby aria-hidden weight="duotone" />, label: t("stepRepro") },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="space-y-5 p-6 sm:p-8">
        <div className="max-w-xl space-y-2">
          <h2 className="font-serif text-title font-medium text-foreground">{t("title")}</h2>
          <p className="text-body text-muted-foreground">{t("body")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HorseImportDialog triggerVariant="default" />
          <Button asChild variant="outline" size="lg">
            <Link href={`/${tenantSlug}/caballos/nuevo`}>
              <Plus weight="bold" />
              {t("add")}
            </Link>
          </Button>
        </div>
      </div>
      <ol
        aria-label={t("stepsLabel")}
        className="grid border-t border-border bg-muted/40 sm:grid-cols-3"
      >
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="flex items-center gap-3 border-border px-6 py-4 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-primary-ink shadow-card [&>svg]:h-4 [&>svg]:w-4">
              {step.icon}
            </span>
            <span className="text-label text-foreground">
              <span className="mr-1 font-semibold tabular-nums text-muted-foreground">{index + 1}.</span>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
