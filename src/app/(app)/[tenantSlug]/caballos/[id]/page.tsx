import { createServerCaller } from "@/lib/trpc/server";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/router";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/formatters";
import { gestation, mareState, mareStateLabels, type MareState } from "@/lib/reproduction";
import { cn } from "@/lib/utils";
import { withdrawalStatus } from "@/lib/treatments";
import { BreedingRationCard } from "@/components/horses/breeding-ration-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";

const PedigreeTree = dynamic(() => import("@/components/horses/pedigree-tree").then((module) => module.PedigreeTree), { loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const HorseTimeline = dynamic(() => import("@/components/horses/timeline").then((module) => module.HorseTimeline), { loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const DailyJournalForm = dynamic(() => import("@/components/horses/daily-journal-form").then((module) => module.DailyJournalForm), { loading: () => <div className="h-48 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const JournalFeed = dynamic(() => import("@/components/horses/journal-feed").then((module) => module.JournalFeed), { loading: () => <div className="h-32 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const HorseChat = dynamic(() => import("@/components/horses/horse-chat").then((module) => module.HorseChat), { loading: () => <div className="h-96 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const DocumentsManager = dynamic(() => import("@/components/documentos/documents-manager").then((module) => module.DocumentsManager), { loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
const FeedingPlanCard = dynamic(() => import("@/components/horses/feeding-plan-card").then((module) => module.FeedingPlanCard), { loading: () => <div className="h-48 animate-pulse rounded-xl bg-muted/40" aria-busy="true" /> });
import {
  CaretLeft,
  PencilSimple,
  FilePdf,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string; id: string }>;
}

/** Los tipos salen del propio router: si cambia la consulta, esto se entera. */
type HorseDetail = inferRouterOutputs<AppRouter>["horses"]["byId"];
type ReproCycle = HorseDetail["reproCycles"][number];
type BadgeVariant = "success" | "secondary" | "destructive" | "outline" | "info" | "warning";

const statusLabels: Record<string, string> = {
  ACTIVE: "Activo",
  SOLD: "Vendido",
  DEAD: "Fallecido",
  RETIRED: "Retirado",
  IN_TRAINING: "En doma",
};

const statusBadgeVariant: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  SOLD: "secondary",
  DEAD: "destructive",
  RETIRED: "outline",
  IN_TRAINING: "info",
};

const sexLabels: Record<string, string> = {
  MALE: "Semental",
  FEMALE: "Yegua",
  GELDING: "Castrado",
};

/* El color del estado sale de las variantes del Badge: asi funciona igual en
   modo oscuro y no hay una paleta paralela por modulo. */
const mareStateVariant: Record<MareState, BadgeVariant> = {
  EMPTY: "warning",
  COVERED: "info",
  PREGNANT: "success",
  TWINS: "success",
  LOST: "destructive",
  FOALED: "secondary",
};

/* Pestañas de texto con subrayado: los iconos no ayudaban a distinguirlas. */
const tabTriggerClass = "shrink-0 flex-none px-3 py-2 text-[13.5px] font-semibold";

function calculateAge(birthDate: Date) {
  const diff = Date.now() - birthDate.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function Fact({
  label,
  children,
  hint,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "alert";
}) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <dt className="text-[12px] font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 truncate text-[15px] font-semibold text-foreground",
          tone === "alert" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {children}
      </dd>
      {hint && <dd className="mt-0.5 truncate text-[12px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-[13.5px] font-medium",
          value ? "text-foreground" : "text-muted-foreground/70",
          value && mono && "font-mono text-[13px] tracking-tight",
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export default async function CaballoDetailPage({ params }: PageProps) {
  const { tenantSlug, id } = await params;
  const caller = await createServerCaller(tenantSlug);

  let horse;
  try {
    horse = await caller.horses.byId({ id });
  } catch {
    notFound();
  }

  // Los documentos viven en su propio router porque la ficha grande no trae
  // las URLs firmadas: aqui se piden ya con enlace temporal resuelto.
  const [horseDocuments, horseHealth] = await Promise.all([
    caller.documents.list({ horseId: id }),
    caller.health.list({ horseId: id }),
  ]);

  // Tiempo de espera vigente: el tratamiento que libera más tarde manda.
  const activeWithdrawal = horseHealth
    .map((event) => ({ event, ...withdrawalStatus(event, horse) }))
    .filter((w) => w.status === "active" && w.until)
    .sort((a, b) => b.until!.getTime() - a.until!.getTime())[0];

  const age = horse.birthDate ? calculateAge(horse.birthDate) : null;
  const isMare = horse.sex === "FEMALE";

  // Racion orientativa: el estado de la yegua sale de su ultima cubricion y
  // su ultimo parto, sin que nadie tenga que configurarlo.
  const allCoverings = (horse.reproCycles ?? [])
    .flatMap((cycle) => cycle.coverings ?? [])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastCovering = allCoverings[0];
  const lastFoaling = allCoverings
    .map((c) => c.foaling)
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const lastState = mareState(lastCovering);
  const lastPregnant = lastState === "PREGNANT" || lastState === "TWINS";
  const lastGestation = lastPregnant && lastCovering ? gestation(lastCovering.date) : null;
  const rationInput = {
    sex: horse.sex,
    birthDate: horse.birthDate ? new Date(horse.birthDate) : null,
    weightKg: horse.vetProfile?.baseWeightKg ? Number(horse.vetProfile.baseWeightKg) : null,
    mare: {
      pregnant: lastPregnant,
      coveringDate: lastCovering ? new Date(lastCovering.date) : null,
      lastFoalingDate: lastFoaling ? new Date(lastFoaling.date) : null,
    },
  };

  // Lo proximo que vence (o que ya vencio) entre los ultimos eventos de salud.
  const nextDue = (horse.healthEvents ?? [])
    .filter((e): e is typeof e & { nextDueDate: Date } => Boolean(e.nextDueDate))
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())[0];
  const nextDueOverdue = nextDue ? new Date(nextDue.nextDueDate).getTime() < Date.now() : false;

  const ageLabel = age !== null ? `${age} ${age === 1 ? "año" : "años"}` : null;
  const metaLine = [sexLabels[horse.sex] ?? horse.sex, horse.breed, horse.coat, ageLabel]
    .filter(Boolean)
    .join(" · ");

  const parentLink = (parent: { id: string; name: string } | null | undefined) =>
    parent ? (
      <Link href={`/${tenantSlug}/caballos/${parent.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
        {parent.name}
      </Link>
    ) : (
      <span className="text-muted-foreground/70">desconocido</span>
    );

  return (
    <div className="w-full space-y-6 animate-in fade-in-0 duration-500">
      <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground">
        <Link href={`/${tenantSlug}/caballos`}>
          <CaretLeft weight="bold" />
          Caballos
        </Link>
      </Button>

      {/* CABECERA: quien es, de donde viene y lo que pide atencion */}
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-muted sm:size-28">
            {horse.photoUrl ? (
              <Image
                src={horse.photoUrl}
                alt={horse.name}
                fill
                sizes="112px"
                className="object-cover"
                priority
              />
            ) : (
              <div
                aria-hidden
                className="flex size-full items-center justify-center bg-primary/10 text-4xl font-bold text-primary-ink"
              >
                {horse.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-2xl font-bold text-foreground sm:text-[28px]">
                    {horse.name}
                  </h1>
                  <Badge variant={statusBadgeVariant[horse.status] ?? "secondary"}>
                    {statusLabels[horse.status] ?? horse.status}
                  </Badge>
                </div>
                {metaLine && <p className="mt-1 text-[14px] text-muted-foreground">{metaLine}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/horses/${id}/ficha-venta`} target="_blank" rel="noreferrer">
                    <FilePdf weight="bold" />
                    Ficha de venta
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${tenantSlug}/caballos/${id}/editar`}>
                    <PencilSimple weight="bold" />
                    Editar
                  </Link>
                </Button>
              </div>
            </div>

            {(horse.sire || horse.dam) && (
              <p className="mt-3 text-[13.5px] text-muted-foreground">
                {isMare ? "Hija de " : "Hijo de "}
                {parentLink(horse.sire)} y {parentLink(horse.dam)}
              </p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t border-border/70 bg-muted/30 sm:grid-cols-4 [&>div]:border-border/70 [&>div:nth-child(odd)]:border-r [&>div:nth-child(-n+2)]:border-b sm:[&>div]:border-r sm:[&>div]:border-b-0 sm:[&>div:last-child]:border-r-0">
          <Fact label="Nacimiento" hint={ageLabel ?? undefined}>
            {horse.birthDate ? formatDate(horse.birthDate) : "—"}
          </Fact>
          <Fact label="Ubicación">{horse.boxLocation || "Sin asignar"}</Fact>
          <Fact
            label={nextDueOverdue ? "Sanidad vencida" : "Próxima sanidad"}
            hint={nextDue?.name}
            tone={nextDueOverdue ? "alert" : undefined}
          >
            {nextDue ? formatDate(nextDue.nextDueDate) : "Nada pendiente"}
          </Fact>
          {isMare ? (
            <Fact
              label="Reproducción"
              hint={lastGestation ? `Parto previsto ${formatDate(lastGestation.expected)}` : undefined}
            >
              {lastCovering ? mareStateLabels[lastState] : "Sin cubriciones"}
            </Fact>
          ) : (
            <Fact label="Peso base">
              {horse.vetProfile?.baseWeightKg ? `${Number(horse.vetProfile.baseWeightKg)} kg` : "—"}
            </Fact>
          )}
        </dl>
      </Card>

      {activeWithdrawal && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-500/30 dark:bg-red-500/10"
        >
          <WarningCircle weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200">
              En tiempo de espera hasta el {formatDate(activeWithdrawal.until!)}
            </p>
            <p className="mt-0.5 text-red-800 dark:text-red-300">
              Por {activeWithdrawal.event.name} ({formatDate(activeWithdrawal.event.date)}). Hasta
              esa fecha no puede ir a sacrificio para consumo humano. Si en el pasaporte está
              excluido de consumo, márcalo en la ficha y este aviso desaparece.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="resumen" className="w-full gap-0">
        <div className="no-scrollbar -mx-4 overflow-x-auto border-b border-border/70 px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="min-w-max gap-2 pb-1">
            <TabsTrigger value="resumen" className={tabTriggerClass}>Resumen</TabsTrigger>
            <TabsTrigger value="genealogia" className={tabTriggerClass}>Genealogía</TabsTrigger>
            <TabsTrigger value="timeline" className={tabTriggerClass}>Historial</TabsTrigger>
            {isMare && (
              <TabsTrigger value="reproduccion" className={tabTriggerClass}>Reproducción</TabsTrigger>
            )}
            <TabsTrigger value="diario" className={tabTriggerClass}>Diario e IA</TabsTrigger>
            <TabsTrigger value="documentos" className={tabTriggerClass}>Documentos</TabsTrigger>
          </TabsList>
        </div>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="pt-6">
          <Card className="gap-0 py-0">
            <SectionHeader title="Identificación" />
            <dl className="grid gap-x-10 px-5 py-1.5 md:grid-cols-2 [&>div]:border-b [&>div]:border-border/50 [&>div:last-child]:border-b-0 md:[&>div:nth-last-child(2)]:border-b-0">
              <Field label="UELN" value={horse.uelnCode} mono />
              <Field label="Microchip" value={horse.microchip} mono />
              <Field label="Libro Genealógico" value={horse.lgNumber} mono />
              <Field label="Hierro" value={horse.hierro} />
              <Field label="Raza" value={horse.breed} />
              <Field label="Capa" value={horse.coat} />
              <Field label="Criador" value={horse.breeder?.name ?? "La yeguada"} />
              <Field label="Propietario" value={horse.owner?.name ?? "La yeguada"} />
            </dl>
          </Card>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            <FeedingPlanCard horseId={horse.id} horseName={horse.name} />
            <BreedingRationCard input={rationInput} />
          </div>
        </TabsContent>

        {/* GENEALOGIA */}
        <TabsContent value="genealogia" className="pt-6">
          <Card className="gap-0 py-0">
            <SectionHeader title="Árbol genealógico" description={`Ascendencia directa de ${horse.name}`} />
            <div className="flex justify-center overflow-x-auto p-5 sm:p-8">
              <PedigreeTree tenantSlug={tenantSlug} horseName={horse.name} sire={horse.sire} dam={horse.dam} />
            </div>
          </Card>
        </TabsContent>

        {/* HISTORIAL */}
        <TabsContent value="timeline" className="pt-6">
          <Card className="gap-0 py-0">
            <SectionHeader
              title="Historial"
              description={`Sanidad, entrenamientos y movimientos de ${horse.name}`}
              action={
                <>
                  <Button asChild size="sm" variant="ghost" className="hidden md:inline-flex">
                    <a href={`/api/horses/${id}/pdf-clinico`} target="_blank" rel="noreferrer">
                      <FilePdf weight="bold" />
                      Exportar PDF
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                    <Link href={`/${tenantSlug}/entrenamiento/nuevo?horseId=${id}`}>
                      <Plus weight="bold" />
                      Entrenamiento
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/${tenantSlug}/sanidad/nuevo?horseId=${id}`}>
                      <Plus weight="bold" />
                      Sanidad
                    </Link>
                  </Button>
                </>
              }
            />
            <div className="p-4 sm:p-6">
              <HorseTimeline horseId={id} />
            </div>
          </Card>
        </TabsContent>

        {/* REPRODUCCION (solo yeguas) */}
        {isMare && (
          <TabsContent value="reproduccion" className="pt-6">
            <Card className="gap-0 py-0">
              <SectionHeader
                title="Cuaderno de parideras"
                description="Ciclos reproductivos y ecografías"
                action={
                  <Button asChild size="sm">
                    <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo?mareId=${id}`}>
                      <Plus weight="bold" />
                      Iniciar ciclo
                    </Link>
                  </Button>
                }
              />

              {(!horse.reproCycles || horse.reproCycles.length === 0) ? (
                <p className="px-5 py-12 text-center text-[13.5px] text-muted-foreground">
                  Todavía no hay ciclos reproductivos registrados.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {horse.reproCycles.map((cycle: ReproCycle) => {
                    const latestCovering = cycle.coverings?.[0];
                    const latestCheck = latestCovering?.pregnancyChecks?.[0];

                    // Misma regla que el tablero y el Inicio.
                    const state = mareState(latestCovering);
                    const isPregnant = state === "PREGNANT" || state === "TWINS";
                    const g = isPregnant && latestCovering ? gestation(latestCovering.date) : null;

                    return (
                      <li key={cycle.id} className="flex flex-col gap-4 p-5">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[15px] font-semibold text-foreground">Temporada {cycle.season}</span>
                              <Badge variant={mareStateVariant[state]}>{mareStateLabels[state]}</Badge>
                            </div>

                            {latestCovering ? (
                              <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                                <div>
                                  <dt className="text-[12px] text-muted-foreground">Último salto</dt>
                                  <dd className="text-[13.5px] font-medium text-foreground">{formatDate(latestCovering.date)}</dd>
                                </div>
                                <div>
                                  <dt className="text-[12px] text-muted-foreground">Semental</dt>
                                  <dd className="text-[13.5px] font-medium text-foreground">{latestCovering.stallion?.name || "Desconocido"}</dd>
                                </div>
                                {latestCheck && (
                                  <div>
                                    <dt className="text-[12px] text-muted-foreground">Ecografía</dt>
                                    <dd className="text-[13.5px] font-medium text-foreground">{formatDate(latestCheck.date)}</dd>
                                  </div>
                                )}
                              </dl>
                            ) : (
                              <p className="mt-1 text-[13px] text-muted-foreground">Ciclo abierto, sin saltos registrados.</p>
                            )}
                          </div>

                          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                            <Link href={`/${tenantSlug}/reproduccion/${cycle.id}`}>Ver ciclo</Link>
                          </Button>
                        </div>

                        {g && (
                          <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                              <div>
                                <span className="text-[12px] font-medium text-muted-foreground">Gestación</span>
                                <div className="mt-0.5 flex items-baseline gap-1.5">
                                  <span className="text-2xl font-bold tabular-nums text-foreground">{g.days}</span>
                                  <span className="text-[13px] text-muted-foreground">de ~340 días</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="block text-[12px] font-medium text-muted-foreground">Parto previsto</span>
                                <span className="text-[15px] font-semibold text-foreground">{formatDate(g.expected)}</span>
                              </div>
                            </div>
                            <div
                              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary/15"
                              role="progressbar"
                              aria-valuenow={Math.round(g.percent)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label="Progreso de gestación"
                            >
                              <div className="h-full rounded-full bg-primary" style={{ width: `${g.percent}%` }} />
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </TabsContent>
        )}

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="pt-6">
          <DocumentsManager
            tenantId={horseDocuments.tenantId}
            documents={horseDocuments.documents}
            usage={horseDocuments.usage}
            horses={[{ id: horse.id, name: horse.name }]}
            lockedHorseId={horse.id}
            compact
          />
        </TabsContent>

        {/* DIARIO */}
        <TabsContent value="diario" className="pt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <DailyJournalForm horseId={horse.id} horseName={horse.name} />
              <div>
                <h2 className="mb-3 text-[15px] font-semibold text-foreground">Historial del diario</h2>
                <JournalFeed horseId={horse.id} />
              </div>
            </div>
            <div className="h-full">
              <HorseChat horseId={horse.id} horseName={horse.name} tenantSlug={tenantSlug} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
