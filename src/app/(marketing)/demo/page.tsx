import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth";
import { DEMO_TENANT_SLUG } from "@/lib/demo";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  Baby,
  Check,
  ClipboardList,
  Eye,
  HeartPulse,
  Layers,
  Receipt,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.demo");
  return { title: t("title") };
}

/** Capturas reales de la yeguada demo (pack de prensa), en el orden del tour. */
const tour = [
  { icon: Activity, src: "/prensa/01-inicio-resumen.png" },
  { icon: HeartPulse, src: "/prensa/03-sanidad.png" },
  { icon: Baby, src: "/prensa/04-reproduccion.png" },
  { icon: Layers, src: "/prensa/05-pupilaje.png" },
  { icon: Receipt, src: "/prensa/06-facturacion.png" },
  { icon: ClipboardList, src: "/prensa/07-ficha-caballo.png" },
] as const;

export default async function DemoPage() {
  const session = await auth();
  const t = await getTranslations("demo");
  const sales = await getTranslations("legal.contact.sales");

  const points = t.raw("performance.points") as string[];
  const items = t.raw("tour.items") as { title: string; description: string }[];
  const salesHref = `mailto:${sales("email")}?subject=${encodeURIComponent(
    sales("emailSubject"),
  )}`;

  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-primary/20">
      <Header session={session} />

      <main className="flex-1">
        {/* Portada */}
        <section className="container mx-auto max-w-5xl px-4 pt-32 pb-16 sm:px-6 md:pt-40 md:pb-24">
          <span className="inline-flex items-center rounded-full border border-border/50 bg-[#f9f9f6] px-3 py-1 text-[11px] font-bold tracking-wider text-primary-ink uppercase">
            {t("badge")}
          </span>
          <h1 className="mt-6 font-heading text-4xl leading-tight text-foreground text-balance sm:text-5xl md:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-13 rounded-full px-8 text-base shadow-[0_4px_14px_0_rgba(163,184,70,0.35)] sm:h-14"
            >
              <Link href="/login">
                {t("ctaPrimary")} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-13 rounded-full px-8 text-base sm:h-14"
            >
              <a href={salesHref}>{t("ctaSecondary")}</a>
            </Button>
            {/* La yeguada demo esta abierta en solo lectura: se puede entrar sin
                cuenta, que es justo lo que promete el QR del flyer. */}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-13 rounded-full px-8 text-base sm:h-14"
            >
              <Link href={`/${DEMO_TENANT_SLUG}/rendimiento`}>
                <Eye className="h-4 w-4" /> {t("tryNow")}
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-[13px] font-medium text-muted-foreground">
            {t("ctaNote")}
          </p>
        </section>

        {/* La franja de rendimiento: el diferencial */}
        <section className="bg-[#0b0d08] py-20 md:py-28">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
              {t("performance.eyebrow")}
            </p>
            <h2 className="mt-4 font-heading text-3xl text-white text-balance sm:text-4xl md:text-5xl">
              {t("performance.title")}
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-white/70">
              {t("performance.body")}
            </p>

            <ul className="mt-10 grid gap-5 sm:grid-cols-3">
              {points.map((point) => (
                <li
                  key={point}
                  className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <p className="mt-4 text-[15px] leading-relaxed text-white/80">
                    {point}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-2 rounded-[1.5rem] border border-primary/30 bg-primary/10 p-6 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 shrink-0 text-primary" />
                <h3 className="font-heading text-xl text-white">
                  {t("performance.checkIn.title")}
                </h3>
              </div>
              <p className="text-[14.5px] leading-relaxed text-white/70">
                {t("performance.checkIn.body")}
              </p>
            </div>
          </div>
        </section>

        {/* Recorrido por el resto de módulos */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 max-w-2xl md:mb-16">
              <h2 className="font-heading text-3xl text-foreground sm:text-4xl">
                {t("tour.title")}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t("tour.subtitle")}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tour.map(({ icon: Icon, src }, index) => {
                const item = items[index];
                if (!item) return null;
                return (
                  <article
                    key={src}
                    className="flex flex-col overflow-hidden rounded-[1.75rem] border border-border/50 bg-[#f9f9f6] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/50 bg-white">
                      <Image
                        src={src}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1024px) 30rem, (min-width: 640px) 45vw, 90vw"
                        className="object-cover object-top"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" strokeWidth={2.2} />
                        <h3 className="font-heading text-lg font-bold text-foreground">
                          {item.title}
                        </h3>
                      </div>
                      <p className="text-[14px] leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Cierre */}
        <section className="pb-24 md:pb-32">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6">
            <div className="rounded-[2rem] bg-[#f9f9f6] p-8 sm:p-12">
              <h2 className="font-heading text-3xl text-foreground text-balance sm:text-4xl">
                {t("closing.title")}
              </h2>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                {t("closing.body")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-13 rounded-full px-8 text-base sm:h-14"
                >
                  <a href={salesHref}>{t("ctaSecondary")}</a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-13 rounded-full px-8 text-base sm:h-14"
                >
                  <Link href="/login">{t("ctaPrimary")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
