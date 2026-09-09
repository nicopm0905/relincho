import { createServerCaller } from "@/lib/trpc/server";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PayInvoiceButton } from "@/components/portal/pay-invoice-button";
import { Receipt, FilePdf } from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Facturas — ${tenantSlug}` };
}

const statusMeta: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  ISSUED: {
    label: "Pendiente",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  OVERDUE: {
    label: "Vencida",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  PAID: {
    label: "Pagada",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  CANCELLED: {
    label: "Anulada",
    className: "bg-muted text-muted-foreground line-through",
  },
};

export default async function PortalFacturasPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const invoices = await caller.portal.myInvoices();

  const stripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Facturas
        </h1>
        <p className="text-sm text-muted-foreground">
          Tus facturas de pupilaje y servicios.
        </p>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<Receipt weight="duotone" />}
          title="Todavía no tienes facturas"
          description="Cuando la yeguada emita una factura a tu nombre aparecerá aquí."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Número</th>
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3 text-center font-semibold">Estado</th>
                  <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {invoices.map((inv) => {
                  const meta = statusMeta[inv.status] ?? {
                    label: inv.status,
                    className: "bg-muted text-muted-foreground",
                  };
                  const payable =
                    inv.status === "ISSUED" || inv.status === "OVERDUE";
                  return (
                    <tr key={inv.id} className="hover:bg-muted/10">
                      <td className="px-5 py-3 font-mono font-medium text-foreground">
                        {inv.series}-{inv.number.toString().padStart(4, "0")}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold whitespace-nowrap text-foreground">
                        {formatCurrency(Number(inv.total))}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[0.8rem] font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                          >
                            <FilePdf weight="duotone" className="h-4 w-4" />
                            PDF
                          </a>
                          {payable && (
                            <PayInvoiceButton
                              invoiceId={inv.id}
                              tenantSlug={tenantSlug}
                              enabled={stripeEnabled}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
