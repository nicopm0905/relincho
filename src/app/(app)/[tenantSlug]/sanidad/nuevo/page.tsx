import { createServerCaller } from "@/lib/trpc/server";
import { HealthEventForm } from "@/components/sanidad/health-event-form";
import { Button } from "@/components/ui/button";
import { CaretLeft, Heartbeat } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ horseId?: string }>;
}

export default async function NuevoSanidadPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const { horseId } = await searchParams;
  
  const caller = await createServerCaller(tenantSlug);
  
  // Get all horses to populate select if horseId is not provided
  const horses = await caller.horses.list({ status: "ACTIVE" });
  
  if (horses.length === 0) {
    // Cannot create health event without horses
    redirect(`/${tenantSlug}/caballos`);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in-0 duration-500 w-full px-2 sm:px-0">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={horseId ? `/${tenantSlug}/caballos/${horseId}?tab=timeline` : `/${tenantSlug}/sanidad`}>
            <CaretLeft weight="bold" className="mr-1 h-4 w-4" />
            Cancelar
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-2xl p-6 shadow-bento border border-border/80 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-400 to-rose-600" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-sm">
            <Heartbeat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Nuevo Registro</h1>
            <p className="text-muted-foreground text-sm">Añade vacuna, desparasitación o visita</p>
          </div>
        </div>

        <HealthEventForm 
          tenantSlug={tenantSlug} 
          defaultHorseId={horseId} 
          horses={horses.map(h => ({ id: h.id, name: h.name }))} 
        />
      </div>
    </div>
  );
}
