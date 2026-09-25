import { createServerCaller } from "@/lib/trpc/server";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { PageHeader } from "@/components/layout/page-header";
import { ReproSettingsForm } from "@/components/reproduction/repro-settings-form";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Parámetros reproductivos — ${tenantSlug}` };
}

export default async function ReproSettingsPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const settings = await caller.reproduction.getSettings();
  const session = await getSession();
  const { membership } = await getTenantAccess(tenantSlug, session?.user?.id);
  const canEdit = membership?.role === "OWNER" || membership?.role === "MANAGER";

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        backHref={`/${tenantSlug}/reproduccion`}
        backLabel="Reproducción"
        title="Parámetros reproductivos"
        description="Valores de referencia de la yeguada para predecir celos, ovulaciones, ecografías y partos. Por defecto son los de la literatura veterinaria; cada yegua ajusta los suyos con su historial."
      />
      {!canEdit && (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
          Solo la propiedad o la gerencia de la yeguada puede cambiar estos parámetros.
        </p>
      )}
      <ReproSettingsForm initial={settings} canEdit={canEdit} />
    </div>
  );
}
