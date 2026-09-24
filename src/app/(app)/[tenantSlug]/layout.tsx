import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { redirect, notFound } from "next/navigation";
import { loginUrlForCurrentPage } from "@/lib/auth-redirect";
import { isDemoTenant } from "@/lib/demo";
import { Sidebar } from "@/components/layout/sidebar";
import { DemoBanner } from "@/components/layout/demo-banner";
import { Toaster } from "@/components/ui/sonner";
import { TRPCProvider } from "@/lib/trpc/react";
import { OwnerExternalGate } from "@/components/portal/owner-external-gate";

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { tenantSlug } = await params;
  const demo = isDemoTenant(tenantSlug);
  // La sesion es un JWT: se lee sin tocar la base de datos. Tenant y membresia
  // salen de una sola consulta que el contexto de tRPC reutiliza despues.
  const session = await getSession();
  if (!session?.user && !demo) redirect(await loginUrlForCurrentPage());

  const { tenant, membership } = await getTenantAccess(
    tenantSlug,
    session?.user?.id,
  );
  if (!tenant) notFound();
  if (!membership && !demo) notFound();

  // Sin membresia en la yeguada de demostracion: mismo panel, en solo lectura.
  const readOnlyDemo = demo && !membership;

  // Portal del propietario externo (Fase 1): si el único rol del usuario en el
  // tenant es OWNER_EXTERNAL, sólo puede usar /[tenantSlug]/portal. Se le sirve
  // un layout reducido (sin el sidebar del panel completo) y <OwnerExternalGate>
  // (client component, porque un layout de servidor no ve el pathname) lo
  // redirige a /portal cuando intenta abrir cualquier otra ruta del tenant.
  if (membership?.role === "OWNER_EXTERNAL") {
    return (
      <TRPCProvider tenantSlug={tenantSlug}>
        <OwnerExternalGate tenantSlug={tenantSlug} />
        {children}
        <Toaster richColors position="top-right" />
      </TRPCProvider>
    );
  }

  return (
    <TRPCProvider tenantSlug={tenantSlug}>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          tenantSlug={tenantSlug}
          tenantName={tenant.name}
          userName={session?.user?.name}
          userEmail={session?.user?.email}
        />
        {/* Top padding on phones clears the fixed bar; bottom clears the tabs. */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 md:px-8 md:pt-8 md:pb-12">
            {readOnlyDemo && <DemoBanner />}
            {children}
          </div>
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </TRPCProvider>
  );
}
