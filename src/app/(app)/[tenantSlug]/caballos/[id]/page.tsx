import { createServerCaller } from "@/lib/trpc/server";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/router";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import Image from "next/image";
import { PedigreeTree } from "@/components/horses/pedigree-tree";
import { HorseTimeline } from "@/components/horses/timeline";
import { DailyJournalForm } from "@/components/horses/daily-journal-form";
import { JournalFeed } from "@/components/horses/journal-feed";
import { HorseChat } from "@/components/horses/horse-chat";
import { DocumentsManager } from "@/components/documentos/documents-manager";
import { FeedingPlanCard } from "@/components/horses/feeding-plan-card";
import {
  Horse,
  GenderMale,
  GenderFemale,
  GenderIntersex,
  CalendarBlank,
  IdentificationCard,
  Heartbeat,
  CaretLeft,
  PencilSimple,
  TreeStructure,
  MapPin,
  Files,
  Baby,
  WarningCircle,
  Clock,
  Sparkle
} from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string; id: string }>;
}

/** Los tipos salen del propio router: si cambia la consulta, esto se entera. */
type HorseDetail = inferRouterOutputs<AppRouter>["horses"]["byId"];
type ReproCycle = HorseDetail["reproCycles"][number];

const statusLabels: Record<string, string> = {
  ACTIVE: "Activo",
  SOLD: "Vendido",
  DEAD: "Fallecido",
  RETIRED: "Retirado",
  IN_TRAINING: "En doma",
};

const statusBadgeVariant: Record<string, "success" | "secondary" | "destructive" | "outline" | "info"> = {
  ACTIVE: "success",
  SOLD: "secondary",
  DEAD: "destructive",
  RETIRED: "outline",
  IN_TRAINING: "info",
};

/* One shared look for every tab so the strip stays even as tabs are added. */
const tabTriggerClass =
  "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-muted-foreground transition-all hover:text-foreground data-[state=active]:border data-[state=active]:border-border/40 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:px-4 sm:text-sm";

