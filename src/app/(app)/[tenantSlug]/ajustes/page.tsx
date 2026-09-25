import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { prisma } from "@/server/db/prisma";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingButton } from "@/components/settings/billing-button";
import { planHorseLimit, planLabel, isPlanPurchasable, founderCouponId } from "@/lib/stripe";
import { FREE_PLAN, isFounderOfferOpen, normalizePlanKey } from "@/lib/pricing";
import { CreditCard, UsersThree, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/formatters";

import { TenantSettingsForm } from "@/components/settings/tenant-settings-form";
import dynamic from "next/dynamic";

const TeamManagement = dynamic(
  () =>
    import("@/components/settings/team-management").then(
      (module) => module.TeamManagement,
    ),
  {
    loading: () => (
      <div className="h-56 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />
    ),
  },
);
import { PageHeader } from "@/components/layout/page-header";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function AjustesPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { tenant, membership } = await getTenantAccess(
    tenantSlug,
    session.user.id,
  );
  if (!tenant) notFound();
  if (!membership) notFound();

  const isOwner = membership.role === "OWNER";
  const horseLimit = planHorseLimit(tenant.plan, tenant.extraHorseBlocks);
  const isFreePlan =
    normalizePlanKey(tenant.plan) === FREE_PLAN;
  const foundersTaken = await prisma.tenant.count({ where: { founder: true } });
  const founderOpen =
    !tenant.founder && Boolean(founderCouponId()) && isFounderOfferOpen(foundersTaken);
  // Un impago deja el plan intacto unos dias: se avisa sin cortar el acceso.
  const paymentPending =
    tenant.stripeStatus === "past_due" || tenant.stripeStatus === "unpaid";

  return (
    <div className="animate-in fade-in-0 max-w-2xl space-y-6 duration-500">
      <PageHeader
        title="Ajustes"
        description="Configuración de tu ganadería, equipo y plan de suscripción"
      />

      <TenantSettingsForm tenant={{
        id: tenant.id,
        name: tenant.name,
        fiscalName: tenant.fiscalName,
        nif: tenant.nif,
        address: tenant.address,
        postalCode: tenant.postalCode,
        city: tenant.city,
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
                {horseLimit === null ? "Caballos sin límite" : `Hasta ${horseLimit} caballos`}
                {tenant.extraHorseBlocks > 0 &&
                  ` (incluye ${tenant.extraHorseBlocks * 10} extra)`}
              </p>
              {tenant.stripeCurrentPeriodEnd && (
                <p className="text-xs text-muted-foreground mt-1">
                  Se renueva el {formatDate(tenant.stripeCurrentPeriodEnd)}
                </p>
              )}
            </div>
            <Badge variant={isFreePlan ? "secondary" : "success"}>
              {tenant.plan.toUpperCase()}
            </Badge>
          </div>

          <BillingButton
            tenantId={tenant.id}
            hasSubscription={!!tenant.stripeCustomerId}
            canManage={isOwner}
            founderOpen={founderOpen}
            plans={(["cuadra", "rendimiento"] as const).map((key) => ({
              key,
              name: key === "cuadra" ? "Cuadra" : "Rendimiento",
              purchasable: {
                month: isPlanPurchasable(key, "month"),
                year: isPlanPurchasable(key, "year"),
              },
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
