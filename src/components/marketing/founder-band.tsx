import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { FOUNDER, isFounderOfferOpen } from "@/lib/pricing";

/**
 * Franja de socios fundadores en la portada. El flyer, el QR y la publicación
 * de Jerez Ciudad del Caballo traen aquí, no a /precios: la oferta tiene que
 * verse sin buscarla. El detalle (calculadora) sigue en /precios.
 */
export async function FounderBand() {
  let taken: number | null = null;
  try {
    taken = await prisma.tenant.count({ where: { founder: true } });
  } catch {
    // Sin base de datos (build) la franja sale sin contador.
  }
  if (!isFounderOfferOpen(taken ?? 0)) return null;

  const t = await getTranslations("marketing.founderBand");
  const left = taken === null ? null : Math.max(0, FOUNDER.slots - taken);

  return (
    <section className="bg-background pt-6 pb-2 md:pt-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-5 rounded-[2rem] border-2 border-primary bg-[#f9f9f6] p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[11px] font-bold tracking-wider text-primary-foreground uppercase">
              {t("badge")}
            </span>
            <h2 className="mt-3 font-heading text-2xl text-foreground text-balance md:text-3xl">
              {t("title")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("body", { slots: FOUNDER.slots })}
              {left !== null && (
                <span className="ml-1 font-semibold text-primary-ink">
                  {t("left", { n: left })}.
                </span>
              )}
            </p>
          </div>
          <Link
            href="/precios"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-raised transition-colors hover:bg-primary/90"
          >
            {t("cta")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
