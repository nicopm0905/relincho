import { createServerCaller } from "@/lib/trpc/server";
import { TrainingForm } from "@/components/entrenamiento/training-form";
import { Button } from "@/components/ui/button";
import { CaretLeft, Barbell } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ horseId?: string }>;
}

export default async function NuevoEntrenamientoPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const { horseId } = await searchParams;
  
  const caller = await createServerCaller(tenantSlug);
  
  const horses = await caller.horses.list({ status: "ACTIVE" });
  
  if (horses.length === 0) {
    redirect(`/${tenantSlug}/caballos`);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in-0 duration-500 w-full px-2 sm:px-0">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={horseId ? `/${tenantSlug}/caballos/${horseId}?tab=timeline` : `/${tenantSlug}/caballos`}>
            <CaretLeft weight="bold" className="mr-1 h-4 w-4" />
            Cancelar
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-2xl p-6 shadow-bento border border-border/80 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-blue-600" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
            <Barbell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Entrenamiento</h1>
            <p className="text-muted-foreground text-sm">Registrar sesión de trabajo</p>
          </div>
        </div>

        <TrainingForm 
          tenantSlug={tenantSlug} 
          defaultHorseId={horseId} 
          horses={horses.map(h => ({ id: h.id, name: h.name }))} 
        />
      </div>
    </div>
  );
}
