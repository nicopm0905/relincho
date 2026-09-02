import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { Plus, Horse } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { HorseCard } from "@/components/horses/horse-card";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Caballos — ${tenantSlug}` };
}

export default async function CaballosPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const horses = await caller.horses.list();

  return (
    <div className="space-y-8">
      {/* Page Header - Wise style: big bold title */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Caballos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {horses.length} {horses.length === 1 ? "caballo registrado" : "caballos registrados"} en tu ganadería
          </p>
        </div>
        <Button asChild size="lg" className="rounded-full shadow-sm">
          <Link href={`/${tenantSlug}/caballos/nuevo`}>
            <Plus weight="bold" className="mr-2 h-4 w-4" />
            Añadir caballo
          </Link>
        </Button>
      </div>

      {/* Horses Grid */}
      {horses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl bg-card border border-border/60">
          <div className="h-24 w-24 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 border border-border/40">
            <Horse weight="duotone" className="h-12 w-12 text-primary/40" />
          </div>
          <h3 className="text-xl font-extrabold text-foreground tracking-tight">
            Sin caballos aún
          </h3>
          <p className="text-[15px] text-muted-foreground mt-2 mb-8 font-medium">
            Empieza registrando tu primer caballo
          </p>
          <Button asChild className="rounded-full h-11 px-6">
            <Link href={`/${tenantSlug}/caballos/nuevo`}>
              <Plus weight="bold" className="mr-2 h-4 w-4" />
              Añadir el primero
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {horses.map((horse) => (
            <HorseCard key={horse.id} horse={horse} tenantSlug={tenantSlug} />
          ))}
        </div>
      )}
    </div>
  );
}
