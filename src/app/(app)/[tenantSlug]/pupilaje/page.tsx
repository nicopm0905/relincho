import Image from "next/image";
import { createServerCaller } from "@/lib/trpc/server";
import { Storefront, User, IdentificationCard, Horse, CurrencyEur } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { NewContractDialog } from "@/components/pupilaje/new-contract-dialog";
import { ContractExtras } from "@/components/pupilaje/contract-extras";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

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
    caller.contacts.list({ kinds: ["CLIENT", "OWNER"] }),
  ]);

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title="Pupilaje"
        description="Contratos de alojamiento en boxes y prados para caballos de clientes"
        actions={<NewContractDialog tenantSlug={tenantSlug} horses={horses} clients={contacts} />}
      />

      {contracts.length === 0 ? (
        <Card>
          <EmptyState
              variant="plain"
              icon={<Storefront />}
              title="Sin caballos en pupilaje"
              description="Añade contratos de alojamiento para generar la facturación mensual automáticamente."
            />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contracts.map((contract) => (
            <Card key={contract.id} className={`bg-card shadow-bento border-border/80 overflow-hidden transition-all ${!contract.active && 'opacity-60 grayscale'}`}>
              <div className={`h-2 w-full ${contract.active ? 'bg-gradient-to-r from-orange-400 to-amber-400' : 'bg-muted'}`} />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden relative">
                      {contract.horse.photoUrl ? (
                        <Image src={contract.horse.photoUrl} alt={contract.horse.name} fill sizes="3rem" className="object-cover" />
                      ) : (
                        <Horse className="h-6 w-6 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
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

                  <ContractExtras
                    contractId={contract.id}
                    extras={contract.extras.map((e) => ({
                      id: e.id,
                      concept: e.concept,
                      amount: Number(e.amount),
                      vatRate: Number(e.vatRate),
                      recurring: e.recurring,
                      oneOffApplied: e.oneOffApplied,
                    }))}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
