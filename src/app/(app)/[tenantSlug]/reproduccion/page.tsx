import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { Plus, Egg } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import dynamic from "next/dynamic";
import { mareState } from "@/lib/reproduction";

const KanbanBoard = dynamic(
  () =>
    import("@/components/reproduction/kanban-board").then(
      (module) => module.KanbanBoard,
    ),
  {
    loading: () => (
      <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
        {["vacias", "prenadas", "paridas"].map((column) => (
          <div key={column} className="h-[500px] animate-pulse rounded-2xl bg-muted/50" />
        ))}
      </div>
    ),
  },
);

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
  type ActiveCycle = (typeof activeCycles)[number];
  const colVacias: ActiveCycle[] = [];
  const colPrenadas: ActiveCycle[] = [];
  const colParidas: ActiveCycle[] = [];

  // Mismo criterio que la ficha y el Inicio (`mareState`): gemelos es
  // gestante; cubierta sin eco y perdida gestacional vuelven a vacias.
  activeCycles.forEach((cycle) => {
    const state = mareState(cycle.coverings[0]);
    if (state === "FOALED") colParidas.push(cycle);
    else if (state === "PREGNANT" || state === "TWINS") colPrenadas.push(cycle);
    else colVacias.push(cycle);
  });

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title="Reproducción"
        description={`Gestión reproductiva de la temporada ${new Date().getFullYear()}`}
        actions={
          <Button asChild>
            <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo`}>
              <Plus weight="bold" />
              Nuevo ciclo
            </Link>
          </Button>
        }
      />

      {activeCycles.length === 0 ? (
        <EmptyState
          icon={<Egg weight="duotone" />}
          title="Sin ciclos activos"
          description="No hay yeguas en ciclo reproductivo esta temporada. Añade la primera para empezar a registrar cubriciones y ecografías."
          action={
            <Button asChild size="lg">
              <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo`}>
                <Plus weight="bold" />
                Añadir la primera
              </Link>
            </Button>
          }
        />
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
