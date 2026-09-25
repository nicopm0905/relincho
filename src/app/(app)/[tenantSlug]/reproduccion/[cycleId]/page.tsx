import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { Baby, Syringe, Warning, WarningCircle, Info } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/layout/page-header";
import {
  checkResultLabels,
  coveringResult,
  gestation,
  isPregnantResult,
  nextCheckpoint,
} from "@/lib/reproduction";
import {
  breedingWindow,
  seasonCategory,
  seasonCategoryLabels,
  type ParamSource,
  type SeasonCategory,
} from "@/lib/repro-engine";
import { COVERING_METHODS } from "@/lib/repro-settings";
import {
  cervixLabels,
  conditionLabels,
  corpusLuteumLabels,
  methodLabels,
  sideLabels,
  treatmentLabels,
  type ExamTreatment,
  type MareCondition,
} from "@/lib/repro-labels";
import { cn } from "@/lib/utils";
import {
  EditCoveringDialog,
  EditFoalingDialog,
  EditPregnancyCheckDialog,
} from "@/components/reproduction/repro-edit-dialogs";
import { ExamDialog } from "@/components/reproduction/exam-dialog";
import { MareProfileDialog } from "@/components/reproduction/mare-profile-dialog";
import { FollicleChart } from "@/components/reproduction/follicle-chart";
import { PhaseBadge } from "@/components/reproduction/phase-badge";

