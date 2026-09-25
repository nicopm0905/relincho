import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";
import { formatDate } from "@/lib/formatters";
import {
  RETENTION_YEARS,
  bookPeriod,
  bookPeriodOptions,
  describeMissing,
  missingBookFields,
  withdrawalEndDate,
  withdrawalStatus,
} from "@/lib/treatments";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { healthTypeLabels } from "@/lib/health-types";
import { EditHealthEventDialog } from "@/components/sanidad/edit-health-event-dialog";
import { BookOpenText, FilePdf } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ periodo?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Libro de tratamientos — ${tenantSlug}` };
}

export default function LibroTratamientosPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <LibroContent {...props} />
    </Suspense>
  );
}

type Book = Awaited<
  ReturnType<Awaited<ReturnType<typeof createServerCaller>>["health"]["treatmentBook"]>
>;
type Row = Book["treatments"][number];

function horseIdentity(horse: Row["horse"]) {
  if (horse.uelnCode) return `UELN ${horse.uelnCode}`;
  if (horse.microchip) return `Chip ${horse.microchip}`;
  return null;
}

function withdrawalText(row: Row) {
  if (row.withdrawalDays == null) return null;
  const days = `${row.withdrawalDays} ${row.withdrawalDays === 1 ? "día" : "días"}`;
  if (row.horse.excludedFromFoodChain) return `${days} · no aplica`;
  const end = withdrawalEndDate(row);
  return end ? `${days} · hasta ${formatDate(end)}` : days;
}

async function LibroContent({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const { periodo } = await searchParams;
  const period = bookPeriod(periodo);
  const caller = await createServerCaller(tenantSlug);

  // El propietario externo no tiene libro: la consulta le devuelve FORBIDDEN.
  const book = await caller.health
    .treatmentBook({ from: period.from, to: period.to })
    .catch(() => null);
  if (!book) notFound();

  const rows = book.treatments;
  const incomplete = rows.filter((row) => missingBookFields(row, row.horse).length > 0);
  const inWithdrawal = rows.filter((row) => withdrawalStatus(row, row.horse).status === "active");
  const pdfHref = `/api/sanidad/libro-tratamientos?tenant=${encodeURIComponent(tenantSlug)}&periodo=${period.key}`;

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        backHref={`/${tenantSlug}/sanidad`}
        backLabel="Sanidad"
        title="Libro de tratamientos"
        description={`Registro de medicamentos y visitas veterinarias (RD 666/2023, art. 41). Se conserva ${RETENTION_YEARS} años para inspección.`}
        actions={
          <Button asChild>
            <a href={pdfHref} target="_blank" rel="noreferrer">
              <FilePdf weight="bold" />
              Descargar PDF
            </a>
          </Button>
        }
      />

      <nav aria-label="Periodo del libro" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
        {bookPeriodOptions().map((option) => {
          const active = option.key === period.key;
          return (
            <Link
              key={option.key}
              href={`/${tenantSlug}/sanidad/libro?periodo=${option.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/80 bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tratamientos" value={rows.length} hint={period.label} />
        <StatCard
          label="Con datos pendientes"
          value={incomplete.length}
          hint={incomplete.length ? "Complétalos antes de imprimir" : "Todo en orden"}
          emphasis={incomplete.length > 0}
        />
        <StatCard label="En tiempo de espera" value={inWithdrawal.length} hint="Hoy" />
        <StatCard label="Visitas veterinarias" value={book.visits.length} hint={period.label} />
      </div>

      <section className="space-y-3">
        <SectionHeading
          title="Medicamentos administrados"
          description="Vacunas, desparasitaciones y tratamientos, por fecha de primera administración"
        />
        {rows.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                variant="plain"
                icon={<BookOpenText weight="duotone" />}
                title="Sin tratamientos en este periodo"
                description="Las vacunas, desparasitaciones y tratamientos que registres en Sanidad aparecen aquí solos."
              />
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const missing = missingBookFields(row, row.horse);
              const withdrawal = withdrawalStatus(row, row.horse);
              const identity = horseIdentity(row.horse);
              const wText = withdrawalText(row);
              return (
                <li
                  key={row.id}
                  className={cn(
                    "rounded-xl border bg-card p-4 shadow-bento",
                    missing.length > 0 ? "border-amber-300/70" : "border-border/80",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {row.name}
                        {row.batchNumber && (
                          <span className="font-normal text-muted-foreground"> · lote {row.batchNumber}</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.horse.name}
                        {identity ? ` · ${identity}` : ""}
                        {row.horse.excludedFromFoodChain ? " · excluido de consumo" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatDate(row.date)}
                      </span>
                      <EditHealthEventDialog event={row} />
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <Field label="Tipo" value={healthTypeLabels[row.type] ?? row.type} />
                    <Field label="Cantidad" value={row.dose} />
                    <Field
                      label="Duración"
                      value={row.durationDays ? `${row.durationDays} ${row.durationDays === 1 ? "día" : "días"}` : null}
                    />
                    <Field label="Tiempo de espera" value={wText} />
                    <Field label="Nº de receta" value={row.prescriptionNumber} />
                    <Field label="Veterinario" value={row.vet?.name} />
                    <Field label="Proveedor" value={row.supplier} />
                    <Field label="Factura / albarán" value={row.purchaseReference} />
                  </dl>

                  {(missing.length > 0 || withdrawal.status === "active") && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {withdrawal.status === "active" && withdrawal.until && (
                        <Badge variant="destructive">En espera hasta {formatDate(withdrawal.until)}</Badge>
                      )}
                      {missing.length > 0 && <Badge variant="warning">{describeMissing(missing)}</Badge>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Visitas veterinarias"
          description="En el PDF cada visita lleva un hueco para la firma manuscrita del veterinario"
        />
        {book.visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay revisiones veterinarias registradas en este periodo.
          </p>
        ) : (
          <ul className="divide-y divide-border/70 rounded-xl border border-border/80 bg-card">
            {book.visits.map((visit) => (
              <li key={visit.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{visit.name}</p>
                  <p className="text-muted-foreground">
                    {visit.horse.name}
                    {visit.vet ? ` · ${visit.vet.name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatDate(visit.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Si todos los datos constan en la receta, basta con anotar la fecha de la primera
        administración y el nº de receta, y guardar la copia. Relincho ayuda a llevar el registro,
        pero no sustituye el criterio de vuestro veterinario ni de la autoridad competente.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("break-words", value ? "text-foreground" : "text-muted-foreground/70")}>
        {value || "—"}
      </dd>
    </div>
  );
}
