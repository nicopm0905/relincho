import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingButton } from "@/components/settings/billing-button";
import { CreditCard, UsersThree } from "@phosphor-icons/react/dist/ssr";

import { TenantSettingsForm } from "@/components/settings/tenant-settings-form";
import { TeamManagement } from "@/components/settings/team-management";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

const planLabels: Record<string, string> = {
  starter: "Starter (gratuito)",
  pro: "Pro",
  enterprise: "Enterprise",
};

export default async function AjustesPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: { userId: session.user.id, tenantId: tenant.id },
    },
    select: { role: true },
  });
  if (!membership) notFound();

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuración de tu ganadería y plan de suscripción
        </p>
      </div>

      <TenantSettingsForm tenant={{
        id: tenant.id,
        name: tenant.name,
        nif: tenant.nif,
        province: tenant.province,
        regaCode: tenant.regaCode,
      }} />

      {membership.role === "OWNER" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersThree weight="fill" className="h-4 w-4" />
              Equipo
            </CardTitle>
            <CardDescription>
              Invita a tu equipo y controla qué puede ver y hacer cada persona
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamManagement />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard weight="fill" className="h-4 w-4" />
            Plan y facturación
          </CardTitle>
          <CardDescription>Gestiona tu suscripción a Relincho</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="font-semibold text-foreground">{planLabels[tenant.plan] ?? tenant.plan}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {tenant.plan === "starter"
                  ? "Hasta 15 caballos"
                  : tenant.plan === "pro"
                  ? "Hasta 60 caballos"
                  : "Sin límite"}
              </p>
            </div>
            <Badge variant={tenant.plan === "starter" ? "secondary" : "success"}>
              {tenant.plan.toUpperCase()}
            </Badge>
          </div>
          <BillingButton
            tenantId={tenant.id}
            hasSubscription={!!tenant.stripeCustomerId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
