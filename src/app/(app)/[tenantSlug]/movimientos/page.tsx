import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, ArrowLeft, Path } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { NewMovementDialog } from "@/components/movimientos/new-movement-dialog";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Libro de Explotación — ${tenantSlug}` };
}

export default async function MovimientosPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  
  const [movements, horses] = await Promise.all([
    caller.movements.list(),
    caller.horses.list()
  ]);

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">
            Libro de Explotación
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro oficial de movimientos REGA (Altas y Bajas)
          </p>
        </div>
        <NewMovementDialog tenantSlug={tenantSlug} horses={horses} />
      </div>

      <Card className="bg-white shadow-bento border-border/40 overflow-hidden">
        <div className="p-0">
          {movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
              <Path weight="duotone" className="h-16 w-16 text-muted/40 mb-4" />
              <p className="text-base font-medium">No hay movimientos registrados</p>
              <p className="text-sm mt-1 max-w-sm">
                Comienza a registrar las altas y bajas de tus caballos para mantener el libro de explotación al día.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/40">
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider">Fecha</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Caballo</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Movimiento</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Origen / Destino</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {movements.map((mov) => {
                    const isEntry = mov.direction === "IN";
                    return (
                      <tr key={mov.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 font-medium">
                          {formatDate(mov.date)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{mov.horse.name}</span>
                            {mov.horse.uelnCode && (
                              <span className="text-xs text-muted-foreground font-mono">{mov.horse.uelnCode}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {isEntry ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1">
                              <ArrowRight weight="bold" className="h-3 w-3" /> Alta
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 gap-1.5 py-1">
                              <ArrowLeft weight="bold" className="h-3 w-3" /> Baja
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-xs font-mono">
                            {isEntry ? (
                              <>
                                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Origen</span>
                                <span>{mov.originRega || "—"}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Destino</span>
                                <span>{mov.destinationRega || "—"}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {mov.reason || "—"}
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
