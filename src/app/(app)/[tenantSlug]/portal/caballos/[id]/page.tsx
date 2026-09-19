import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerCaller } from "@/lib/trpc/server";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Horse,
  Heartbeat,
  Barbell,
  CaretLeft,
  FilmSlate,
  Image as ImageIcon,
  FileText,
} from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string; id: string }>;
}

const healthTypeLabels: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión veterinaria",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro",
};

const sexLabels: Record<string, string> = {
  MALE: "Macho",
  FEMALE: "Hembra",
  GELDING: "Castrado",
};

const MEDIA_KINDS = new Set(["VIDEO", "PHOTO", "FOTO"]);

function ageLabel(birthDate: Date | null) {
  if (!birthDate) return "—";
  const years = Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
  );
  return `${years} ${years === 1 ? "año" : "años"}`;
}

export default async function PortalHorsePage({ params }: PageProps) {
  const { tenantSlug, id } = await params;
  const caller = await createServerCaller(tenantSlug);

  let horse;
  try {
    horse = await caller.portal.horseDetail({ horseId: id });
  } catch {
    notFound();
  }

  const now = Date.now();
  const upcomingHealth = horse.healthEvents
    .filter((e) => {
      const d = new Date(e.nextDueDate ?? e.date).getTime();
      return d >= now;
    })
    .sort(
      (a, b) =>
        new Date(a.nextDueDate ?? a.date).getTime() -
        new Date(b.nextDueDate ?? b.date).getTime(),
    );
  const pastHealth = horse.healthEvents.filter((e) => {
    const d = new Date(e.nextDueDate ?? e.date).getTime();
    return d < now;
  });

  const recentTrainings = horse.trainings.slice(0, 12);
  const mediaDocs = horse.documents.filter((d) =>
    MEDIA_KINDS.has(d.kind.toUpperCase()),
  );

  const facts: { label: string; value: string }[] = [
    { label: "Capa", value: horse.coat || "—" },
    { label: "Raza", value: horse.breed || "—" },
    { label: "Sexo", value: sexLabels[horse.sex] ?? horse.sex },
    { label: "Edad", value: ageLabel(horse.birthDate) },
    { label: "Box", value: horse.boxLocation || "Sin asignar" },
    {
      label: "Nacimiento",
      value: horse.birthDate ? formatDate(horse.birthDate) : "—",
    },
  ];

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300">
      <Link
        href={`/${tenantSlug}/portal`}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <CaretLeft weight="bold" className="h-4 w-4" />
        Volver
      </Link>

      {/* Ficha (solo lectura) */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative h-52 bg-muted sm:h-64">
          {horse.photoUrl ? (
            <Image
              src={horse.photoUrl}
              alt={horse.name}
              fill
              sizes="(min-width: 768px) 56rem, 100vw"
              className="object-cover"
              priority
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Horse weight="duotone" className="h-16 w-16 text-muted-foreground/30" />
            </span>
          )}
        </div>
        <div className="space-y-4 p-5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {horse.name}
          </h1>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {f.label}
                </dt>
                <dd className="text-sm font-medium text-foreground">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Próxima sanidad / herraje */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          <Heartbeat weight="bold" className="h-4 w-4" />
          Sanidad y herraje
        </h2>
        {horse.healthEvents.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<Heartbeat weight="duotone" />}
            title="Sin eventos de sanidad"
          />
        ) : (
          <div className="space-y-4">
            {upcomingHealth.length > 0 && (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
                {upcomingHealth.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {healthTypeLabels[e.type] ?? e.type}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant="outline">Próximo</Badge>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(e.nextDueDate ?? e.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {pastHealth.length > 0 && (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
                {pastHealth.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {healthTypeLabels[e.type] ?? e.type}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(e.date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Entrenamiento + notas del trabajo */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          <Barbell weight="bold" className="h-4 w-4" />
          Entrenamiento reciente
        </h2>
        {recentTrainings.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<Barbell weight="duotone" />}
            title="Sin sesiones registradas"
          />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {recentTrainings.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {t.type || "Entrenamiento"} · {t.minutes} min
                    {t.riderName ? ` · ${t.riderName}` : ""}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(t.date)}
                  </span>
                </div>
                {t.notes && (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Fotos y vídeos del trabajo */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          <FilmSlate weight="bold" className="h-4 w-4" />
          Fotos y vídeos
        </h2>
        {mediaDocs.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<ImageIcon weight="duotone" />}
            title="Todavía no hay fotos ni vídeos"
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {mediaDocs.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!d.url}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-foreground/20",
                    !d.url && "pointer-events-none opacity-60",
                  )}
                >
                  {d.kind.toUpperCase() === "VIDEO" ? (
                    <FilmSlate weight="duotone" className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ImageIcon weight="duotone" className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {d.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(d.createdAt)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Resto de documentos del caballo */}
      {horse.documents.filter((d) => !MEDIA_KINDS.has(d.kind.toUpperCase()))
        .length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            <FileText weight="bold" className="h-4 w-4" />
            Documentos
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {horse.documents
              .filter((d) => !MEDIA_KINDS.has(d.kind.toUpperCase()))
              .map((d) => (
                <li key={d.id}>
                  <a
                    href={d.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!d.url}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40",
                      !d.url && "pointer-events-none opacity-60",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {d.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {d.kind} · {formatDate(d.createdAt)}
                    </span>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
