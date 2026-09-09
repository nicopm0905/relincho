import { Button } from "@/components/ui/button";
import { createInvoiceCheckoutSession } from "@/server/actions/portal-payment";

interface PayInvoiceButtonProps {
  invoiceId: string;
  tenantSlug: string;
  /** `false` cuando Stripe no está configurado en el entorno. */
  enabled: boolean;
}

export function PayInvoiceButton({
  invoiceId,
  tenantSlug,
  enabled,
}: PayInvoiceButtonProps) {
  if (!enabled) {
    // TODO(stripe): habilitar cuando STRIPE_SECRET_KEY esté configurado.
    return (
      <Button size="sm" variant="outline" disabled title="Próximamente">
        Pagar
      </Button>
    );
  }

  return (
    <form action={createInvoiceCheckoutSession}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <Button size="sm" type="submit">
        Pagar
      </Button>
    </form>
  );
}
