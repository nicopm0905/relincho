import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate } from "@/lib/formatters";
import { CalendarCheck, QrCode, Warning } from "@phosphor-icons/react/dist/ssr";
import { WeekStrip } from "@/components/rendimiento/week-strip";
import { MesocycleTimeline } from "@/components/rendimiento/mesocycle-timeline";
import { PlanActions } from "@/components/rendimiento/plan-actions";
import { ReportSessionDialog } from "@/components/rendimiento/report-session-dialog";
import { VetPanelDialog } from "@/components/rendimiento/vet-panel-dialog";
import { ChipPairing } from "@/components/rendimiento/chip-pairing";
import { RationCard } from "@/components/rendimiento/ration-card";
import { RationForecast } from "@/components/rendimiento/ration-forecast";
import {
  bufferStatusLabels,
  disciplineLabels,
  phaseLabels,
  workTypeLabels,
} from "@/components/rendimiento/labels";

interface PageProps {
  params: Promise<{ tenantSlug: string; horseId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { horseId, tenantSlug } = await params;
  try {
    const caller = await createServerCaller(tenantSlug);
    const horse = await caller.horses.byId({ id: horseId });
    return { title: `Rendimiento de ${horse.name}` };
  } catch {
    return { title: "Rendimiento" };
  }
}

export default async function PlanCaballoPage({ params }: PageProps) {
  const { tenantSlug, horseId } = await params;
  const caller = await createServerCaller(tenantSlug);

  const horse = await caller.horses.byId({ id: horseId }).catch(() => null);
  if (!horse) notFound();

  const [
    snapshot,
    vetProfile,
    baseline,
    chips,
    competitions,
    prescription,
    forecast,
  ] =
    await Promise.all([
      caller.performance.snapshot({ horseId }),
      caller.performance.getVetProfile({ horseId }),
      caller.nutrition.getBaseline({ horseId }),
      caller.performance.chipsByHorse({ horseId }),
      caller.performance.listCompetitions({ horseId }),
      caller.nutrition.getPrescription({ horseId, date: new Date() }),
      caller.nutrition.upcoming({ horseId, days: 10 }),
    ]);

  const daysToTarget = snapshot
    ? differenceInCalendarDays(snapshot.macrocycle.targetDate, new Date())
    : null;
  const today = snapshot?.today ?? null;
  const description = [
    vetProfile?.discipline ? disciplineLabels[vetProfile.discipline] : null,
    snapshot
      ? `${snapshot.macrocycle.competitionName ?? "Competición"} · ${formatDate(
          snapshot.macrocycle.targetDate,
        )}`
      : "Sin periodización activa",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        backHref={`/${tenantSlug}/rendimiento`}
        backLabel="Rendimiento"
        title={horse.name}
        description={description}
        actions={
          <>
            <VetPanelDialog
              horseId={horseId}
              horseName={horse.name}
              profile={vetProfile}
              baseline={baseline}
            />
            <PlanActions
              horseId={horseId}
              hasPlan={Boolean(snapshot)}
              discipline={vetProfile?.discipline ?? null}
              competitions={competitions.map((c) => ({
                id: c.id,
                name: c.name,
                targetDate: c.targetDate,
              }))}
            />
            {snapshot && (
              <ReportSessionDialog
                horseId={horseId}
                horseName={horse.name}
                plannedMinutes={today?.durationMinutes || 45}
                plannedRpe={today?.rpeTarget || 6}
              />
            )}
          </>
        }
      />

      {vetProfile?.tendonHistoryAlert && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/70 bg-amber-50/50 px-3.5 py-3">
          <Warning
            weight="fill"
            className="mt-px h-4 w-4 shrink-0 text-amber-600"
          />
          <p className="text-[13px] leading-relaxed text-amber-900">
            <span className="font-semibold">Historial de tendón.</span> La
            intensidad queda limitada a RPE {vetProfile.maxRpe ?? 8}
            {vetProfile.maxImpactSurfaceMinutes
              ? ` y el trabajo sobre superficie de impacto a ${vetProfile.maxImpactSurfaceMinutes} minutos por sesión.`
              : "."}
          </p>
        </div>
      )}

      {!snapshot ? (
        <EmptyState
          icon={<CalendarCheck weight="duotone" />}
          title="Este caballo no tiene periodización"
          description="Genera el plan indicando la competición objetivo. El calendario se construye hacia atrás desde esa fecha."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Fase actual"
              value={
                snapshot.currentMesocycle
                  ? phaseLabels[snapshot.currentMesocycle.phase]
                  : "—"
              }
              hint={
                snapshot.currentMicrocycle
                  ? `Semana ${snapshot.currentMicrocycle.weekNumber} del plan`
                  : undefined
              }
            />
            <StatCard
              label="Días para competir"
              value={daysToTarget != null && daysToTarget >= 0 ? daysToTarget : "—"}
              hint={snapshot.macrocycle.competitionName ?? undefined}
            />
            <StatCard
              label="Carga de la semana"
              value={`${snapshot.currentMicrocycle?.actualLoadUa ?? 0} UA`}
              hint={`De ${snapshot.currentMicrocycle?.plannedLoadUa ?? 0} UA planificadas`}
            />
            <StatCard
              label="Margen de recuperación"
              value={
                bufferStatusLabels[snapshot.currentMicrocycle?.bufferStatus ?? "idle"]
              }
              hint={`${snapshot.macrocycle.recoveryBufferPct}% de ajuste por día`}
              emphasis={snapshot.currentMicrocycle?.bufferStatus === "exhausted"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Microciclo en curso</CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot.week.length === 0 ? (
                <EmptyState
                  variant="plain"
                  title="Sin días planificados esta semana"
                  description="La fecha de hoy queda fuera del macrociclo activo."
                />
              ) : (
                <WeekStrip
                  horseId={horseId}
                  phase={snapshot.currentMesocycle?.phase}
                  days={snapshot.week.map((day) => ({
                    id: day.id,
                    date: day.date,
                    workType: day.workType,
                    rpeTarget: day.rpeTarget,
                    durationMinutes: day.durationMinutes,
                    plannedLoadUa: day.plannedLoadUa,
                    impactSurfaceMinutes: day.impactSurfaceMinutes,
                    status: day.status,
                    actualLoadUa: day.actualLoadUa,
                    adjustmentReason: day.adjustmentReason,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <Card>
              <CardHeader>
                <CardTitle>Mapa de la temporada</CardTitle>
              </CardHeader>
              <CardContent>
                <MesocycleTimeline mesocycles={snapshot.timeline} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ración de hoy</CardTitle>
              </CardHeader>
              <CardContent>
                <RationCard prescription={prescription} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dieta de los próximos días</CardTitle>
            </CardHeader>
            <CardContent>
              <RationForecast
                rows={forecast.map((row) => ({
                  id: row.id,
                  date: row.date,
                  workType: row.workType,
                  internalLoadUa: row.internalLoadUa,
                  forageKg: row.forageKg,
                  concentrateKg: row.concentrateKg,
                  extraConcentrateGrams: row.extraConcentrateGrams,
                  electrolytesGrams: row.electrolytesGrams,
                  totalMeals: row.totalMeals,
                  isProjection: row.isProjection,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identificación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  Cartel QR para la puerta del box
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Se imprime y se cuelga. La cámara del móvil abre esta ficha.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href={`/api/horses/qr-pdf?tenant=${tenantSlug}&horse=${horseId}`}>
                  <QrCode weight="bold" />
                  Descargar
                </a>
              </Button>
            </div>
            <ChipPairing horseId={horseId} chips={chips} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ficha deportiva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="divide-y divide-border/70">
              <div className="flex items-baseline justify-between gap-4 pb-2.5">
                <dt className="text-[13px] text-muted-foreground">Disciplina</dt>
                <dd className="text-[13px] font-medium text-foreground">
                  {vetProfile?.discipline
                    ? disciplineLabels[vetProfile.discipline]
                    : "Sin definir"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-muted-foreground">Peso base</dt>
                <dd className="text-[13px] font-medium tabular-nums text-foreground">
                  {vetProfile?.baseWeightKg
                    ? `${Number(vetProfile.baseWeightKg)} kg`
                    : "Sin definir"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-muted-foreground">Trabajo de hoy</dt>
                <dd className="text-[13px] font-medium text-foreground">
                  {today ? workTypeLabels[today.workType] : "Sin plan"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 pt-2.5">
                <dt className="text-[13px] text-muted-foreground">
                  Competiciones registradas
                </dt>
                <dd className="text-[13px] font-medium tabular-nums text-foreground">
                  {competitions.length}
                </dd>
              </div>
            </dl>
            <Button asChild variant="outline" size="sm">
              <Link href={`/${tenantSlug}/caballos/${horseId}`}>
                Ver ficha completa
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