const CreateCoveringDialog = dynamic(() => import("@/components/reproduction/create-covering-dialog").then((module) => module.CreateCoveringDialog), { loading: () => <div className="h-10 w-40 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const PregnancyCheckDialog = dynamic(() => import("@/components/reproduction/pregnancy-check-dialog").then((module) => module.PregnancyCheckDialog), { loading: () => <div className="h-9 w-28 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const FoalingDialog = dynamic(() => import("@/components/reproduction/foaling-dialog").then((module) => module.FoalingDialog), { loading: () => <div className="h-9 w-28 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });

interface PageProps {
  params: Promise<{ tenantSlug: string; cycleId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Temporada reproductiva — ${tenantSlug}` };
}

function translateMethod(method: string) {
  return methodLabels[method] || method;
}

function translateResult(result: string | null) {
  if (!result) return checkResultLabels.PENDING;
  return checkResultLabels[result as keyof typeof checkResultLabels] ?? result;
}

function resultBadgeVariant(result: string | null): "warning" | "success" | "destructive" | "secondary" {
  if (!result) return "warning";
  if (result === "POSITIVE" || result === "TWINS") return "success";
  if (result === "NEGATIVE" || result === "REABSORBED" || result === "ABORTION") return "destructive";
  if (result === "PENDING") return "warning";
  return "secondary";
}

const when = (d: Date | string, withTime = true) => {
  const date = new Date(d);
  const hasTime = withTime && (date.getHours() !== 0 || date.getMinutes() !== 0);
  return format(date, hasTime ? "EEE d MMM, HH:mm" : "EEE d MMM", { locale: es });
};

const sourceLabel = (source: ParamSource, samples: number, unit: string) =>
  source === "manual"
    ? "fijado a mano"
    : source === "learned"
      ? `aprendido de ${samples} ${unit}`
      : "valor de la yeguada";

const basisLabels = {
  induction: "por inducción",
  follicle: "por crecimiento folicular",
  pgf: "por PGF2α",
} as const;

function Fact({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "warn" }) {
  return (
    <div className={cn("rounded-xl border p-3", tone === "warn" ? "border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-border bg-card")}>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function CycleDetailPage({ params }: PageProps) {
  const { tenantSlug, cycleId } = await params;
  const caller = await createServerCaller(tenantSlug);

  let cycle;
  try {
    cycle = await caller.reproduction.getCycleDetails({ cycleId });
  } catch {
    notFound();
  }

  const { insight, settings } = cycle;
  const p = insight.params;
  const category: SeasonCategory =
    (cycle.category as SeasonCategory | null) ?? seasonCategory(cycle.coverings, cycle.season);
  const now = new Date();

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        backHref={`/${tenantSlug}/reproduccion`}
        backLabel="Reproducción"
        title={cycle.mare.name}
        description={`Temporada ${cycle.season} · ${seasonCategoryLabels[category]}`}
        actions={
          <>
            <MareProfileDialog
              horseId={cycle.mareId}
              profile={cycle.profile}
              effective={{
                cycleLengthDays: p.cycleLengthDays,
                estrusLengthDays: p.estrusLengthDays,
                gestationDays: p.gestationDays,
                preovulatoryFollicleMm: p.preovulatoryFollicleMm,
              }}
            />
            <CreateCoveringDialog cycleId={cycle.id} />
            <ExamDialog cycleId={cycle.id} />
          </>
        }
      />

      {cycle.seasons.length > 1 && (
        <nav aria-label="Temporadas" className="flex flex-wrap gap-1.5">
          {cycle.seasons.map((s) => (
            <Link
              key={s.id}
              href={`/${tenantSlug}/reproduccion/${s.id}`}
              aria-current={s.id === cycle.id ? "page" : undefined}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[12.5px] font-medium",
                s.id === cycle.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.season}
            </Link>
          ))}
        </nav>
      )}

      {/* Situacion y predicciones */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={insight.phase} />
          {insight.lactating && <Badge variant="outline">Lactando</Badge>}
          {insight.lastExam && (
            <span className="text-[12.5px] text-muted-foreground">
              Última exploración: {when(insight.lastExam.date)}
              {insight.lastExam.follicleMm ? ` · folículo ${insight.lastExam.follicleMm} mm` : ""}
            </span>
          )}
        </div>

        {insight.alerts.length > 0 && (
          <ul className="space-y-2">
            {insight.alerts.map((a) => {
              const Icon = a.level === "danger" ? WarningCircle : a.level === "warning" ? Warning : Info;
              return (
                <li
                  key={a.key}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px]",
                    a.level === "danger" && "border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10",
                    a.level === "warning" && "border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",
                    a.level === "info" && "border-border bg-card",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  {a.message}
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {insight.ovulation && (
            <Fact
              label="Ovulación prevista"
              value={when(insight.ovulation.expected)}
              hint={`${basisLabels[insight.ovulation.basis]} · confianza ${insight.ovulation.confidence}${insight.ovulation.growthMmPerDay ? ` · ${insight.ovulation.growthMmPerDay} mm/día` : ""}`}
              tone={insight.ovulation.overdue ? "warn" : undefined}
            />
          )}
          {insight.nextEstrus && (
            <Fact
              label={insight.nextEstrus.basis === "pgf" ? "Celo inducido (PGF2α)" : "Próximo celo"}
              value={`${when(insight.nextEstrus.estrusFrom, false)} – ${when(insight.nextEstrus.estrusTo, false)}`}
              hint={`Ovulación ~${when(insight.nextEstrus.ovulation, false)}${insight.nextEstrus.extrapolated ? " · estimado sin datos recientes" : ""}`}
            />
          )}
          {insight.foalHeat && (
            <Fact
              label="Celo del potro"
              value={`${when(insight.foalHeat.from, false)} – ${when(insight.foalHeat.to, false)}`}
              hint={`Mejor fertilidad si ovula desde el ${when(insight.foalHeat.minOvulation, false)}`}
            />
          )}
          {insight.gestation && (
            <Fact
              label="Parto previsto"
              value={format(new Date(insight.gestation.expected), "d 'de' MMMM yyyy", { locale: es })}
              hint={`Día ${insight.gestation.days} · probable ${when(insight.gestation.windowFrom, false)} – ${when(insight.gestation.windowTo, false)}`}
              tone={insight.gestation.prolonged ? "warn" : undefined}
            />
          )}
          {insight.nextCheck && (
            <Fact
              label="Siguiente ecografía"
              value={insight.nextCheck.label}
              hint={`${when(insight.nextCheck.due, false)} – ${when(insight.nextCheck.limit, false)} (días ${insight.nextCheck.from}-${insight.nextCheck.to})`}
              tone={insight.nextCheck.overdue ? "warn" : undefined}
            />
          )}
          {insight.lastOvulation && !insight.gestation && (
            <Fact label="Última ovulación" value={when(insight.lastOvulation)} />
          )}
        </div>

        {insight.ovulation && !insight.ovulation.overdue && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Ventana de cubrición según el tipo de semen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-[13px]">
                {COVERING_METHODS.filter((m) => m !== "ET").map((m) => {
                  const w = breedingWindow(insight.ovulation!, m, settings);
                  const open = now >= w.from && now <= w.to;
                  return (
                    <li key={m} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className={cn(m === settings.defaultMethod && "font-semibold")}>{methodLabels[m]}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {when(w.from)} – {when(w.to)}
                        {open && <Badge variant="warning" className="ml-2">Abierta ahora</Badge>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Parametros de la yegua */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Parámetros de la yegua</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Ciclo estral" value={`${p.cycleLengthDays} días`} hint={sourceLabel(p.cycleSource, p.cycleSamples, "ciclos")} />
          <Fact label="Celo" value={`${p.estrusLengthDays} días`} hint={p.estrusSource === "manual" ? "fijado a mano" : "valor de la yeguada"} />
          <Fact label="Folículo preovulatorio" value={`${p.preovulatoryFollicleMm} mm`} hint={sourceLabel(p.follicleSource, p.follicleSamples, "ovulaciones")} />
          <Fact label="Gestación media" value={`${p.gestationDays} días`} hint={sourceLabel(p.gestationSource, p.gestationSamples, "partos")} />
        </div>
        {cycle.profile && (cycle.profile.conditions.length > 0 || cycle.profile.notes) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            {cycle.profile.conditions.map((c) => (
              <Badge key={c} variant="warning">{conditionLabels[c as MareCondition] ?? c}</Badge>
            ))}
            {cycle.profile.notes && <span className="text-muted-foreground">{cycle.profile.notes}</span>}
          </div>
        )}
      </section>

      {/* Seguimiento folicular */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Seguimiento folicular</h2>
        <Card>
          <CardContent className="pt-5">
            <FollicleChart exams={cycle.exams} coverings={cycle.coverings} thresholdMm={p.preovulatoryFollicleMm} />
          </CardContent>
        </Card>

        {cycle.exams.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[13.5px] text-muted-foreground">
            Sin exploraciones esta temporada. Registra recela, folículos y edema para predecir la ovulación y el
            momento de cubrir.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="border-b border-border text-left text-[12px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Recela</th>
                  <th className="px-3 py-2 font-medium">Izq.</th>
                  <th className="px-3 py-2 font-medium">Dcho.</th>
                  <th className="px-3 py-2 font-medium">Edema</th>
                  <th className="px-3 py-2 font-medium">CL</th>
                  <th className="px-3 py-2 font-medium">Cérvix</th>
                  <th className="px-3 py-2 font-medium">Líquido</th>
                  <th className="px-3 py-2 font-medium">Ovulación</th>
                  <th className="px-3 py-2 font-medium">Tratamientos</th>
                  <th className="px-3 py-2"><span className="sr-only">Editar</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...cycle.exams].reverse().map((e) => (
                  <tr key={e.id} className={cn(e.ovulated && "bg-amber-50/50 dark:bg-amber-500/5")}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{when(e.date)}</td>
                    <td className="px-3 py-2 tabular-nums">{e.teasingScore ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{e.leftFollicleMm ? `${e.leftFollicleMm} mm` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{e.rightFollicleMm ? `${e.rightFollicleMm} mm` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{e.uterineEdema ?? "—"}</td>
                    <td className="px-3 py-2">{e.corpusLuteum ? corpusLuteumLabels[e.corpusLuteum] : "—"}</td>
                    <td className="px-3 py-2">{e.cervix ? cervixLabels[e.cervix] : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{e.uterineFluidMm ? `${e.uterineFluidMm} mm` : "—"}</td>
                    <td className="px-3 py-2">
                      {e.ovulated ? `Sí${e.ovulationSide ? ` (${sideLabels[e.ovulationSide]})` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {e.treatments.length ? e.treatments.map((t) => treatmentLabels[t as ExamTreatment] ?? t).join(", ") : "—"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <ExamDialog cycleId={cycle.id} exam={e} trigger="icon" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Timeline */}
      <div className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Cubriciones
        </h2>

        {cycle.coverings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-card border border-border/60">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Syringe className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">
              Aún no hay cubriciones registradas
            </p>
          </div>
        ) : (
          <div className="relative ml-4 space-y-6 pb-4">
            {/* Timeline line */}
            <div className="absolute left-0 top-2 bottom-0 w-px bg-border" />

            {cycle.coverings.map((covering) => (
              <div key={covering.id} className="relative pl-8">
                {/* Timeline dot */}
                <span className="absolute left-[-5px] top-6 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3">
                        <span>
                          {format(new Date(covering.date), "dd MMM yyyy", { locale: es })}
                        </span>
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge variant={resultBadgeVariant(coveringResult(covering.pregnancyChecks))}>
                          {translateResult(coveringResult(covering.pregnancyChecks))}
                        </Badge>
                        <EditCoveringDialog
                          covering={{
                            id: covering.id,
                            date: covering.date,
                            method: covering.method,
                            stallionId: covering.stallionId,
                          }}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Details row */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Método</p>
                        <p className="font-medium">{translateMethod(covering.method)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Semental</p>
                        <p className="font-medium">{covering.stallion?.name || "—"}</p>
                      </div>
                    </div>

                    {!covering.foaling && (() => {
                      const pregnant = isPregnantResult(coveringResult(covering.pregnancyChecks));
                      const g = gestation(covering.date, now, { gestationDays: p.gestationDays, settings });
                      const next = nextCheckpoint(covering.date, covering.pregnancyChecks.length, now, settings.pregnancyCheckpoints);
                      const stillOpen =
                        coveringResult(covering.pregnancyChecks) === "PENDING" || coveringResult(covering.pregnancyChecks) === null || pregnant;
                      if (!pregnant && !(stillOpen && next)) return null;
                      return (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {pregnant && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
                              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">
                                Parto previsto
                              </p>
                              <p className="mt-1 font-semibold text-emerald-800">
                                {format(g.expected, "d 'de' MMMM yyyy", { locale: es })}
                              </p>
                              <p className="text-xs text-emerald-800/70">
                                Entre el {format(g.windowFrom, "d MMM", { locale: es })} y el{" "}
                                {format(g.windowTo, "d MMM", { locale: es })} · día {g.days} de gestación
                              </p>
                            </div>
                          )}
                          {stillOpen && next && (
                            <div
                              className={`rounded-xl border p-3 text-sm ${
                                next.overdue
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-border bg-muted/40 text-foreground"
                              }`}
                            >
                              <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                                Siguiente control
                              </p>
                              <p className="mt-1 font-semibold">{next.label}</p>
                              <p className="text-xs opacity-80">
                                {next.overdue ? "Pendiente desde el " : "Toca entre el "}
                                {format(next.due, "d MMM", { locale: es })}
                                {next.overdue ? "" : ` y el ${format(next.limit, "d MMM", { locale: es })}`}
                                {` (días ${next.from}-${next.to})`}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Pregnancy Checks */}
                    {covering.pregnancyChecks.length > 0 && (
                      <div className="border-t border-border/50 pt-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                          Ecografías
                        </p>
                        {covering.pregnancyChecks.map((check) => (
                          <div
                            key={check.id}
                            className="flex items-center justify-between text-sm bg-muted/50 rounded-xl px-4 py-2.5"
                          >
                            <span className="font-medium">
                              {format(new Date(check.date), "dd MMM yyyy", { locale: es })}
                            </span>
                            <div className="flex items-center gap-2">
                              {check.dayOfPregnancy && (
                                <span className="text-muted-foreground text-xs">
                                  Día {check.dayOfPregnancy}
                                </span>
                              )}
                              {(check.vesicleMm || check.heartbeat !== null) && (
                                <span className="text-muted-foreground text-xs">
                                  {[
                                    check.vesicleMm ? `vesícula ${check.vesicleMm} mm` : null,
                                    check.heartbeat === true ? "latido" : check.heartbeat === false ? "sin latido" : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              )}
                              <Badge variant={resultBadgeVariant(check.result)}>
                                {translateResult(check.result)}
                              </Badge>
                              <EditPregnancyCheckDialog
                                check={{
                                  id: check.id,
                                  date: check.date,
                                  result: check.result,
                                  dayOfPregnancy: check.dayOfPregnancy,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Foaling */}
                    {covering.foaling && (
                      <div className="border-t border-border/50 pt-4">
                        <div className="bg-primary/5 rounded-xl p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Baby weight="fill" className="h-4 w-4 text-primary-ink" />
                              Parto Registrado
                            </h4>
                            <EditFoalingDialog
                              foaling={{
                                id: covering.foaling.id,
                                date: covering.foaling.date,
                                sex: covering.foaling.sex,
                                alive: covering.foaling.alive,
                                notes: covering.foaling.notes,
                              }}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Fecha</p>
                              <p className="font-medium">
                                {format(new Date(covering.foaling.date), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Estado</p>
                              <p className="font-medium">
                                {covering.foaling.alive ? "Vivo ✓" : "Fallecido"}
                              </p>
                            </div>
                            {covering.foaling.sex && (
                              <div>
                                <p className="text-xs text-muted-foreground">Sexo</p>
                                <p className="font-medium">
                                  {covering.foaling.sex === "MALE" ? "Macho" : "Hembra"}
                                </p>
                              </div>
                            )}
                          </div>
                          {covering.foaling.notes && (
                            <p className="mt-3 text-xs text-muted-foreground bg-background rounded-lg p-2.5">
                              {covering.foaling.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Fase 2: plantillas PDF ANCCE prellenadas */}
                    <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/api/reproduction/covering/${covering.id}/solicitud-ancce`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Solicitud ANCCE (PDF)
                        </a>
                      </Button>
                      {covering.foaling && (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={`/api/reproduction/foaling/${covering.foaling.id}/comunicacion-nacimiento`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Comunicación de nacimiento (PDF)
                          </a>
                        </Button>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {!covering.foaling && (
                      <div className="flex gap-2 pt-2 justify-end">
                        <PregnancyCheckDialog coveringId={covering.id} />
                        {isPregnantResult(coveringResult(covering.pregnancyChecks)) && (
                          <FoalingDialog coveringId={covering.id} />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
