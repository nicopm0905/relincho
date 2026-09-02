import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { Plus, CaretRight, Horse, Egg, CheckCircle, WarningCircle, Baby } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Reproducción — ${tenantSlug}` };
}

export default async function ReproductionPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const activeCycles = await caller.reproduction.listActiveCycles({});

  // Agrupación para el Kanban
  const colVacias: any[] = [];
  const colPrenadas: any[] = [];
  const colParidas: any[] = [];

  activeCycles.forEach((cycle) => {
    const latestCovering = cycle.coverings[0];
    const latestCheck = latestCovering?.pregnancyChecks[0];

    if (!latestCovering) {
      colVacias.push(cycle); // Sin cubriciones = vacía
      return;
    }

    if (latestCovering.foaling) {
      colParidas.push(cycle);
    } else if (latestCheck?.result === "POSITIVE") {
      colPrenadas.push(cycle);
    } else {
      // Si no hay check, o el check es NEGATIVE, o el covering es PENDING
      colVacias.push(cycle);
    }
  });

  const KanbanColumn = ({ 
    title, 
    icon: Icon, 
    items, 
    colorClass, 
    bgClass 
  }: { 
    title: string, 
    icon: any, 
    items: any[],
    colorClass: string,
    bgClass: string
  }) => (
    <div className={`flex flex-col rounded-3xl ${bgClass} border border-border/40 p-4 min-h-[500px]`}>
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <Icon weight="duotone" className={`h-6 w-6 ${colorClass}`} />
          <h2 className="font-heading font-bold text-lg text-foreground">{title}</h2>
        </div>
        <Badge variant="secondary" className="font-mono bg-white shadow-sm">{items.length}</Badge>
      </div>

      <div className="flex-1 space-y-3">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground/60 border-2 border-dashed border-border/60 rounded-2xl">
            <p className="text-sm font-medium">Ninguna yegua</p>
          </div>
        ) : (
          items.map((cycle) => {
            const latestCovering = cycle.coverings[0];
            const latestCheck = latestCovering?.pregnancyChecks[0];

            return (
              <Link key={cycle.id} href={`/${tenantSlug}/reproduccion/${cycle.id}`} className="block group">
                <Card className="border-border/40 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
                        {cycle.mare.name}
                      </div>
                      <CaretRight weight="bold" className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    {latestCovering ? (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Semental:</span>
                          <span className="font-medium text-foreground">{latestCovering.stallion?.name || "—"}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Cubrición:</span>
                          <span className="font-medium text-foreground">{format(new Date(latestCovering.date), "dd/MM/yyyy")}</span>
                        </div>
                        {latestCheck && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Últ. Eco:</span>
                            <span className="font-medium text-foreground">{format(new Date(latestCheck.date), "dd/MM/yyyy")}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">Sin cubriciones</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">
            Cuaderno de Parideras
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión reproductiva de la temporada {new Date().getFullYear()}
          </p>
        </div>
        <Button asChild className="rounded-full shadow-sm">
          <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo`}>
            <Plus weight="bold" className="mr-2 h-4 w-4" />
            Nuevo Ciclo
          </Link>
        </Button>
      </div>

      {activeCycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-3xl bg-white shadow-bento border border-border/40">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Egg weight="duotone" className="h-10 w-10 text-primary/60" />
          </div>
          <h3 className="text-xl font-bold text-foreground font-heading">
            Sin ciclos activos
          </h3>
          <p className="text-sm text-muted-foreground mt-2 mb-8 max-w-sm text-center">
            No hay yeguas en ciclo reproductivo esta temporada. Añade la primera yegua para empezar a registrar saltos y ecografías.
          </p>
          <Button asChild size="lg" className="rounded-full">
            <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo`}>
              <Plus weight="bold" className="mr-2 h-4 w-4" />
              Añadir la primera
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KanbanColumn 
            title="Vacías / En Celo" 
            icon={WarningCircle} 
            items={colVacias} 
            bgClass="bg-amber-50/50" 
            colorClass="text-amber-500" 
          />
          <KanbanColumn 
            title="Preñadas" 
            icon={CheckCircle} 
            items={colPrenadas} 
            bgClass="bg-emerald-50/50" 
            colorClass="text-emerald-500" 
          />
          <KanbanColumn 
            title="Paridas" 
            icon={Baby} 
            items={colParidas} 
            bgClass="bg-blue-50/50" 
            colorClass="text-blue-500" 
          />
        </div>
      )}
    </div>
  );
}
