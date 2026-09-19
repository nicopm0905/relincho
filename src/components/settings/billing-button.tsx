"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createCheckoutSession, createPortalSession } from "@/server/actions/stripe";
import { ArrowSquareOut } from "@phosphor-icons/react";

interface BillingButtonProps {
  tenantId: string;
  hasSubscription: boolean;
  /** Solo el propietario puede mover el cobro de la yeguada. */
  canManage: boolean;
  /** true si el plan de pago está configurado en Stripe y se puede contratar. */
  purchasable: boolean;
  /** Precio mensual en texto, para no repetirlo en cada idioma. */
  priceLabel: string;
}

export function BillingButton({
  tenantId,
  hasSubscription,
  canManage,
  purchasable,
  priceLabel,
}: BillingButtonProps) {
  const t = useTranslations("settings.billing");
  const sales = useTranslations("legal.contact.sales");

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

  // Sin precio configurado en Stripe el boton solo puede acabar en un error
  // («Plan inválido»), asi que en su lugar se ofrece escribirnos.
  if (!purchasable) {
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
    <form action={createCheckoutSession.bind(null, tenantId, "pro")}>
      <Button type="submit">{t("upgrade", { price: priceLabel })}</Button>
    </form>
  );
}