function calculateAge(birthDate: Date) {
  const diff = Date.now() - birthDate.getTime();
  const ageDate = new Date(diff); 
  return Math.abs(ageDate.getUTCFullYear() - 1970);
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
  const horseDocuments = await caller.documents.list({ horseId: id });

  const age = horse.birthDate ? calculateAge(horse.birthDate) : null;

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-500 w-full">
      {/* Top Nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="rounded-full -ml-3">
          <Link href={`/${tenantSlug}/caballos`}>
            <CaretLeft weight="bold" className="mr-1 h-4 w-4" />
            Atrás
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {/* Fase 2: ficha de venta */}
          <Button asChild variant="outline" size="sm" className="shadow-sm">
            <a href={`/api/horses/${id}/ficha-venta`} target="_blank" rel="noreferrer">
              Ficha de venta (PDF)
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="shadow-sm">
            <Link href={`/${tenantSlug}/caballos/${id}/editar`}>
              <PencilSimple weight="bold" className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* HERO SECTION */}
      <div className="relative flex h-[260px] flex-col justify-end overflow-hidden rounded-xl border border-border bg-card sm:h-[320px] md:h-[400px]">
        {horse.photoUrl ? (
          <Image
            src={horse.photoUrl}
            alt={horse.name}
            fill
            sizes="(min-width: 1024px) 64rem, 100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
            <Horse weight="duotone" className="h-32 w-32 text-primary/20" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        
        <div className="relative p-5 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
              <Badge variant={statusBadgeVariant[horse.status] ?? "secondary"} className="border-none shadow-sm backdrop-blur-md bg-white/20 text-white hover:bg-white/30 text-[10px] sm:text-xs">
                {statusLabels[horse.status] ?? horse.status}
              </Badge>
              {horse.breed && (
                <Badge variant="secondary" className="border-none shadow-sm backdrop-blur-md bg-white/20 text-white hover:bg-white/30 text-[10px] sm:text-xs">
                  {horse.breed}
                </Badge>
              )}
            </div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-white drop-shadow-md sm:text-4xl">
              {horse.name}
            </h1>
          </div>
          <div className="flex items-center justify-around sm:justify-start gap-4 text-white/90 bg-black/30 backdrop-blur-md px-4 py-3 sm:px-5 rounded-lg border border-white/15 w-full sm:w-auto">
            <div className="flex flex-col items-center flex-1 sm:flex-none">
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold opacity-80">Sexo</span>
              <span className="font-bold flex items-center gap-1 mt-0.5 text-sm sm:text-base">
                {horse.sex === "MALE" ? <GenderMale weight="bold" /> : horse.sex === "FEMALE" ? <GenderFemale weight="bold" /> : <GenderIntersex weight="bold" />}
                {horse.sex === "MALE" ? "Macho" : horse.sex === "FEMALE" ? "Hembra" : "Castr."}
              </span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="flex flex-col items-center flex-1 sm:flex-none">
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold opacity-80">Edad</span>
              <span className="font-bold flex items-center gap-1 mt-0.5 text-sm sm:text-base">
                <CalendarBlank weight="bold" />
                {age !== null ? `${age} a` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS SECTION */}
      <Tabs defaultValue="resumen" className="w-full">
        <div className="no-scrollbar -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-full sm:px-0">
          <TabsList className="inline-flex min-w-max gap-1 rounded-lg border border-border bg-muted/70 p-1">
            <TabsTrigger
              value="resumen"
              className={tabTriggerClass}
            >
              <IdentificationCard className="h-4 w-4" weight="bold" />
              Resumen
            </TabsTrigger>
            <TabsTrigger
              value="genealogia"
              className={tabTriggerClass}
            >
              <TreeStructure className="h-4 w-4" weight="bold" />
              Genealogía
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className={tabTriggerClass}
            >
              <Clock className="h-4 w-4" weight="bold" />
              Línea de Tiempo
            </TabsTrigger>
            <TabsTrigger
              value="reproduccion"
              className={tabTriggerClass}
            >
              <Baby className="h-4 w-4" weight="bold" />
              Reproducción
            </TabsTrigger>
            <TabsTrigger
              value="diario"
              className={tabTriggerClass}
            >
              <Sparkle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" weight="fill" />
              Diario e IA
            </TabsTrigger>
            <TabsTrigger
              value="documentos"
              className={tabTriggerClass}
            >
              <Files className="h-4 w-4" weight="bold" />
              Documentación
            </TabsTrigger>
          </TabsList>
        </div>

        {/* RESUMEN TAB */}
        <TabsContent value="resumen" className="pt-6 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="p-6 border-border bg-card">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <IdentificationCard weight="duotone" className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Identificación</h3>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">UELN</span>
                  <span className="font-mono text-sm font-medium bg-muted/50 px-3 py-2 rounded-lg border border-border/50">
                    {horse.uelnCode || "No registrado"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Microchip</span>
                  <span className="font-mono text-sm font-medium bg-muted/50 px-3 py-2 rounded-lg border border-border/50">
                    {horse.microchip || "No registrado"}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border bg-card">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <MapPin weight="duotone" className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Ubicación y Físico</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm font-medium text-muted-foreground">Ubicación (Box)</span>
                  <span className="font-semibold text-foreground">{horse.boxLocation || "Sin asignar"}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm font-medium text-muted-foreground">Capa</span>
                  <span className="font-semibold text-foreground">{horse.coat || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-muted-foreground">Fecha de Nacimiento</span>
                  <span className="font-semibold text-foreground">{horse.birthDate ? formatDate(horse.birthDate) : "—"}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-5">
            <FeedingPlanCard horseId={horse.id} horseName={horse.name} />
          </div>
        </TabsContent>

        {/* GENEALOGIA TAB */}
        <TabsContent value="genealogia" className="pt-6 outline-none">
          <Card className="p-8 border-border bg-card">
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                <TreeStructure weight="duotone" className="h-6 w-6" />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Árbol Genealógico</h3>
              <p className="text-sm text-muted-foreground mt-1">Ascendencia directa de {horse.name}</p>
            </div>
            
            <div className="flex justify-center -mx-8">
              <PedigreeTree tenantSlug={tenantSlug} horseName={horse.name} sire={horse.sire} dam={horse.dam} />
            </div>
          </Card>
        </TabsContent>

        {/* TIMELINE TAB */}
        <TabsContent value="timeline" className="pt-6 outline-none">
          <Card className="p-0 border-border bg-card overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/40 flex items-center justify-between bg-muted/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <Heartbeat weight="duotone" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Línea de Tiempo</h3>
                  <p className="text-xs text-muted-foreground hidden sm:block">Todos los eventos de {horse.name}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="hidden shadow-sm md:flex">
                  <a href={`/api/horses/${id}/pdf-clinico`} target="_blank" rel="noreferrer">Exportar PDF</a>
                </Button>
                <Button asChild size="sm" className="rounded-full shadow-sm">
                  <Link href={`/${tenantSlug}/sanidad/nuevo?horseId=${id}`}>+ Salud</Link>
                </Button>
                <Button asChild size="sm" variant="secondary" className="rounded-full shadow-sm hidden sm:flex">
                  <Link href={`/${tenantSlug}/entrenamiento/nuevo?horseId=${id}`}>+ Entrenam.</Link>
                </Button>
              </div>
            </div>
            
            <div className="p-4 sm:p-8">
              <HorseTimeline horseId={id} />
            </div>
          </Card>
        </TabsContent>

        {/* REPRODUCCION TAB */}
        <TabsContent value="reproduccion" className="pt-6 outline-none">
          {horse.sex !== "FEMALE" ? (
            <Card className="p-12 border-border bg-card flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-100">
                <WarningCircle weight="duotone" className="h-8 w-8" />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">No aplicable</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
                El módulo de parideras está diseñado para la gestión de yeguas.
              </p>
            </Card>
          ) : (
            <Card className="p-0 border-border bg-card overflow-hidden">
              <div className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                    <Baby weight="duotone" className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Cuaderno de Parideras</h3>
                    <p className="text-xs text-muted-foreground">Ciclos reproductivos y ecografías</p>
                  </div>
                </div>
                <Button asChild size="sm" className="rounded-full shadow-sm">
                  <Link href={`/${tenantSlug}/reproduccion/nuevo-ciclo?mareId=${id}`}>Iniciar Ciclo</Link>
                </Button>
              </div>

              <div className="p-0">
                {(!horse.reproCycles || horse.reproCycles.length === 0) ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                    <Baby weight="duotone" className="h-12 w-12 text-muted/30 mb-3" />
                    <p className="text-sm font-medium">No hay ciclos reproductivos registrados</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {horse.reproCycles.map((cycle: ReproCycle) => {
                      const latestCovering = cycle.coverings?.[0];
                      const latestCheck = latestCovering?.pregnancyChecks?.[0];
                      
                      let status = "En Celo / Vacía";
                      let statusColor = "bg-amber-100 text-amber-700 border-amber-200";
                      let isPregnant = false;
                      let daysPregnant = 0;
                      let expectedFoalingDate: Date | null = null;
                      let progressPercent = 0;
                      
                      if (latestCovering?.foaling) {
                        status = "Parida";
                        statusColor = "bg-blue-100 text-blue-700 border-blue-200";
                      } else if (latestCheck?.result === "POSITIVE") {
                        status = "Preñada";
                        statusColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
                        isPregnant = true;
                        
                        // Gestación de ~340 días
                        const coveringDate = new Date(latestCovering.date);
                        expectedFoalingDate = new Date(coveringDate);
                        expectedFoalingDate.setDate(expectedFoalingDate.getDate() + 340);
                        
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - coveringDate.getTime());
                        daysPregnant = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        progressPercent = Math.min(100, Math.max(0, Math.round((daysPregnant / 340) * 100)));
                      } else if (latestCovering && (!latestCheck || latestCheck.result === "PENDING")) {
                         status = "Cubierta (Pdte. Eco)";
                         statusColor = "bg-purple-100 text-purple-700 border-purple-200";
                      }

                      return (
                        <li key={cycle.id} className="flex flex-col p-4 sm:p-6 hover:bg-muted/10 transition-colors gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-bold text-base text-foreground">Temporada {cycle.season}</span>
                                <Badge variant="outline" className={`text-xs font-semibold ${statusColor}`}>
                                  {status}
                                </Badge>
                              </div>
                              
                              {latestCovering ? (
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-sm">
                                  <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Último Salto</span>
                                    <span className="font-medium text-foreground">{formatDate(latestCovering.date)}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Semental</span>
                                    <span className="font-medium text-foreground">{latestCovering.stallion?.name || "Desconocido"}</span>
                                  </div>
                                  {latestCheck && (
                                    <div className="flex flex-col">
                                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ecografía</span>
                                      <span className="font-medium text-foreground">{formatDate(latestCheck.date)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground mt-1">Ciclo abierto, sin saltos registrados.</p>
                              )}
                            </div>
                            
                            <div className="shrink-0 flex sm:flex-col items-center gap-2">
                              <Button asChild variant="outline" size="sm" className="rounded-full shadow-sm w-full sm:w-auto">
                                <Link href={`/${tenantSlug}/reproduccion/${cycle.id}`}>
                                  Ver Detalles
                                </Link>
                              </Button>
                            </div>
                          </div>

                          {/* GESTATION PROGRESS WIDGET */}
                          {isPregnant && expectedFoalingDate && (
                            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                              <div className="flex justify-between items-end mb-2">
                                <div>
                                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Progreso de Gestación</span>
                                  <div className="flex items-baseline gap-2 mt-0.5">
                                    <span className="text-2xl font-black text-emerald-700">{daysPregnant}</span>
                                    <span className="text-sm font-medium text-emerald-700/80">días</span>
                                    <span className="text-emerald-300 mx-1">/</span>
                                    <span className="text-sm font-medium text-emerald-700/80">340 aprox.</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70 block">Fecha Prevista Parto (FPP)</span>
                                  <span className="font-bold text-emerald-800 bg-white/60 px-2 py-0.5 rounded-md mt-1 inline-block">
                                    {formatDate(expectedFoalingDate)}
                                  </span>
                                </div>
                              </div>
                              <div className="h-3 w-full bg-emerald-200/50 rounded-full overflow-hidden shadow-inner mt-3">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out relative"
                                  style={{ width: `${progressPercent}%` }}
                                >
                                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                </div>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-emerald-600/70 mt-1.5 uppercase px-1">
                                <span>Monta</span>
                                <span>Paridera</span>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* DOCUMENTOS TAB */}
        <TabsContent value="documentos" className="pt-6 outline-none">
          <DocumentsManager
            tenantId={horseDocuments.tenantId}
            documents={horseDocuments.documents}
            usage={horseDocuments.usage}
            horses={[{ id: horse.id, name: horse.name }]}
            lockedHorseId={horse.id}
            compact
          />
        </TabsContent>

        {/* DIARIO TAB */}
        <TabsContent value="diario" className="pt-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Izquierda: Diario */}
            <div className="space-y-6">
              <DailyJournalForm horseId={horse.id} horseName={horse.name} />
              <div className="mt-8">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground mb-4">Historial del Diario</h3>
                <JournalFeed horseId={horse.id} />
              </div>
            </div>
            
            {/* Derecha: Chat interactivo */}
            <div className="h-full">
              <HorseChat
                horseId={horse.id}
                horseName={horse.name}
                tenantSlug={tenantSlug}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
