import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentsManager } from "@/components/documentos/documents-manager";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Documentos — ${tenantSlug}` };
}

export default async function DocumentosPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);

  const [listing, horses] = await Promise.all([
    caller.documents.list({}),
    caller.horses.list(),
  ]);

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title="Documentos"
        description="Pasaportes, radiografías, analíticas y contratos, cada uno en su sitio y con su caballo."
      />
      <DocumentsManager
        tenantId={listing.tenantId}
        documents={listing.documents}
        usage={listing.usage}
        horses={horses.map((horse) => ({ id: horse.id, name: horse.name }))}
      />
    </div>
  );
}
