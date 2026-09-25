import { TRPCError } from "@trpc/server";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { SemenManager } from "@/components/reproduction/semen-manager";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Semen — ${tenantSlug}` };
}

export default async function SemenPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  let batches;
  try {
    batches = await caller.reproduction.listSemen();
  } catch (error) {
    // El inventario es de la yeguada: un veterinario externo no lo ve.
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      return (
        <div className="max-w-3xl space-y-6">
          <PageHeader backHref={`/${tenantSlug}/reproduccion`} backLabel="Reproducción" title="Semen" />
          <p className="text-[13.5px] text-muted-foreground">Solo el personal de la yeguada ve el inventario de semen.</p>
        </div>
      );
    }
    throw error;
  }
  const horses = await caller.horses.list();
  const stallions = horses.filter((h) => h.sex === "MALE").map((h) => ({ id: h.id, name: h.name }));
  const totalLeft = batches.reduce((n, b) => n + b.dosesLeft, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        backHref={`/${tenantSlug}/reproduccion`}
        backLabel="Reproducción"
        title="Semen"
        description={`${batches.length} ${batches.length === 1 ? "lote" : "lotes"} · ${totalLeft} dosis disponibles`}
      />
      <SemenManager batches={batches} stallions={stallions} tenantSlug={tenantSlug} />
    </div>
  );
}
