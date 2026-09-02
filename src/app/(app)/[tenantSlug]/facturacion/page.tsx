import { createServerCaller } from "@/lib/trpc/server";
import { Receipt, FilePdf, CheckCircle, WarningCircle, CurrencyEur } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { GenerateInvoicesButton } from "@/components/facturacion/generate-invoices-button";

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200">
              <Receipt weight="duotone" className="h-6 w-6" />
            </div>
            Facturación
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestiona las facturas emitidas a tus clientes (incluye pupilaje y servicios).
          </p>
        </div>
        <GenerateInvoicesButton />
      </div>

      <Card className="bg-white shadow-bento border-border/40 overflow-hidden">
        <div className="p-0">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground p-6">
              <Receipt weight="duotone" className="h-16 w-16 text-muted/40 mb-4" />
              <p className="text-lg font-bold font-heading text-foreground">No hay facturas emitidas</p>
              <p className="text-sm mt-2 max-w-sm">
                Cuando finalice el mes, podrás generar las facturas automáticamente para todos los contratos de pupilaje activos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/40">
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
                      <td className="px-6 py-4 text-right font-mono font-bold text-blue-700 bg-blue-50/50">
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
