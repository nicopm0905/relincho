import { Suspense } from "react";
import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { DownloadSimple, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { HorsesExplorer } from "@/components/horses/horses-explorer";
import { HorseImportDialog } from "@/components/horses/horse-import-dialog";
import { CollectionSkeleton } from "@/components/ui/page-skeleton";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Caballos — ${tenantSlug}` };
}

export default function CaballosPage({ params }: PageProps) {
  return (
    <Suspense fallback={<CollectionSkeleton />}>
      <CaballosContent params={params} />
    </Suspense>
  );
}

async function CaballosContent({ params }: PageProps) {
  const [{ tenantSlug }, session] = await Promise.all([params, getSession()]);
  const caller = await createServerCaller(tenantSlug);
  const [horses, access] = await Promise.all([
    caller.horses.list(),
    getTenantAccess(tenantSlug, session?.user?.id),
  ]);
  const canExport =
    access.membership?.role === "OWNER" ||
    access.membership?.role === "MANAGER";

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
            {horses.length > 0 && canExport && (
              <Button asChild variant="outline" size="lg">
                <a href={`/api/horses/export?tenant=${encodeURIComponent(tenantSlug)}`}>
                  <DownloadSimple weight="bold" />
                  Exportar CSV
                </a>
              </Button>
            )}
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
