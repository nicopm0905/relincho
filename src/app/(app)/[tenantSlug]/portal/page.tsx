import Link from "next/link";
import Image from "next/image";
import { createServerCaller } from "@/lib/trpc/server";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Horse,
  Heartbeat,
  Barbell,
  CalendarBlank,
} from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Portal — ${tenantSlug}` };
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

function ageLabel(birthDate: Date | null) {
  if (!birthDate) return "Edad desconocida";
  const years = Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
  );
  return `${years} ${years === 1 ? "año" : "años"}`;
}

export default async function PortalResumenPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);

  const [horses, agenda, balance] = await Promise.all([
    caller.portal.myHorses(),
    caller.portal.agenda(),
    caller.portal.balance(),
  ]);

  const events = [
    ...agenda.health.map((e) => ({
      id: `h-${e.id}`,
      date: new Date(e.nextDueDate ?? e.date),
      title: e.name,
      subtitle: `${e.horse.name} · ${healthTypeLabels[e.type] ?? e.type}`,
      icon: <Heartbeat className="h-4 w-4" />,
    })),
    ...agenda.trainings.map((t) => ({
      id: `t-${t.id}`,
      date: new Date(t.date),
      title: t.type || "Entrenamiento",
      subtitle: `${t.horse.name} · ${t.minutes} min`,
      icon: <Barbell className="h-4 w-4" />,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="animate-in fade-in-0 space-y-8 duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {horses.length === 1 ? "Mi caballo" : "Mis caballos"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Seguimiento de pupilaje: sanidad, entrenamiento y facturación.
        </p>
      </div>

      {/* Saldo actual */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Saldo actual
            </p>
            <p className="text-xs text-muted-foreground">
              Facturas emitidas y vencidas, menos lo ya pagado
            </p>
          </div>
          <p
            className={
              balance > 0
                ? "text-2xl font-bold text-amber-700"
                : "text-2xl font-bold text-emerald-700"
            }
          >
            {formatCurrency(balance)}
          </p>
        </CardContent>
      </Card>

      {/* Caballos */}
      <section className="space-y-3">
        {horses.length === 0 ? (
          <EmptyState
            icon={<Horse />}
            title="Todavía no hay caballos asignados"
            description="Cuando la yeguada te dé acceso a un caballo aparecerá aquí."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {horses.map((horse) => (
              <Link
                key={horse.id}
                href={`/${tenantSlug}/portal/caballos/${horse.id}`}
                className="group flex gap-4 overflow-hidden rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {horse.photoUrl ? (
                    <Image
                      src={horse.photoUrl}
                      alt=""
                      fill
                      sizes="5rem"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Horse
                       
                        className="h-7 w-7 text-muted-foreground/40"
                      />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {horse.name}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {horse.breed || "Sin raza"} · {ageLabel(horse.birthDate)}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    Box: {horse.boxLocation || "sin asignar"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Próximos eventos (60 días) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Próximos 60 días
        </h2>
        {events.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<CalendarBlank />}
            title="Sin eventos programados"
            description="No hay sanidad, herraje ni entrenamiento previstos en los próximos 60 días."
          />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {ev.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {ev.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ev.subtitle}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {formatDate(ev.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
