import { createServerCaller } from "@/lib/trpc/server";
import { invoiceLabel } from "@/lib/invoice-label";
import { Receipt, FilePdf, Plus } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GenerateInvoicesButton } from "@/components/facturacion/generate-invoices-button";
import { InvoiceStatusFilter } from "@/components/facturacion/invoice-status-filter";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatus } from "@prisma/client";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ status?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Facturación — ${tenantSlug}` };
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PAID: { label: "Cobrada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ISSUED: { label: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  DRAFT: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  OVERDUE: { label: "Vencida", className: "bg-rose-50 text-rose-700 border-rose-200" },
  CANCELLED: { label: "Anulada", className: "bg-muted text-muted-foreground line-through" },
};

export default async function FacturacionPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const { status } = await searchParams;
  const caller = await createServerCaller(tenantSlug);

  const statusFilter =
    status && status in InvoiceStatus ? (status as InvoiceStatus) : undefined;

  const invoices = await caller.invoices.list(
    statusFilter ? { status: statusFilter } : undefined,
  );

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <PageHeader
        title="Facturación"
        description="Facturas emitidas a tus clientes, incluidos pupilaje y servicios"
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <InvoiceStatusFilter current={statusFilter} />
            <Button asChild variant="outline">
              <Link href={`/${tenantSlug}/facturacion/nueva`}>
                <Plus weight="bold" className="mr-2 h-4 w-4" />
                Nueva factura
              </Link>
            </Button>
            <GenerateInvoicesButton />
          </div>
        }
      />

      <Card className="overflow-hidden shadow-bento">
        <div className="p-0">
          {invoices.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={<Receipt weight="duotone" />}
              title="Sin facturas"
              description="Genera las facturas de pupilaje del mes o crea una factura manual."
            />
          ) : (
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Número</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Fecha</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Vence</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Cliente</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Total</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Saldo</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-center">Estado</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {invoices.map((inv) => {
                    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
                    const balance = Math.round((Number(inv.total) - paid) * 100) / 100;
                    const badge = STATUS_BADGE[inv.status] ?? {
                      label: inv.status,
                      className: "bg-muted text-muted-foreground",
                    };
                    return (
                      <tr key={inv.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 font-medium font-mono text-foreground">
                          <Link
                            href={`/${tenantSlug}/facturacion/${inv.id}`}
                            className="hover:underline"
                          >
                            {invoiceLabel(inv)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {formatDate(inv.issueDate)}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                        </td>
                        <td className="px-6 py-4 font-bold text-foreground">
                          {inv.client.name}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold whitespace-nowrap text-foreground">
                          {Number(inv.total).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-mono whitespace-nowrap ${
                            balance <= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {balance.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="outline" className={badge.className}>
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/[0.08]"
                          >
                            <FilePdf weight="duotone" className="mr-2 h-4 w-4" />
                            PDF
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
