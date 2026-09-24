import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  { key: "free", highlighted: false },
  { key: "pro", highlighted: true },
  { key: "enterprise", highlighted: false },
] as const;

export async function Pricing() {
  const t = await getTranslations("marketing.pricing");
  const sales = await getTranslations("legal.contact.sales");

  return (
    <section id="pricing" className="bg-background py-24 md:py-32">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6">

        <div className="text-center max-w-2xl mx-auto mb-16 md:mb-24">
          <h2 className="font-heading text-4xl md:text-5xl text-foreground mb-6">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const features = t.raw(`plans.${plan.key}.features`) as string[];
            // El plan grande no se compra solo: se cierra hablando con nosotros.
            const isContact = plan.key === "enterprise";
            const href = isContact
              ? `mailto:${sales("email")}?subject=${encodeURIComponent(sales("emailSubject"))}`
              : "/demo";
            const hasPrice = t.has(`plans.${plan.key}.price`);

            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border bg-card p-8 shadow-bento transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-raised ${
                  plan.highlighted
                    ? "border-primary shadow-raised md:scale-[1.03]"
                    : "border-border/70"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                    {t("recommended")}
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-2xl font-bold font-heading mb-2 text-foreground">
                    {t(`plans.${plan.key}.name`)}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t(`plans.${plan.key}.description`)}
                  </p>
                </div>

                <div className="mb-8">
                  {hasPrice ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-5xl font-bold font-heading text-foreground">
                        {t(`plans.${plan.key}.price`)}€
                      </span>
                      <span className="text-muted-foreground font-medium">
                        {t("perMonth")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-3xl md:text-4xl font-bold font-heading text-foreground">
                      {t(`plans.${plan.key}.priceNote`)}
                    </span>
                  )}
                </div>

                <ul className="space-y-4 mb-10 flex-1">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.highlighted ? "default" : "outline"}
                  className="h-12 w-full text-base"
                >
                  {isContact ? (
                    <a href={href}>{t(`plans.${plan.key}.cta`)}</a>
                  ) : (
                    <Link href={href}>{t(`plans.${plan.key}.cta`)}</Link>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
