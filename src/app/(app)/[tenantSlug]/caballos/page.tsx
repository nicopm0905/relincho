import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DownloadSimple, Plus, Scales } from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { HorsesExplorer } from "@/components/horses/horses-explorer";
import type { HorseRow } from "@/components/horses/horse-card";
import { HorseImportDialog } from "@/components/horses/horse-import-dialog";
import { CollectionSkeleton } from "@/components/ui/page-skeleton";
import { pendingHealthDue } from "@/lib/health-due";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

/** Lo sanitario que se avisa en la lista: vencido o en la próxima semana. */
const HEALTH_AHEAD_DAYS = 7;

export async function generateMetadata({ params }: PageProps) {
  const [{ tenantSlug }, t] = await Promise.all([params, getTranslations("horses")]);
  return { title: `${t("metaTitle")} — ${tenantSlug}` };
}

export default function CaballosPage({ params }: PageProps) {
  return (
    <Suspense fallback={<CollectionSkeleton />}>
      <CaballosContent params={params} />
    </Suspense>
  );
}

async function CaballosContent({ params }: PageProps) {
  const [{ tenantSlug }, session, t, tHome] = await Promise.all([
    params,
    getSession(),
    getTranslations("horses"),
    getTranslations("home.healthTypes"),
  ]);
  const caller = await createServerCaller(tenantSlug);
  // El estado de cada animal sale de las mismas consultas que Reproducción y
  // Sanidad: la lista no tiene una versión propia de esas reglas.
  const [horses, access, repro, healthEvents] = await Promise.all([
    caller.horses.list(),
    getTenantAccess(tenantSlug, session?.user?.id),
    caller.reproduction.overview({}).catch(() => null),
    caller.health.list({}).catch(() => []),
  ]);
  const canExport =
    access.membership?.role === "OWNER" || access.membership?.role === "MANAGER";

  const phaseByMare = new Map(
    (repro?.tracked ?? []).map((m) => [m.mare.id, m.insight.phase] as const),
  );
  const healthByHorse = new Map<string, HorseRow["healthNote"]>();
  for (const { event, offset } of pendingHealthDue(healthEvents, { withinDays: HEALTH_AHEAD_DAYS })) {
    // pendingHealthDue va de más a menos urgente: el primero de cada caballo manda.
    if (healthByHorse.has(event.horse.id)) continue;
    const type = tHome(event.type as "OTHER");
    healthByHorse.set(event.horse.id, {
      overdue: offset < 0,
      label:
        offset < 0
          ? t("health.overdue", { type })
          : offset === 0
            ? t("health.today", { type })
            : t("health.soon", { type, days: offset }),
    });
  }

  const rows: HorseRow[] = horses.map((horse) => ({
    ...horse,
    phase: phaseByMare.get(horse.id),
    healthNote: healthByHorse.get(horse.id),
  }));
  const census = horses.filter((h) => h.status === "ACTIVE" || h.status === "IN_TRAINING").length;

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title={t("title")}
        description={t("description", { count: census })}
        actions={
          <>
            {horses.length > 0 && canExport && (
              <Button asChild variant="ghost" size="icon-lg" title={t("actions.export")} className="max-sm:hidden">
                <a
                  href={`/api/horses/export?tenant=${encodeURIComponent(tenantSlug)}`}
                  aria-label={t("actions.export")}
                >
                  <DownloadSimple weight="bold" />
                </a>
              </Button>
            )}
            {horses.length > 0 && (
              <Button asChild variant="outline" size="lg">
                <Link href={`/${tenantSlug}/caballos/pesaje`}>
                  <Scales weight="bold" />
                  {t("actions.weigh")}
                </Link>
              </Button>
            )}
            {/* Importar un Excel desde el móvil es raro: en el teléfono la
                cabecera se queda con lo del día (pesar y dar de alta). */}
            {horses.length > 0 && (
              <span className="max-sm:hidden">
                <HorseImportDialog />
              </span>
            )}
            <Button asChild size="lg">
              <Link href={`/${tenantSlug}/caballos/nuevo`}>
                <Plus weight="bold" />
                {t("actions.add")}
              </Link>
            </Button>
          </>
        }
      />

      <HorsesExplorer horses={rows} tenantSlug={tenantSlug} />
    </div>
  );
}
