"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createCheckoutSession, createPortalSession } from "@/server/actions/stripe";
import { ArrowSquareOut } from "@phosphor-icons/react";
import {
  founderPrice,
  formatEuro,
  planPrice,
  type BillingInterval,
  type PlanKey,
} from "@/lib/pricing";

export interface BillingPlanOption {
  key: PlanKey;
  name: string;
  /** Precios de Stripe configurados para cada intervalo. */
  purchasable: { month: boolean; year: boolean };
}

interface BillingButtonProps {
  tenantId: string;
  hasSubscription: boolean;
  /** Solo el propietario puede mover el cobro de la yeguada. */
  canManage: boolean;
  /** Planes de autoservicio que se pueden ofrecer (Cuadra, Rendimiento). */
  plans: BillingPlanOption[];
  /** La oferta de fundador sigue abierta. */
  founderOpen: boolean;
}

export function BillingButton({
  tenantId,
  hasSubscription,
  canManage,
  plans,
  founderOpen,
}: BillingButtonProps) {
  const t = useTranslations("settings.billing");
  const sales = useTranslations("legal.contact.sales");
  const [interval, setInterval] = useState<BillingInterval>("month");

  if (!canManage) {
    return <p className="text-xs text-muted-foreground">{t("ownerOnly")}</p>;
  }

  if (hasSubscription) {
    return (
      <form action={createPortalSession.bind(null, tenantId)}>
        <Button variant="outline" type="submit">
          <ArrowSquareOut weight="bold" className="mr-2 h-4 w-4" />
          {t("manage")}
        </Button>
      </form>
    );
  }

  // Sin precios configurados en Stripe el boton solo puede acabar en un error,
  // asi que en su lugar se ofrece escribirnos.
  const available = plans.filter((plan) => plan.purchasable[interval]);
  const anyPurchasable = plans.some((plan) => plan.purchasable.month || plan.purchasable.year);
  if (!anyPurchasable) {
    const href = `mailto:${sales("email")}?subject=${encodeURIComponent(
      sales("emailSubject"),
    )}`;
    return (
      <div className="space-y-2">
        <Button variant="outline" asChild>
          <a href={href}>{t("contactToUpgrade")}</a>
        </Button>
        <p className="text-xs text-muted-foreground">{t("notConfigured")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div role="group" className="inline-flex rounded-full border border-border/60 p-1">
        {(["month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={interval === value}
            onClick={() => setInterval(value)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              interval === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "month" ? t("monthly") : t("annual")}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {available.map((plan) => {
          const price = founderOpen
            ? founderPrice(plan.key, interval)
            : planPrice(plan.key, interval);
          const suffix = interval === "year" ? "/año" : "/mes";
          return (
            <form
              key={plan.key}
              action={createCheckoutSession.bind(null, tenantId, plan.key, {
                interval,
                founder: founderOpen,
              })}
            >
              <Button type="submit" variant={plan.key === "rendimiento" ? "default" : "outline"}>
                {t("upgrade", { plan: plan.name, price: `${formatEuro(price)}${suffix}` })}
              </Button>
            </form>
          );
        })}
      </div>

      {founderOpen && <p className="text-xs text-muted-foreground">{t("founderNote")}</p>}
      <Link href="/precios" className="text-xs text-primary-ink underline underline-offset-2">
        {t("seePlans")}
      </Link>
    </div>
  );
}
