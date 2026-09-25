"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  annualMonthlyEquivalent,
  formatEuro,
  founderPrice,
  newFeaturesOf,
  planPrice,
  pricePerHorseMonth,
  type BillingInterval,
  type PlanKey,
} from "@/lib/pricing";

interface PricingPlansProps {
  /** Enlace mailto para el plan que se cierra hablando con nosotros. */
  salesHref: string;
  /** Muestra el precio de fundador debajo del de lista (oferta abierta). */
  founderOpen?: boolean;
  /** A dónde lleva el botón de alta de los planes de autoservicio. */
  signupHref?: string;
}

/**
 * Los cuatro planes con el conmutador mensual/anual. Los precios salen de
 * `@/lib/pricing`: aquí no hay ni una cifra escrita a mano.
 */
export function PricingPlans({
  salesHref,
  founderOpen = false,
  signupHref = "/login",
}: PricingPlansProps) {
  const t = useTranslations("marketing.pricing");
  const [interval, setInterval] = useState<BillingInterval>("year");

  return (
    <div>
      <div className="mb-10 flex flex-col items-center gap-3">
        <div
          role="group"
          aria-label={t("monthly") + " / " + t("annual")}
          className="inline-flex rounded-full border border-border/60 bg-card p-1"
        >
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                interval === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "month" ? t("monthly") : t("annual")}
            </button>
          ))}
        </div>
        <p className="text-sm font-medium text-primary-ink">{t("annualNote")}</p>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((key) => (
          <PlanCard
            key={key}
            planKey={key}
            interval={interval}
            founderOpen={founderOpen}
            salesHref={salesHref}
            signupHref={signupHref}
          />
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">{t("vatNote")}</p>
    </div>
  );
}

function PlanCard({
  planKey,
  interval,
  founderOpen,
  salesHref,
  signupHref,
}: {
  planKey: PlanKey;
  interval: BillingInterval;
  founderOpen: boolean;
  salesHref: string;
  signupHref: string;
}) {
  const t = useTranslations("marketing.pricing");
  const plan = PLAN_DEFINITIONS[planKey];
  const free = plan.monthly === 0;
  const isContact = planKey === "yeguada";

  const price = planPrice(planKey, interval);
  const perHorse = pricePerHorseMonth(planKey);
  const idx = PLAN_ORDER.indexOf(planKey);
  const previous = idx > 0 ? PLAN_ORDER[idx - 1] : null;
  const features = newFeaturesOf(planKey);

  const cta = t(`plans.${planKey}.cta`);
  const buttonClass = "h-12 w-full text-base";

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-8 shadow-bento transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-raised ${
        plan.highlighted ? "border-primary shadow-raised" : "border-border/70"
      }`}
    >
      {plan.highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold tracking-wider text-primary-foreground uppercase shadow-sm">
          {t("recommended")}
        </div>
      )}

      <div className="mb-6">
        <h3 className="mb-2 font-heading text-2xl font-bold text-foreground">
          {t(`plans.${planKey}.name`)}
        </h3>
        <p className="text-sm text-muted-foreground">{t(`plans.${planKey}.description`)}</p>
      </div>

      <div className="mb-2">
        {plan.startsAt && (
          <span className="mr-1 text-sm font-medium text-muted-foreground">{t("from")}</span>
        )}
        <span className="font-heading text-4xl font-bold text-foreground md:text-5xl">
          {formatEuro(price)}
        </span>
        <span className="ml-1 font-medium text-muted-foreground">
          {free ? "" : interval === "year" ? t("perYear") : t("perMonth")}
        </span>
      </div>

      <div className="mb-6 min-h-[3.5rem] space-y-1 text-sm">
        {!free && interval === "year" && (
          <p className="text-muted-foreground">
            {t("equivalent", { price: formatEuro(annualMonthlyEquivalent(plan.monthly)) })}
          </p>
        )}
        {perHorse !== null && (
          <p className="text-muted-foreground">
            {t("perHorse", { price: formatEuro(perHorse) })}
          </p>
        )}
        {founderOpen && !free && (
          <p className="font-semibold text-primary-ink">
            {t("founder.price", {
              price: formatEuro(founderPrice(planKey, "month")),
            })}
          </p>
        )}
      </div>

      <ul className="mb-8 space-y-2 text-sm text-foreground">
        <li className="font-semibold">
          {plan.maxHorses === null
            ? t("limits.horsesUnlimited")
            : t("limits.horses", { n: plan.maxHorses })}
          {" · "}
          {plan.maxUsers === null
            ? t("limits.usersUnlimited")
            : t("limits.users", { n: plan.maxUsers })}
        </li>
      </ul>

      {previous && (
        <p className="mb-3 text-sm font-semibold text-foreground">
          {t("includesAll", { plan: t(`plans.${previous}.name`) })}
        </p>
      )}
      <ul className="mb-10 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{t(`features.${feature}`)}</span>
          </li>
        ))}
      </ul>

      <Button
        asChild
        variant={plan.highlighted ? "default" : "outline"}
        className={buttonClass}
      >
        {isContact ? <a href={salesHref}>{cta}</a> : <Link href={signupHref}>{cta}</Link>}
      </Button>
    </div>
  );
}
