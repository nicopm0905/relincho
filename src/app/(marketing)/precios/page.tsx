import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import {
  ADDONS,
  FOUNDER,
  formatEuro,
  isFounderOfferOpen,
  qrPrintPrice,
} from "@/lib/pricing";

/** Las plazas de fundador cambian poco: cinco minutos de caché bastan. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.pricing");
  return { title: t("title") };
}

/**
 * Plazas de fundador ocupadas. Si la base de datos no responde (por ejemplo en
 * el build) se devuelve null y la franja se muestra sin contador, en vez de
 * romper la página de precios.
 */
async function founderSpotsTaken(): Promise<number | null> {
  try {
    return await prisma.tenant.count({ where: { founder: true } });
  } catch {
    return null;
  }
}

export default async function PreciosPage() {
  const session = await auth();
  const t = await getTranslations("marketing.pricing");
  const sales = await getTranslations("legal.contact.sales");

  const salesHref = `mailto:${sales("email")}?subject=${encodeURIComponent(
    sales("emailSubject"),
  )}`;

  const taken = await founderSpotsTaken();
  const founderOpen = isFounderOfferOpen(taken ?? 0);
  const spotsLeft = taken === null ? null : Math.max(0, FOUNDER.slots - taken);

  const addons = [
    {
      key: "billing",
      price: t("addons.billing.price", { price: formatEuro(ADDONS.billing.monthly) }),
    },
    {
      key: "extraHorses",
      price: t("addons.extraHorses.price", {
        price: formatEuro(ADDONS.extraHorses.monthly),
      }),
    },
    {
      key: "migration",
      price: t("addons.migration.price", { price: formatEuro(ADDONS.migration.oneTime) }),
    },
    {
      key: "qr",
      price: t("addons.qr.price", { price: formatEuro(qrPrintPrice(1)) }),
    },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-primary/20">
      <Header session={session} />

      <main className="flex-1">
        <section className="container mx-auto max-w-4xl px-4 pt-32 pb-10 text-center sm:px-6 md:pt-40">
          <h1 className="font-heading text-4xl leading-tight text-foreground text-balance sm:text-5xl md:text-6xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </section>

        {founderOpen && (
          <section className="container mx-auto max-w-4xl px-4 pb-10 sm:px-6">
            <div className="rounded-[2rem] border-2 border-primary bg-[#f9f9f6] p-6 text-center md:p-8">
              <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[11px] font-bold tracking-wider text-primary-foreground uppercase">
                {t("founder.badge")}
              </span>
              <h2 className="mt-4 font-heading text-2xl text-foreground md:text-3xl">
                {t("founder.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                {t("founder.body", { slots: FOUNDER.slots })}
              </p>
              {spotsLeft !== null && (
                <p className="mt-3 font-semibold text-primary-ink">
                  {t("founder.left", { n: spotsLeft })}
                </p>
              )}
            </div>
          </section>
        )}

        <section className="container mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <PricingPlans salesHref={salesHref} founderOpen={founderOpen} />
        </section>

        <section className="bg-[#f9f9f6] py-16 md:py-20">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="font-heading text-3xl text-foreground md:text-4xl">
                {t("addons.title")}
              </h2>
              <p className="mt-4 text-muted-foreground">{t("addons.subtitle")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {addons.map((addon) => (
                <div
                  key={addon.key}
                  className="rounded-[1.5rem] border border-border/50 bg-white p-6"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-heading text-lg font-bold text-foreground">
                      {t(`addons.${addon.key}.name`)}
                    </h3>
                    <span className="shrink-0 font-semibold text-primary-ink">
                      {addon.price}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`addons.${addon.key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-20">
          <h2 className="font-heading text-3xl text-foreground">{t("principle.title")}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("principle.body")}</p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
