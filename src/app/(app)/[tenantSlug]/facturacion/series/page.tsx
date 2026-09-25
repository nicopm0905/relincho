import { createServerCaller } from "@/lib/trpc/server";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { PageHeader } from "@/components/layout/page-header";
import { SeriesManager } from "@/components/facturacion/series-manager";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Series de facturación — ${tenantSlug}` };
}

export default async function SeriesFacturacionPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const series = await caller.invoices.seriesOverview();
  const session = await getSession();
  const { membership } = await getTenantAccess(tenantSlug, session?.user?.id);
  const canManage = membership?.role === "OWNER" || membership?.role === "MANAGER";

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        backHref={`/${tenantSlug}/facturacion`}
        backLabel="Facturación"
        title="Series de facturación"
        description="Cada serie lleva su propia numeración correlativa. Úsalas, por ejemplo, para separar pupilaje de otros servicios."
      />
      {!canManage && (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
          Solo la propiedad o la gerencia de la yeguada puede cambiar las series.
        </p>
      )}
      <SeriesManager
        canManage={canManage}
        series={series.map((s) => ({
          id: s.id,
          code: s.code,
          prefix: s.prefix,
          year: s.year,
          nextNumber: s.nextNumber,
          isDefault: s.isDefault,
          isRectifying: s.isRectifying,
          issuedCount: s.issuedCount,
        }))}
      />
    </div>
  );
}
