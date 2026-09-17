import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { ListRow, ListRows, RowIcon } from "@/components/ui/list-row";
import {
  Horse as HorseIcon,
  MagnifyingGlass,
  QrCode,
  CalendarCheck,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import {
  disciplineLabels,
  phaseBarColor,
  phaseLabels,
  workTypeShortLabels,
} from "@/components/rendimiento/labels";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Rendimiento — ${tenantSlug}` };
}

export default async function RendimientoPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const horses = await caller.performance.overview();

  const withPlan = horses.filter((h) => h.hasPlan);
  const withoutPlan = horses.filter((h) => !h.hasPlan);
  const workingToday = withPlan.filter(
    (h) => h.today && h.today.workType !== "DESCANSO",
  );
  const alerts = withPlan.filter(
    (h) => h.bufferStatus === "exhausted" || h.tendonHistoryAlert,
  );

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title="Rendimiento"
        description="Periodización por competición y prevención de lesiones"
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/horses/qr-pdf?tenant=${tenantSlug}`}>
                <QrCode weight="bold" />
                Carteles QR
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${tenantSlug}/escaner`}>
                <MagnifyingGlass weight="bold" />
                Buscar por chip
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Con plan activo"
          value={withPlan.length}
          hint={`De ${horses.length} caballos en activo`}
        />
        <StatCard
          label="Trabajan hoy"
          value={workingToday.length}
          hint="Según el microciclo en curso"
        />
        <StatCard
          label="Descansan hoy"
          value={withPlan.length - workingToday.length}
          hint="Descanso o sin carga prevista"
        />
        <StatCard
          label="Requieren atención"
          value={alerts.length}
          hint="Margen agotado o alerta de tendón"
          emphasis={alerts.length > 0}
        />
      </div>

      {horses.length === 0 ? (
        <EmptyState
          icon={<HorseIcon weight="duotone" />}
          title="Todavía no hay caballos en activo"
          description="Da de alta un caballo para empezar a planificar su temporada."
          action={
            <Button asChild>
              <Link href={`/${tenantSlug}/caballos/nuevo`}>Añadir caballo</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Planes activos</CardTitle>
          </CardHeader>
          <CardContent>
            {withPlan.length === 0 ? (
              <EmptyState
                variant="plain"
                icon={<CalendarCheck weight="duotone" />}
                title="Ningún caballo tiene periodización"
                description="Abre la ficha de un caballo y genera su plan hasta la próxima competición."
              />
            ) : (
              <ListRows>
                {withPlan.map((horse) => {
                  const daysToTarget = horse.targetDate
                    ? differenceInCalendarDays(horse.targetDate, new Date())
                    : null;
                  const needsAttention =
                    horse.bufferStatus === "exhausted" || horse.tendonHistoryAlert;

                  const subtitle = [
                    horse.discipline ? disciplineLabels[horse.discipline] : null,
                    horse.phase ? phaseLabels[horse.phase] : null,
                    horse.weekNumber ? `Semana ${horse.weekNumber}` : null,
                    horse.competitionName && daysToTarget != null && daysToTarget >= 0
                      ? `${horse.competitionName} en ${daysToTarget} días`
                      : horse.competitionName,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <ListRow
                      key={horse.horseId}
                      href={`/${tenantSlug}/rendimiento/${horse.horseId}`}
                      leading={
                        <RowIcon tone={needsAttention ? "alert" : "neutral"}>
                          {needsAttention ? (
                            <Warning weight="duotone" />
                          ) : (
                            <HorseIcon weight="duotone" />
                          )}
                        </RowIcon>
                      }
                      title={
                        <span className="flex items-center gap-2">
                          {horse.name}
                          {horse.phase && (
                            <span
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                phaseBarColor[horse.phase] ?? "bg-border",
                              )}
                              title={phaseLabels[horse.phase]}
                              aria-hidden
                            />
                          )}
                        </span>
                      }
                      subtitle={subtitle}
                      meta={
                        <>
                          {horse.bufferStatus === "exhausted" && (
                            <Badge variant="warning">Margen agotado</Badge>
                          )}
                          {horse.today ? (
                            <span className="hidden text-right sm:block">
                              <span className="block text-[12.5px] font-medium text-foreground">
                                {workTypeShortLabels[horse.today.workType] ??
                                  horse.today.workType}
                              </span>
                              {horse.today.workType !== "DESCANSO" && (
                                <span className="block text-[12px] tabular-nums text-muted-foreground">
                                  {horse.today.durationMinutes} min · Intensidad{" "}
                                  {horse.today.rpeTarget}/10
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="hidden sm:block">Sin carga hoy</span>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </ListRows>
            )}
          </CardContent>
        </Card>
      )}

      {withoutPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sin periodización</CardTitle>
          </CardHeader>
          <CardContent>
            <ListRows>
              {withoutPlan.map((horse) => (
                <ListRow
                  key={horse.horseId}
                  href={`/${tenantSlug}/rendimiento/${horse.horseId}`}
                  leading={
                    <RowIcon>
                      <HorseIcon weight="duotone" />
                    </RowIcon>
                  }
                  title={horse.name}
                  subtitle={
                    [
                      horse.discipline ? disciplineLabels[horse.discipline] : null,
                      horse.boxLocation,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin disciplina asignada"
                  }
                  meta={<span className="hidden sm:block">Planificar</span>}
                />
              ))}
            </ListRows>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
