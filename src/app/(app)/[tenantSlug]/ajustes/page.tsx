import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingButton } from "@/components/settings/billing-button";
import { Buildings, CreditCard } from "@phosphor-icons/react/dist/ssr";

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

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuración de tu ganadería y plan de suscripción
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Buildings weight="fill" className="h-4 w-4" />
            Información de la finca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 text-sm">
          <div className="flex justify-between items-center py-3 border-b border-border/50">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium">{tenant.name}</span>
          </div>
          {tenant.nif && (
            <div className="flex justify-between items-center py-3 border-b border-border/50">
              <span className="text-muted-foreground">NIF / CIF</span>
              <span className="font-medium">{tenant.nif}</span>
            </div>
          )}
          {tenant.province && (
            <div className="flex justify-between items-center py-3 border-b border-border/50">
              <span className="text-muted-foreground">Provincia</span>
              <span className="font-medium">{tenant.province}</span>
            </div>
          )}
          {tenant.regaCode && (
            <div className="flex justify-between items-center py-3">
              <span className="text-muted-foreground">Código REGA</span>
              <span className="font-mono text-xs font-medium">{tenant.regaCode}</span>
            </div>
          )}
        </CardContent>
      </Card>

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
