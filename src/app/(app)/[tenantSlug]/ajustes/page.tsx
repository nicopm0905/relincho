import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingButton } from "@/components/settings/billing-button";
import { planHorseLimit, planLabel, isPlanPurchasable } from "@/lib/stripe";
import { CreditCard, UsersThree, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/formatters";

import { TenantSettingsForm } from "@/components/settings/tenant-settings-form";
import { TeamManagement } from "@/components/settings/team-management";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

/** El precio vive en un solo sitio para no repetirlo por idioma. */
const PRO_PRICE_LABEL = "79 €/mes";

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

  const isOwner = membership.role === "OWNER";
  // Un impago deja el plan intacto unos dias: se avisa sin cortar el acceso.
  const paymentPending =
    tenant.stripeStatus === "past_due" || tenant.stripeStatus === "unpaid";

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

      {isOwner && (
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
          {paymentPending && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <WarningCircle weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">
                  No hemos podido cobrar la suscripción
                </p>
                <p className="mt-0.5 text-amber-800">
                  La yeguada sigue funcionando, pero conviene revisar el método de
                  pago para no perder el plan de pago.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="font-semibold text-foreground">{planLabel(tenant.plan)}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Hasta {planHorseLimit(tenant.plan)} caballos
              </p>
              {tenant.stripeCurrentPeriodEnd && (
                <p className="text-xs text-muted-foreground mt-1">
                  Se renueva el {formatDate(tenant.stripeCurrentPeriodEnd)}
                </p>
              )}
            </div>
            <Badge variant={tenant.plan === "starter" ? "secondary" : "success"}>
              {tenant.plan.toUpperCase()}
            </Badge>
          </div>

          <BillingButton
            tenantId={tenant.id}
            hasSubscription={!!tenant.stripeCustomerId}
            canManage={isOwner}
            purchasable={isPlanPurchasable("pro")}
            priceLabel={PRO_PRICE_LABEL}
          />
        </CardContent>
      </Card>
    </div>
  );
}
