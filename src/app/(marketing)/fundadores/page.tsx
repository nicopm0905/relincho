import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Heart, Target, Users } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.founders");
  return { title: t("title") };
}

const values = [
  { key: "local", icon: Heart },
  { key: "tech", icon: Target },
  { key: "welfare", icon: Users },
] as const;

export default async function FundadoresPage() {
  const session = await auth();
  const t = await getTranslations("founders");
  const about = await getTranslations("marketing.about");
  const sales = await getTranslations("legal.contact.sales");

  const salesHref = `mailto:${sales("email")}?subject=${encodeURIComponent(
    sales("emailSubject"),
  )}`;

  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-primary/20">
      <Header session={session} />

      <main className="flex-1">
        {/* Portada */}
        <section className="container mx-auto max-w-5xl px-4 pt-32 pb-16 sm:px-6 md:pt-40 md:pb-20">
          <span className="inline-flex items-center rounded-full border border-border/50 bg-[#f9f9f6] px-3 py-1 text-[11px] font-bold tracking-wider text-primary-ink uppercase">
            {t("badge")}
          </span>
          <h1 className="mt-6 font-heading text-4xl leading-tight text-foreground text-balance sm:text-5xl md:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </section>

        {/* Historia */}
        <section className="container mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:pb-28">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-6 text-lg text-muted-foreground">
              <p>{t("story1")}</p>
              <p>{t("story2")}</p>
              <p>{t("story3")}</p>
            </div>

            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[2rem] border border-border/50 bg-[#f9f9f6] p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <div className="relative z-10 text-center">
                <span className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-white shadow-xl">
                  <Image
                    src="/logo.png"
                    alt="Relincho"
                    fill
                    sizes="6rem"
                    className="object-contain p-4"
                  />
                </span>
                <h2 className="font-heading text-2xl text-foreground">
                  {about("cardTitle")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {about("cardSubtitle")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* El diferencial */}
        <section className="bg-[#0b0d08] py-20 md:py-28">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
              <Activity className="h-5 w-5 text-primary" />
            </span>
            <h2 className="mt-6 font-heading text-3xl text-white text-balance sm:text-4xl md:text-5xl">
              {t("whyTitle")}
            </h2>
            <p className="mt-5 max-w-3xl text-lg text-white/70">
              {t("whyBody")}
            </p>
            <div className="mt-8">
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-full border-white/20 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/demo">
                  {t("ctaPrimary")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Valores */}
        <section className="container mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="mb-12 text-center font-heading text-3xl text-foreground sm:text-4xl">
            {t("valuesTitle")}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.key}
                className="rounded-[2rem] bg-[#f9f9f6] p-8 text-center transition-all duration-300 hover:-translate-y-2 hover:shadow-lg"
              >
                <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border/50 bg-white text-foreground shadow-sm">
                  <value.icon strokeWidth={2} className="h-7 w-7" />
                </span>
                <h3 className="mb-4 font-heading text-xl font-bold text-foreground">
                  {about(`values.${value.key}.title`)}
                </h3>
                <p className="text-muted-foreground">
                  {about(`values.${value.key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Cierre */}
        <section className="pb-24 md:pb-32">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6">
            <div className="rounded-[2rem] border border-border/50 bg-[#f9f9f6] p-8 sm:p-12">
              <h2 className="font-heading text-3xl text-foreground sm:text-4xl">
                {t("ctaTitle")}
              </h2>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                {t("ctaBody")}
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
                  <Link href="/demo">{t("ctaPrimary")}</Link>
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
