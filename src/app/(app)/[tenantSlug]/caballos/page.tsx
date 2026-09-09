import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { HorsesExplorer } from "@/components/horses/horses-explorer";
import { HorseImportDialog } from "@/components/horses/horse-import-dialog";

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
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title="Caballos"
        description={
          horses.length === 1
            ? "1 caballo registrado en tu ganadería"
            : `${horses.length} caballos registrados en tu ganadería`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <HorseImportDialog />
            <Button asChild size="lg">
              <Link href={`/${tenantSlug}/caballos/nuevo`}>
                <Plus weight="bold" />
                Añadir caballo
              </Link>
            </Button>
          </div>
        }
      />

      <HorsesExplorer horses={horses} tenantSlug={tenantSlug} />
    </div>
  );
}
