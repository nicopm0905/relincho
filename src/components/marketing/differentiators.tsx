import { getTranslations } from "next-intl/server";
import { ClipboardCheck, FileText, HeartPulse } from "lucide-react";

/**
 * Lo que solo hace Relincho, justo debajo de la portada. La lista de módulos
 * (sanidad, reproducción...) la tiene cualquiera; esto es lo que hace que un
 * ganadero diga "esto no lo había visto".
 */
const items = [
  { key: "readiness", icon: HeartPulse },
  { key: "treatments", icon: ClipboardCheck },
  { key: "ancce", icon: FileText },
] as const;

export async function Differentiators() {
  const t = await getTranslations("marketing.differentiators");

  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-2xl md:mb-14">
          <p className="text-xs font-bold tracking-[0.2em] text-primary-ink uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 font-heading text-3xl text-foreground text-balance sm:text-4xl md:text-5xl">
            {t("title")}
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3 md:gap-6">
          {items.map((item) => (
            <article
              key={item.key}
              className="flex flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-bento sm:p-7"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary-ink">
                <item.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <p className="mt-5 text-[11px] font-bold tracking-wider text-primary-ink uppercase">
                {t(`items.${item.key}.tag`)}
              </p>
              <h3 className="mt-1.5 font-heading text-xl font-bold text-foreground sm:text-2xl">
                {t(`items.${item.key}.title`)}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {t(`items.${item.key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
