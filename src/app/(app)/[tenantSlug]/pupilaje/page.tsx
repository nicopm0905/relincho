import { createServerCaller } from "@/lib/trpc/server";
import { Storefront, Plus, User, IdentificationCard, Horse, CurrencyEur } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { NewContractDialog } from "@/components/pupilaje/new-contract-dialog";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Pupilaje — ${tenantSlug}` };
}

export default async function PupilajePage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  
  const [contracts, horses, contacts] = await Promise.all([
    caller.boarding.list(),
    caller.horses.list(),
    caller.contacts.list({ kind: "CLIENT" }),
  ]);

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200">
              <Storefront weight="duotone" className="h-6 w-6" />
            </div>
            Gestión de Pupilajes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Administra los contratos de alojamiento (boxes y prados) de los caballos de tus clientes.
          </p>
        </div>
        <NewContractDialog tenantSlug={tenantSlug} horses={horses} clients={contacts} />
      </div>

      {contracts.length === 0 ? (
        <Card className="bg-white shadow-bento border-border/40 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-orange-400 to-amber-400 w-full" />
          <div className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground p-6">
            <Storefront weight="duotone" className="h-16 w-16 text-muted/40 mb-4" />
            <p className="text-lg font-bold font-heading text-foreground">No tienes caballos en pupilaje</p>
            <p className="text-sm mt-2 max-w-sm">
              Si ofreces servicio de pupilaje en tus instalaciones, añade contratos aquí para generar la facturación mensual automáticamente.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contracts.map((contract) => (
            <Card key={contract.id} className={`bg-white shadow-bento border-border/40 overflow-hidden transition-all ${!contract.active && 'opacity-60 grayscale'}`}>
              <div className={`h-2 w-full ${contract.active ? 'bg-gradient-to-r from-orange-400 to-amber-400' : 'bg-muted'}`} />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden relative">
                      {contract.horse.photoUrl ? (
                        <img src={contract.horse.photoUrl} alt={contract.horse.name} className="object-cover h-full w-full" />
                      ) : (
                        <Horse weight="duotone" className="h-6 w-6 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground leading-tight">{contract.horse.name}</h3>
                      {contract.horse.boxLocation && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                          <IdentificationCard weight="bold" /> Box: {contract.horse.boxLocation}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={contract.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"}>
                    {contract.active ? "Activo" : "Finalizado"}
                  </Badge>
                </div>

                <div className="space-y-3 pt-4 border-t border-border/40">
                  <div className="flex items-center gap-2 text-sm">
                    <User weight="bold" className="text-muted-foreground h-4 w-4" />
                    <span className="font-medium text-foreground">{contract.client.name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cuota base:</span>
                    <span className="font-bold font-mono flex items-center text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                      {Number(contract.monthlyFee).toLocaleString('es-ES', { minimumFractionDigits: 2 })} <CurrencyEur weight="bold" className="ml-1 h-3 w-3" />
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Inicio: {formatDate(contract.startDate)}</span>
                    {!contract.active && contract.endDate && (
                      <span>Fin: {formatDate(contract.endDate)}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
