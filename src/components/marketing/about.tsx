import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Users, Target, Heart, ArrowRight, MapPin } from "lucide-react";

const values = [
  { key: "local", icon: Heart },
  { key: "tech", icon: Target },
  { key: "welfare", icon: Users },
] as const;

export async function About() {
  const t = await getTranslations("marketing.about");
  const strong = (chunks: React.ReactNode) => <strong className="font-semibold text-foreground">{chunks}</strong>;

  return (
    <section id="nosotros" className="bg-[#eef1e6] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-raised sm:aspect-[4/3] lg:aspect-[4/5]">
              <Image
                src="/landing/nosotros.jpg"
                alt=""
                fill
                sizes="(min-width: 1024px) 540px, 100vw"
                className="object-cover"
              />
            </div>
            {/* Tarjeta flotante con el origen: sustituye al icono generico. */}
            <div className="absolute -bottom-6 left-6 flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-raised sm:left-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary-ink">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <p className="font-heading text-lg leading-tight font-bold text-foreground">
                  {t("cardTitle")}
                </p>
                <p className="text-sm text-muted-foreground">{t("cardSubtitle")}</p>
              </div>
            </div>
          </div>

          <div className="pt-6 lg:pt-0">
            <p className="text-xs font-bold tracking-[0.2em] text-primary-ink uppercase">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 mb-4 font-heading text-3xl text-foreground sm:text-4xl md:text-5xl">
              {t("title")}
            </h2>
            <p className="mb-6 text-lg font-semibold text-foreground">{t("subtitle")}</p>
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              <p>{t("p1")}</p>
              <p>{t.rich("p2", { strong })}</p>
              <p>{t.rich("p3", { strong })}</p>
            </div>
            <Link
              href="/fundadores"
              className="mt-6 inline-flex items-center gap-1.5 text-base font-semibold text-primary-ink transition-colors hover:text-primary"
            >
              {t("readMore")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 border-t border-[#d6ddcd] pt-12 sm:grid-cols-3 md:mt-24">
          {values.map((value) => (
            <div key={value.key} className="flex gap-4">
              <value.icon strokeWidth={2} className="mt-1 h-5 w-5 shrink-0 text-primary-ink" />
              <div>
                <h3 className="mb-2 font-heading text-lg font-bold text-foreground">
                  {t(`values.${value.key}.title`)}
                </h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  {t(`values.${value.key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
