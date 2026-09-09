import { PageHeader } from "@/components/layout/page-header";
import { ChipScanner } from "@/components/rendimiento/chip-scanner";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Buscar por chip — ${tenantSlug}` };
}

export default async function EscanerPage({ params }: PageProps) {
  const { tenantSlug } = await params;

  return (
    <div className="animate-in fade-in-0 mx-auto max-w-2xl space-y-6 duration-500">
      <PageHeader
        backHref={`/${tenantSlug}/rendimiento`}
        backLabel="Rendimiento"
        title="Buscar por chip"
        description="Teclea el microchip del caballo para abrir su ficha deportiva"
      />
      <ChipScanner tenantSlug={tenantSlug} />
    </div>
  );
}
