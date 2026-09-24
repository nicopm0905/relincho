import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { CaretLeft, Baby, Horse, Syringe } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import {
  checkResultLabels,
  coveringResult,
  gestation,
  isPregnantResult,
  nextCheckpoint,
} from "@/lib/reproduction";
import {
  EditCoveringDialog,
  EditFoalingDialog,
  EditPregnancyCheckDialog,
} from "@/components/reproduction/repro-edit-dialogs";

const CreateCoveringDialog = dynamic(() => import("@/components/reproduction/create-covering-dialog").then((module) => module.CreateCoveringDialog), { loading: () => <div className="h-10 w-40 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const PregnancyCheckDialog = dynamic(() => import("@/components/reproduction/pregnancy-check-dialog").then((module) => module.PregnancyCheckDialog), { loading: () => <div className="h-9 w-28 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const FoalingDialog = dynamic(() => import("@/components/reproduction/foaling-dialog").then((module) => module.FoalingDialog), { loading: () => <div className="h-9 w-28 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });

interface PageProps {
  params: Promise<{ tenantSlug: string; cycleId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Detalle de Ciclo — ${tenantSlug}` };
}

function translateMethod(method: string) {
  const map: Record<string, string> = {
    NATURAL: "Monta Natural",
    AI_FRESH: "IA Fresca",
    AI_REFRIGERATED: "IA Refrigerada",
    AI_FROZEN: "IA Congelada",
    ET: "Transferencia Embrionaria",
  };
  return map[method] || method;
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

export default async function CycleDetailPage({ params }: PageProps) {
  const { tenantSlug, cycleId } = await params;
  const caller = await createServerCaller(tenantSlug);

  let cycle;
  try {
    cycle = await caller.reproduction.getCycleDetails({ cycleId });
  } catch {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${tenantSlug}/reproduccion`}>
              <CaretLeft weight="bold" className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
        <CreateCoveringDialog cycleId={cycle.id} />
      </div>

      {/* Mare Profile Header */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Horse weight="duotone" className="h-7 w-7 text-primary/40" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {cycle.mare.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Temporada {cycle.season}
              </p>
            </div>
          </div>
          {cycle.notes && (
            <p className="mt-4 text-sm text-muted-foreground bg-muted rounded-xl p-3">
              {cycle.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Historial del Ciclo
        </h2>

        {cycle.coverings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-card border border-border/60">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Syringe weight="duotone" className="h-8 w-8 text-muted-foreground/40" />
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
                      const g = gestation(covering.date);
                      const next = nextCheckpoint(covering.date, covering.pregnancyChecks.length);
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
