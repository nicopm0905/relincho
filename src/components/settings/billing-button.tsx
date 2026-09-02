"use client";

import { Button } from "@/components/ui/button";
import { createCheckoutSession, createPortalSession } from "@/server/actions/stripe";
import { ArrowSquareOut } from "@phosphor-icons/react";

interface BillingButtonProps {
  tenantId: string;
  hasSubscription: boolean;
}

export function BillingButton({ tenantId, hasSubscription }: BillingButtonProps) {
  if (hasSubscription) {
    return (
      <form action={createPortalSession.bind(null, tenantId)}>
        <Button variant="outline" type="submit">
          <ArrowSquareOut weight="bold" className="mr-2 h-4 w-4" />
          Gestionar suscripción
        </Button>
      </form>
    );
  }

  return (
    <form action={createCheckoutSession.bind(null, tenantId, "pro")}>
      <Button type="submit">Actualizar a Pro — 79 €/mes</Button>
    </form>
  );
}
