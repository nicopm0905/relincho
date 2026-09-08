import { createServerCaller } from "@/lib/trpc/server";
import { Receipt, FilePdf, CheckCircle, WarningCircle, CurrencyEur } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { GenerateInvoicesButton } from "@/components/facturacion/generate-invoices-button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Facturación — ${tenantSlug}` };
}

export default async function FacturacionPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  
  const invoices = await caller.invoices.list();

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <PageHeader
        title="Facturación"
        description="Facturas emitidas a tus clientes, incluidos pupilaje y servicios"
        actions={<GenerateInvoicesButton />}
      />

      <Card className="overflow-hidden">
        <div className="p-0">
          {invoices.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={<Receipt weight="duotone" />}
              title="Sin facturas emitidas"
              description="Al cerrar el mes podrás generar las facturas de todos los contratos de pupilaje activos."
            />
          ) : (
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider">Número</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Fecha</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Cliente</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-right">Total</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-center">Estado</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-medium font-mono text-foreground">
                        {inv.series}-{inv.number.toString().padStart(4, '0')}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                        {inv.client.name}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold whitespace-nowrap text-foreground">
                        {Number(inv.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </td>
                      <td className="px-6 py-4 text-center">
                        {inv.status === "PAID" && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Cobrada
                          </Badge>
                        )}
                        {inv.status === "ISSUED" && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Pendiente
                          </Badge>
                        )}
                        {inv.status === "DRAFT" && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            Borrador
                          </Badge>
                        )}
                        {inv.status === "OVERDUE" && (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                            Vencida
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a 
                          href={`/api/invoices/${inv.id}/pdf`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          <FilePdf weight="duotone" className="mr-2 h-4 w-4" />
                          Ver PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
