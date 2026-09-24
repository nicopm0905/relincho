import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

/**
 * Portada de la web. Componente de servidor y animacion solo CSS: el titular
 * es el elemento grande de la pagina (LCP) y no debe esperar a que se hidrate
 * ninguna libreria de animacion para aparecer.
 */
export async function Hero() {
  const t = await getTranslations("marketing.hero");
  const trust = t.raw("trust") as string[];

  return (
    <section className="relative isolate flex min-h-[92svh] items-end overflow-hidden bg-[#141a0c] text-white">
      <Image
        src="/landing/hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[60%_45%]"
      />
      {/* Oscurece la parte baja y la izquierda, donde va el texto, sin apagar
          la luz del atardecer arriba a la derecha. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#141a0c] via-[#141a0c]/30 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#141a0c]/65 via-[#141a0c]/10 to-transparent" />

      <div className="container mx-auto max-w-6xl px-4 pt-36 pb-20 sm:px-6 md:pb-28">
        <div className="animate-in fade-in-0 slide-in-from-bottom-4 max-w-2xl duration-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-md">
            <span className="rounded-full bg-[#c5d86d] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#1c2114] uppercase">
              {t("badgeNew")}
            </span>
            {t("badgeFeature")}
          </span>

          <h1 className="mt-6 font-heading text-[2.75rem] leading-[1.02] tracking-tight text-balance sm:text-6xl md:text-7xl">
            {t("titleLead")}{" "}
            <em className="text-[#d9e79a] not-italic">{t("titleHighlight")}</em>{" "}
            {t("titleTail")}
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg md:text-xl">
            {t("subtitle")}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              asChild
              className="h-12 bg-[#c5d86d] px-8 text-base text-[#1c2114] shadow-raised hover:bg-[#d4e384] sm:h-14"
            >
              {/* Ver la demo antes de pedir cuenta: el visitante del QR viene a
                  comprobar que existe lo que le contaron. */}
              <Link href="/demo">
                {t("ctaPrimary")} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-12 border-white/30 bg-white/5 px-8 text-base text-white backdrop-blur-sm hover:bg-white/15 hover:text-white sm:h-14"
            >
              <Link href="/#features">{t("ctaSecondary")}</Link>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
            {trust.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#c5d86d]" strokeWidth={2.5} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
