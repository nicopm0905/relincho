import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

/**
 * La pantalla real de la demo justo debajo de la portada: quien llega quiere
 * ver el producto antes de leer la lista de modulos.
 */
export async function Showcase() {
  const t = await getTranslations("marketing.showcase");

  return (
    <section className="relative bg-[#141a0c] pb-20 md:pb-28">
      {/* El degradado inferior lleva del verde oscuro del hero al crema del
          resto de la pagina sin un corte seco. */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background" />

      <div className="relative container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 flex flex-col gap-4 text-white md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-bold tracking-[0.2em] text-[#c5d86d] uppercase">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 font-heading text-3xl text-balance sm:text-4xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/85 transition-colors hover:text-white"
          >
            {t("link")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <figure className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)]">
          <div className="flex items-center gap-2 border-b border-border/70 bg-muted/70 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ec6a5e]" />
            <span className="h-3 w-3 rounded-full bg-[#f4bf4f]" />
            <span className="h-3 w-3 rounded-full bg-[#61c554]" />
            <span className="ml-3 truncate rounded-md bg-card px-3 py-1 text-xs text-muted-foreground">
              relincho.vercel.app/yeguada-demo-andalucia/inicio
            </span>
          </div>
          <Image
            src="/landing/app-inicio.jpg"
            alt={t("alt")}
            width={1800}
            height={649}
            sizes="(min-width: 1152px) 1104px, 100vw"
            className="h-auto w-full"
          />
          <figcaption className="sr-only">{t("alt")}</figcaption>
        </figure>
      </div>
    </section>
  );
}
