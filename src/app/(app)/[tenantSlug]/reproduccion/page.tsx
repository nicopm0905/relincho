import Link from "next/link";
import { Plus, Egg, GearSix, ChartBar, Drop } from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { ReproHub } from "@/components/reproduction/repro-hub";
import { StartSeasonButton } from "@/components/reproduction/start-season-button";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Reproducción — ${tenantSlug}` };
}

const DAY = 24 * 60 * 60 * 1000;

export default async function ReproductionPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const { tracked, untracked, season } = await caller.reproduction.overview({});

  const inHeat = tracked.filter((m) => m.insight.phase === "IN_HEAT").length;
  const covered = tracked.filter((m) => m.insight.phase === "COVERED").length;
  const pregnant = tracked.filter((m) => m.insight.gestation).length;
  const now = new Date().getTime();
  const foalingSoon = tracked.filter(
    (m) => m.insight.gestation && new Date(m.insight.gestation.windowFrom).getTime() <= now + 60 * DAY,
  ).length;
  const overdue = tracked.reduce((n, m) => n + m.insight.actions.filter((a) => a.overdue).length, 0);

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title="Reproducción"
        description={`Temporada ${season} · ${tracked.length} ${tracked.length === 1 ? "yegua" : "yeguas"} en seguimiento`}
        actions={
          <Button asChild>
            <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo`}>
              <Plus weight="bold" />
              Nueva temporada
            </Link>
          </Button>
        }
      />

      <nav aria-label="Reproducción" className="-mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-muted-foreground">
        {[
          { href: "estadisticas", label: "Estadísticas", Icon: ChartBar },
          { href: "semen", label: "Semen", Icon: Drop },
          { href: "ajustes", label: "Parámetros", Icon: GearSix },
        ].map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={`/${tenantSlug}/reproduccion/${href}`}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {untracked.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-muted-foreground">
            {untracked.length === 1
              ? `1 yegua activa sin temporada ${season}: `
              : `${untracked.length} yeguas activas sin temporada ${season}: `}
            <span className="text-foreground">
              {untracked
                .slice(0, 6)
                .map((m) => m.name)
                .join(", ")}
              {untracked.length > 6 ? "…" : ""}
            </span>
          </p>
          <StartSeasonButton season={season} count={untracked.length} />
        </div>
      )}

      {tracked.length === 0 ? (
        <EmptyState
          icon={<Egg />}
          title="Sin yeguas en seguimiento"
          description="Inicia la temporada de tus yeguas para registrar exploraciones, predecir celos y ovulaciones, y seguir cubriciones, gestaciones y partos."
          action={
            <Button asChild size="lg">
              <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo`}>
                <Plus weight="bold" />
                Iniciar una temporada
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="En celo" value={inHeat} />
            <StatCard label="Cubiertas pdte. eco" value={covered} />
            <StatCard label="Gestantes" value={pregnant} />
            <StatCard label="Partos en 60 días" value={foalingSoon} />
            <StatCard label="Tareas atrasadas" value={overdue} emphasis={overdue > 0} />
          </div>
          <ReproHub tracked={tracked} tenantSlug={tenantSlug} />
        </>
      )}
    </div>
  );
}
