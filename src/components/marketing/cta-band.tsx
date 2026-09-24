import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cierre de la pagina: ultima invitacion a abrir la demo antes del pie. */
export async function CtaBand() {
  const t = await getTranslations("marketing.cta");

  return (
    <section className="relative isolate overflow-hidden bg-[#141a0c] py-24 text-white md:py-32">
      <Image
        src="/landing/cta.jpg"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover object-[50%_60%]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#141a0c]/85 via-[#141a0c]/55 to-[#141a0c]/20" />

      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-xl">
          <h2 className="font-heading text-3xl text-balance sm:text-4xl md:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-lg text-white/80">{t("subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="h-12 bg-[#c5d86d] px-8 text-base text-[#1c2114] hover:bg-[#d4e384] sm:h-14"
            >
              <Link href="/demo">
                {t("primary")} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-12 border-white/30 bg-white/5 px-8 text-base text-white backdrop-blur-sm hover:bg-white/15 hover:text-white sm:h-14"
            >
              <Link href="/contacto">{t("secondary")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
