import { getTranslations } from "next-intl/server";
import { PricingPlans } from "@/components/marketing/pricing-plans";

/** Sección de precios de la portada. El detalle completo vive en /precios. */
export async function Pricing() {
  const t = await getTranslations("marketing.pricing");
  const sales = await getTranslations("legal.contact.sales");

  const salesHref = `mailto:${sales("email")}?subject=${encodeURIComponent(
    sales("emailSubject"),
  )}`;

  return (
    <section id="pricing" className="bg-background py-24 md:py-32">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <h2 className="mb-6 font-heading text-4xl text-foreground md:text-5xl">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>

        <PricingPlans salesHref={salesHref} />
      </div>
    </section>
  );
}
