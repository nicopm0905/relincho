import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { Plus, Egg } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { KanbanBoard } from "@/components/reproduction/kanban-board";

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

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] sm:text-3xl font-bold tracking-tight text-foreground font-heading">
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
        <KanbanBoard 
          tenantSlug={tenantSlug} 
          colVacias={colVacias} 
          colPrenadas={colPrenadas} 
          colParidas={colParidas} 
        />
      )}
    </div>
  );
}
