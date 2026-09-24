import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Baby, Receipt, Layers, HeartPulse, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cada modulo con su foto. Componente de servidor y sin animacion de entrada:
 * se llega aqui desde /#features y el contenido tiene que estar visible desde
 * el primer pintado, no cuando termine de hidratarse una libreria.
 */
const features = [
  { key: "health", icon: HeartPulse, image: "/landing/sanidad.jpg", span: "md:col-span-2", position: "object-[50%_30%]" },
  { key: "reproduction", icon: Baby, image: "/landing/reproduccion.jpg", span: "", position: "object-center" },
  { key: "performance", icon: Activity, image: "/landing/rendimiento.jpg", span: "", position: "object-center" },
  { key: "boarding", icon: Layers, image: "/landing/pupilaje.jpg", span: "", position: "object-center" },
  { key: "invoicing", icon: Receipt, image: "/landing/facturacion.jpg", span: "", position: "object-[50%_40%]" },
] as const;

export async function Features() {
  const t = await getTranslations("marketing.features");

  return (
    <section id="features" className="bg-background py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 max-w-2xl md:mb-16">
          <p className="text-xs font-bold tracking-[0.2em] text-primary-ink uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 mb-5 font-heading text-3xl text-foreground text-balance sm:text-4xl md:text-5xl">
            {t("title")}
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
          {features.map((feature) => (
            <article
              key={feature.key}
              className={cn(
                "group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-bento transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-raised",
                feature.span,
                feature.span && "sm:col-span-2",
              )}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-muted md:aspect-auto md:h-60">
                <Image
                  src={feature.image}
                  alt=""
                  fill
                  sizes={
                    feature.span
                      ? "(min-width: 768px) 740px, 100vw"
                      : "(min-width: 768px) 370px, (min-width: 640px) 50vw, 100vw"
                  }
                  className={cn(
                    "object-cover transition-transform duration-700 group-hover:scale-105",
                    feature.position,
                  )}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-[#1c2114] shadow-sm backdrop-blur">
                  <feature.icon strokeWidth={2} className="h-5 w-5" />
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-6 sm:p-7">
                <h3 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                  {t(`items.${feature.key}.title`)}
                </h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  {t(`items.${feature.key}.description`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
