import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FilePdf,
  Info,
  Path,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { NewMovementDialog } from "@/components/movimientos/new-movement-dialog";
import {
  CaretakerDialog,
  DeleteRowButton,
  FarmSettingsForm,
  IncidentDialog,
  InspectionDialog,
  MarkNotifiedButton,
  OpenBookButton,
} from "@/components/movimientos/book-actions";
import { cn } from "@/lib/utils";
import {
  BREED_CODES,
  BREEDING_AGE_YEARS,
  CAUSE_CODES,
  CAUSE_LABELS,
  CENSUS_LABELS,
  DOCUMENT_TYPES,
  RETENTION_YEARS,
  SEX_CODES,
  SEX_LABELS,
  SPECIES_CODES,
  SPECIES_LABELS,
  breedCode,
  formatBookDate,
  presentAt,
  type AlertLevel,
  type CensusCategory,
  type DocumentType,
} from "@/lib/farm-book";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ ver?: string }>;
}

export async function generateMetadata() {
  return { title: "Libro de explotación" };
}

const SECTIONS = [
  { key: "registro", label: "Registro de altas y bajas" },
  { key: "animales", label: "Animales presentes" },
  { key: "censo", label: "Censo" },
  { key: "identificacion", label: "Incidencias de identificación" },
  { key: "inspecciones", label: "Inspecciones" },
  { key: "cuidadores", label: "Personas al cuidado" },
  { key: "explotacion", label: "Datos de la explotación" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

const INCIDENT_CAUSES: Record<string, string> = {
  PERDIDA: "Pérdida (A)",
  DETERIORO: "Deterioro (B)",
  OTRA_REGION: "Otra comunidad (C)",
  OTRA: "Otra",
};

const ALERT_STYLE: Record<AlertLevel, { icon: typeof Warning; className: string }> = {
  critical: { icon: WarningOctagon, className: "text-red-600" },
  warning: { icon: Warning, className: "text-amber-600" },
  info: { icon: Info, className: "text-blue-600" },
};

const day = (d: Date | null | undefined) => (d ? formatBookDate(new Date(d)) : "—");
const idLabel = (h: { uelnCode: string | null; microchip: string | null }) =>
  [h.uelnCode && `UELN ${h.uelnCode}`, h.microchip && `Chip ${h.microchip}`].filter(Boolean).join(" · ") ||
  "Sin identificar";

export default async function LibroExplotacionPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const { ver } = await searchParams;
  const section: SectionKey = SECTIONS.some((s) => s.key === ver) ? (ver as SectionKey) : "registro";

  const session = await getSession();
  const { membership } = await getTenantAccess(tenantSlug, session?.user?.id);
  if (!membership) notFound();
  const canEdit = membership.role === "OWNER" || membership.role === "MANAGER";

  const caller = await createServerCaller(tenantSlug);
  const book = await caller.farmBook.get().catch(() => null);
  if (!book) notFound();

  const now = new Date();
  const year = now.getUTCFullYear();
  const horseOptions = book.horses.map((h) => ({ id: h.id, name: h.name }));
  const horseById = new Map(book.horses.map((h) => [h.id, h]));
  const rowsDesc = [...book.rows].reverse();
  const thisYear = book.rows.filter((r) => new Date(r.date).getUTCFullYear() === year);
  const entries = thisYear.filter((r) => r.direction === "IN").length;
  const exits = thisYear.filter((r) => r.direction === "OUT").length;
  const urgent = book.alerts.filter((a) => a.level !== "info").length;
  const present = presentAt(book.rows, now);
  const lastEntry = new Map<string, (typeof book.rows)[number]>();
  for (const r of book.rows) if (r.direction === "IN") lastEntry.set(r.horseId, r);

  const regulation = book.andalusia
    ? "RD 804/2011 y Orden de 29/04/2015 de la Junta de Andalucía"
    : "Real Decreto 804/2011, anexo IV";

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title="Libro de explotación"
        description={`Registro de la explotación equina · ${regulation} · se conserva ${RETENTION_YEARS} años`}
        actions={
          <>
            <form action="/api/explotacion/libro" method="get" target="_blank" className="flex gap-2">
              <input type="hidden" name="tenant" value={tenantSlug} />
              <select
                name="periodo"
                aria-label="Periodo del PDF"
                defaultValue="3"
                className="h-9 rounded-xl border border-input bg-card px-2.5 text-sm"
              >
                <option value="3">Últimos 3 años</option>
                <option value="todo">Todo el libro</option>
                {[0, 1, 2].map((i) => (
                  <option key={i} value={String(year - i)}>
                    Año {year - i}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline">
                <FilePdf weight="bold" className="h-4 w-4" /> PDF para inspección
              </Button>
            </form>
            {canEdit && <NewMovementDialog horses={horseOptions} />}
          </>
        }
      />

      {book.horsesWithoutEntry.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-foreground">
            <span className="font-semibold">
              {book.horsesWithoutEntry.length === 1
                ? "1 caballo de la cuadra no está en el libro."
                : `${book.horsesWithoutEntry.length} caballos de la cuadra no están en el libro.`}
            </span>{" "}
            Si empiezas a llevarlo aquí, ábrelo y quedan anotados con causa A (apertura):{" "}
            {book.horsesWithoutEntry
              .slice(0, 6)
              .map((h) => h.name)
              .join(", ")}
            {book.horsesWithoutEntry.length > 6 ? "…" : "."}
          </p>
          {canEdit && <OpenBookButton pending={book.horsesWithoutEntry.length} />}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Censo hoy"
          value={book.census.today.total}
          hint={`${book.census.today.balance.females} hembras · ${book.census.today.balance.males} machos`}
        />
        <StatCard label={`Altas en ${year}`} value={entries} hint="Nacimientos, compras y retornos" />
        <StatCard label={`Bajas en ${year}`} value={exits} hint="Ventas, traslados y muertes" />
        <StatCard
          label="Avisos"
          value={urgent}
          hint={urgent ? "Plazos y datos que faltan" : "Todo en regla"}
          emphasis={urgent > 0}
        />
      </div>

      {/* Avisos de cumplimiento */}
      <Card>
        <CardHeader>
          <CardTitle>Lo que pide la ley y falta</CardTitle>
        </CardHeader>
        <CardContent>
          {book.alerts.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle weight="fill" className="h-4 w-4 text-green-600" />
              El libro está al día: ningún plazo pendiente ni datos que falten.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {book.alerts.map((alert) => {
                const style = ALERT_STYLE[alert.level];
                const Icon = style.icon;
                return (
                  <li key={alert.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-2.5">
                      <Icon weight="fill" className={cn("mt-0.5 h-4 w-4 shrink-0", style.className)} />
                      <div>
                        <p className="text-[13.5px] font-semibold text-foreground">{alert.title}</p>
                        <p className="text-[13px] text-muted-foreground">{alert.detail}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground/80">{alert.rule}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
                      {alert.dueDate && (
                        <Badge variant={alert.level === "critical" ? "destructive" : "warning"}>
                          Plazo {day(alert.dueDate)}
                        </Badge>
                      )}
                      {canEdit && alert.key.startsWith("death-") && alert.movementId && (
                        <MarkNotifiedButton movementId={alert.movementId} />
                      )}
                      {alert.key.startsWith("ident-") && alert.horseId && (
                        <Button asChild size="xs" variant="outline">
                          <Link href={`/${tenantSlug}/caballos/${alert.horseId}/editar`}>Añadir identificación</Link>
                        </Button>
                      )}
                      {alert.key === "farm-data" && (
                        <Button asChild size="xs" variant="outline">
                          <Link href={`/${tenantSlug}/movimientos?ver=explotacion`}>Completar</Link>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <nav aria-label="Hojas del libro" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={`/${tenantSlug}/movimientos?ver=${s.key}`}
            aria-current={section === s.key ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              section === s.key
                ? "border-transparent bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {section === "registro" && (
        <Card className="overflow-hidden">
          {rowsDesc.length === 0 ? (
            <CardContent className="pt-6">
              <EmptyState
                variant="plain"
                icon={<Path />}
                title="El libro está vacío"
                description="Ábrelo con los caballos que tienes hoy y anota cada alta y baja a partir de ahí."
              />
            </CardContent>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[60rem] text-left text-[13px]">
                <thead className="border-b border-border bg-muted/50 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Fecha</th>
                    <th scope="col" className="px-4 py-3">Animal</th>
                    <th scope="col" className="px-4 py-3">Causa</th>
                    <th scope="col" className="px-4 py-3">Procedencia / destino</th>
                    <th scope="col" className="px-4 py-3">Documento</th>
                    <th scope="col" className="px-4 py-3">Transporte</th>
                    <th scope="col" className="px-4 py-3 text-right">Balance H / M</th>
                    <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Editar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rowsDesc.map((row) => {
                    const horse = horseById.get(row.horseId);
                    const isEntry = row.direction === "IN";
                    return (
                      <tr key={row.id} className="align-top">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{day(row.date)}</td>
                        <td className="px-4 py-3">
                          <span className="block font-semibold text-foreground">{horse?.name ?? "—"}</span>
                          <span className="block font-mono text-[11.5px] text-muted-foreground">
                            {horse ? idLabel(horse) : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1",
                              isEntry ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700",
                            )}
                          >
                            {isEntry ? <ArrowRight weight="bold" /> : <ArrowLeft weight="bold" />}
                            {isEntry ? "Alta" : "Baja"} · {CAUSE_CODES[row.cause]}
                          </Badge>
                          <span className="mt-1 block text-[12px] text-muted-foreground">
                            {CAUSE_LABELS[row.cause]}
                            {row.inferred ? " (revisar)" : ""}
                          </span>
                          {row.missing.length > 0 && (
                            <span className="mt-1 block text-[11.5px] text-amber-700">Falta: {row.missing.join(", ")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px]">
                          {(isEntry ? row.originRega : row.destinationRega) || "—"}
                          {row.cause === "TRASLADO_PROVISIONAL" && row.expectedReturnDate && (
                            <span className="block font-sans text-[11.5px] text-muted-foreground">
                              Vuelta prevista {day(row.expectedReturnDate)}
                            </span>
                          )}
                          {row.cause === "MUERTE" && (
                            <span className="block font-sans text-[11.5px] text-muted-foreground">
                              {row.disposalMethod === "ENTERRAMIENTO"
                                ? `Enterrado: ${row.disposalPlace || "lugar sin anotar"}`
                                : row.disposalMethod === "RECOGIDA"
                                  ? "Recogida SANDACH"
                                  : ""}
                              {row.notifiedAt ? ` · comunicada ${day(row.notifiedAt)}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px]">
                          {row.documentNumber || "—"}
                          {row.documentType && (
                            <span className="block text-[11.5px] text-muted-foreground">
                              {DOCUMENT_TYPES[row.documentType as DocumentType] ?? row.documentType}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px]">
                          {row.transporterName || "—"}
                          {(row.vehiclePlate || row.transporterId) && (
                            <span className="block font-mono text-[11.5px] text-muted-foreground">
                              {[row.transporterId, row.vehiclePlate, row.trailerPlate].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {row.balance.females} / {row.balance.males}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {canEdit && (
                            <NewMovementDialog
                              horses={horseOptions}
                              movement={{
                                id: row.id,
                                horseId: row.horseId,
                                direction: row.direction,
                                date: row.date,
                                cause: row.cause,
                                originRega: row.originRega,
                                destinationRega: row.destinationRega,
                                reason: row.reason,
                                documentType: row.documentType,
                                documentNumber: row.documentNumber,
                                transporterName: row.transporterName,
                                transporterId: row.transporterId,
                                vehiclePlate: row.vehiclePlate,
                                trailerPlate: row.trailerPlate,
                                expectedReturnDate: row.expectedReturnDate,
                                disposalMethod: row.disposalMethod,
                                disposalPlace: row.disposalPlace,
                                notifiedAt: row.notifiedAt,
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {section === "animales" && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Animales presentes hoy ({present.size})</CardTitle>
          </CardHeader>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-[13px]">
              <thead className="border-y border-border bg-muted/50 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Animal</th>
                  <th scope="col" className="px-4 py-3">Identificación (DIE / microchip)</th>
                  <th scope="col" className="px-4 py-3">Especie</th>
                  <th scope="col" className="px-4 py-3">Sexo</th>
                  <th scope="col" className="px-4 py-3">Raza</th>
                  <th scope="col" className="px-4 py-3">Nacimiento</th>
                  <th scope="col" className="px-4 py-3">Propietario</th>
                  <th scope="col" className="px-4 py-3">Alta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {book.horses
                  .filter((h) => present.has(h.id))
                  .map((h) => {
                    const entry = lastEntry.get(h.id);
                    const code = breedCode(h.breed);
                    return (
                      <tr key={h.id}>
                        <td className="px-4 py-3 font-semibold">
                          <Link href={`/${tenantSlug}/caballos/${h.id}`} className="hover:underline">
                            {h.name}
                          </Link>
                        </td>
                        <td className={cn("px-4 py-3 font-mono text-[12px]", !h.uelnCode && !h.microchip && "text-red-700")}>
                          {idLabel(h)}
                        </td>
                        <td className="px-4 py-3">{SPECIES_CODES[h.species]} · {SPECIES_LABELS[h.species]}</td>
                        <td className="px-4 py-3">{SEX_CODES[h.sex]} · {SEX_LABELS[h.sex]}</td>
                        <td className="px-4 py-3">
                          {code}
                          <span className="block text-[11.5px] text-muted-foreground">
                            {code === "X" ? h.breed || "Sin raza" : BREED_CODES[code]}
                          </span>
                        </td>
                        <td className="px-4 py-3">{day(h.birthDate)}</td>
                        <td className="px-4 py-3">{h.owner?.name ?? book.farm.holderName}</td>
                        <td className="px-4 py-3">
                          {entry ? `${day(entry.date)} · ${CAUSE_CODES[entry.cause]}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {section === "censo" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { title: "Censo hoy", census: book.census.today },
            { title: `Censo a 31/12/${book.census.lastYear}`, census: book.census.lastYearEnd },
          ].map(({ title, census }) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{census.total}</p>
                <p className="text-sm text-muted-foreground">
                  {census.balance.females} hembras · {census.balance.males} machos
                </p>
                <dl className="mt-4 divide-y divide-border/70 text-[13px]">
                  {(Object.keys(CENSUS_LABELS) as CensusCategory[]).map((k) => (
                    <div key={k} className="flex justify-between py-2">
                      <dt className="text-muted-foreground">{CENSUS_LABELS[k]}</dt>
                      <dd className="font-semibold tabular-nums">{census.byCategory[k]}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
          <Card className="lg:col-span-2">
            <CardContent className="space-y-2 pt-6 text-[13px] text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">
                  Censo medio de {book.census.lastYear}: {book.census.lastYearAverage.toLocaleString("es-ES")} animales
                </span>{" "}
                (media de los presentes cada día del año).
              </p>
              {book.andalusia && (
                <p>
                  En Andalucía, el censo a 31 de diciembre se declara antes del 1 de marzo en la Oficina Comarcal
                  Agraria o por SIGGAN (Orden de 29/04/2015, art. 11.5).
                </p>
              )}
              <p>
                Criterio de las categorías: enteros de {BREEDING_AGE_YEARS} años o más, reproductores; menores de{" "}
                {BREEDING_AGE_YEARS}, reposición; castrados o sin fecha de nacimiento, otros. Revísalo antes de
                declararlo si algún animal no encaja.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {section === "identificacion" && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Incidencias en la identificación</CardTitle>
            {canEdit && (
              <IncidentDialog
                horses={book.horses.map((h) => ({ id: h.id, name: h.name, idLabel: h.uelnCode ?? h.microchip ?? "" }))}
              />
            )}
          </CardHeader>
          {book.incidents.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sin incidencias. Anota aquí la pérdida o el deterioro del microchip o del documento, o el cambio de
                identificación de un animal que llega de otra comunidad.
              </p>
            </CardContent>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[13px]">
                <thead className="border-y border-border bg-muted/50 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Fecha</th>
                    <th scope="col" className="px-4 py-3">Animal</th>
                    <th scope="col" className="px-4 py-3">Identificación anterior</th>
                    <th scope="col" className="px-4 py-3">Identificación nueva</th>
                    <th scope="col" className="px-4 py-3">Causa</th>
                    <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Borrar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {book.incidents.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-3">{day(i.date)}</td>
                      <td className="px-4 py-3 font-semibold">{i.horse.name}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">{i.previousId || "—"}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">{i.newId || "—"}</td>
                      <td className="px-4 py-3">
                        {INCIDENT_CAUSES[i.cause] ?? i.cause}
                        {i.duplicate ? " · DUPLICADO" : ""}
                      </td>
                      <td className="px-2 py-2 text-right">{canEdit && <DeleteRowButton kind="incident" id={i.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {section === "inspecciones" && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Inspecciones y controles</CardTitle>
            {canEdit && <InspectionDialog />}
          </CardHeader>
          {book.inspections.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sin inspecciones anotadas. El PDF lleva siempre una hoja con huecos para que el veterinario oficial
                anote y firme la comprobación del libro.
              </p>
            </CardContent>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-[13px]">
                <thead className="border-y border-border bg-muted/50 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Fecha</th>
                    <th scope="col" className="px-4 py-3">Motivo</th>
                    <th scope="col" className="px-4 py-3">Nº de acta</th>
                    <th scope="col" className="px-4 py-3">Actuante</th>
                    <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Borrar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {book.inspections.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-3">{day(i.date)}</td>
                      <td className="px-4 py-3">
                        {i.reason}
                        {i.notes && <span className="block text-[12px] text-muted-foreground">{i.notes}</span>}
                      </td>
                      <td className="px-4 py-3">{i.actNumber || "—"}</td>
                      <td className="px-4 py-3">{i.officialName || "—"}</td>
                      <td className="px-2 py-2 text-right">{canEdit && <DeleteRowButton kind="inspection" id={i.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {section === "cuidadores" && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Personas al cuidado de los animales</CardTitle>
            {canEdit && <CaretakerDialog />}
          </CardHeader>
          {book.caretakers.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                El libro tiene que identificar a quien cuida de los animales: mayoral y mozos.
              </p>
            </CardContent>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-[13px]">
                <thead className="border-y border-border bg-muted/50 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Nombre</th>
                    <th scope="col" className="px-4 py-3">DNI / NIE</th>
                    <th scope="col" className="px-4 py-3">Puesto</th>
                    <th scope="col" className="px-4 py-3">Teléfono</th>
                    <th scope="col" className="px-4 py-3">Periodo</th>
                    <th scope="col" className="w-20 px-2 py-3"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {book.caretakers.map((c) => (
                    <tr key={c.id} className={cn(c.endDate && "text-muted-foreground")}>
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">{c.documentId || "—"}</td>
                      <td className="px-4 py-3">{c.role || "—"}</td>
                      <td className="px-4 py-3">{c.phone || "—"}</td>
                      <td className="px-4 py-3">
                        {c.startDate ? `Desde ${day(c.startDate)}` : "—"}
                        {c.endDate ? ` hasta ${day(c.endDate)}` : ""}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {canEdit && (
                          <>
                            <CaretakerDialog caretaker={c} />
                            <DeleteRowButton kind="caretaker" id={c.id} />
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {section === "explotacion" && (
        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <Card>
            <CardHeader>
              <CardTitle>Titular</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <dl className="divide-y divide-border/70">
                {[
                  ["Titular", book.farm.holderName],
                  ["NIF", book.tenant.nif],
                  ["Código REGA", book.tenant.regaCode],
                  ["Dirección", [book.tenant.address, book.tenant.postalCode, book.tenant.city, book.tenant.province].filter(Boolean).join(", ")],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className={cn("text-right font-medium", !v && "text-amber-700")}>{v || "Falta"}</dd>
                  </div>
                ))}
              </dl>
              <Button asChild size="sm" variant="outline">
                <Link href={`/${tenantSlug}/ajustes`}>Editar en Ajustes</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Explotación</CardTitle>
            </CardHeader>
            <CardContent>
              <FarmSettingsForm
                canEdit={canEdit}
                value={{
                  farmName: book.settings?.farmName ?? null,
                  farmAddress: book.settings?.farmAddress ?? null,
                  farmMunicipality: book.settings?.farmMunicipality ?? null,
                  farmProvince: book.settings?.farmProvince ?? null,
                  latitude: book.settings?.latitude != null ? Number(book.settings.latitude) : null,
                  longitude: book.settings?.longitude != null ? Number(book.settings.longitude) : null,
                  holderPhone: book.settings?.holderPhone ?? null,
                  holderEmail: book.settings?.holderEmail ?? null,
                  legalRepName: book.settings?.legalRepName ?? null,
                  legalRepNif: book.settings?.legalRepNif ?? null,
                  adsg: book.settings?.adsg ?? null,
                  classification: book.settings?.classification ?? null,
                  capacity: book.settings?.capacity ?? null,
                  surfaceHa: book.settings?.surfaceHa != null ? Number(book.settings.surfaceHa) : null,
                  installationsM2: book.settings?.installationsM2 != null ? Number(book.settings.installationsM2) : null,
                  sanitaryQualification: book.settings?.sanitaryQualification ?? null,
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-[12px] text-muted-foreground">
        El libro puede llevarse en formato electrónico (RD 804/2011, art. 6.1) y debe estar disponible en la
        explotación para la autoridad competente durante al menos {RETENTION_YEARS} años desde la última anotación.
        {book.andalusia
          ? " En Andalucía también vale el emitido por SIGGAN; el PDF de Relincho sigue el modelo del anexo IV de la Orden de 29/04/2015."
          : " Consulta en tu comunidad autónoma si tiene un modelo propio aprobado."}
      </p>
    </div>
  );
}
