import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { createServerCaller } from "@/lib/trpc/server";
import {
  Horse,
  Heartbeat,
  CheckSquare,
  Plus,
  CaretRight,
  Sun,
  Warning,
  Baby,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";
import { gestation, mareState, nextCheckpoint } from "@/lib/reproduction";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListRows, RowIcon } from "@/components/ui/list-row";
import { SessionCheckIn } from "@/components/rendimiento/session-check-in";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { FirstSteps } from "@/components/onboarding/first-steps";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Inicio — ${tenantSlug}` };
}

const healthTypeLabels: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const formatEuros = (value: number) => euros.format(value);

/** "Vencía hace 3 días" / "Hoy" / "En 12 días" — relative beats a raw date
 *  when the whole point of the row is urgency. */
function dueLabel(due: Date, today: number) {
  const days = Math.round(
    (new Date(due).setHours(0, 0, 0, 0) - today) / DAY_MS,
  );
  if (days < -1) return { text: `Hace ${Math.abs(days)} días`, overdue: true };
  if (days === -1) return { text: "Ayer", overdue: true };
  if (days === 0) return { text: "Hoy", overdue: true };
  if (days === 1) return { text: "Mañana", overdue: false };
  return { text: `En ${days} días`, overdue: false };
}

export default function InicioPage({ params }: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <InicioContent params={params} />
    </Suspense>
  );
}

async function InicioContent({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);

  const [horses, upcomingHealth, cycles, openTasks, performance, pendingCheckIns, receivables] =
    await Promise.all([
      caller.horses.list(),
      caller.health.upcoming({ days: 30 }),
      caller.reproduction.listActiveCycles({}),
      caller.tasks.list({ done: false }),
      caller.performance.overview(),
      caller.performance.pendingCheckIns({}),
      // Facturacion es solo del personal: un veterinario externo ve el Inicio
      // sin cobros.
      caller.invoices.receivables().catch(() => null),
    ]);

  const now = new Date();
  const today = new Date().setHours(0, 0, 0, 0);

  const activeHorses = horses.filter((h) => h.status === "ACTIVE").length;
  const DAYS = (n: number) => n * DAY_MS;

  // Lo propio de una yeguada de cria: ecografias que tocan y partos cerca.
  const breeding = cycles.flatMap((cycle) => {
    const covering = cycle.coverings[0];
    if (!covering) return [];
    const state = mareState(covering);
    return [{ cycle, covering, state }];
  });
  const pregnant = breeding.filter((b) => b.state === "PREGNANT" || b.state === "TWINS");
  const pregnantMares = pregnant.length;

  const checksDue = breeding.flatMap(({ cycle, covering, state }) => {
    if (state !== "COVERED" && state !== "PREGNANT" && state !== "TWINS") return [];
    const next = nextCheckpoint(covering.date, covering._count.pregnancyChecks, now);
    // Solo lo que toca esta semana o ya va tarde.
    if (!next || next.due.getTime() > today + DAYS(7)) return [];
    return [{ cycle, next }];
  });

  const foalingsSoon = pregnant.flatMap(({ cycle, covering }) => {
    const g = gestation(covering.date, now);
    if (g.windowFrom.getTime() > today + DAYS(30)) return [];
    return [{ cycle, g }];
  });
  const foalingsIn60 = pregnant.filter(
    ({ covering }) => gestation(covering.date, now).windowFrom.getTime() <= today + DAYS(60),
  ).length;

  // One prioritised worklist instead of two parallel lists the user has to
  // cross-reference. Everything that has a date lands here, soonest first.
  const attention = [
    // Las alertas de rendimiento saltan de la ficha del caballo al inicio: un
    // tendon tocado es mas urgente que la mayoria de vencimientos sanitarios.
    ...performance
      .filter(
        (horse) =>
          horse.tendonHistoryAlert || horse.bufferStatus === "exhausted",
      )
      .map((horse) => ({
        id: `performance-${horse.horseId}`,
        due: new Date(today),
        title: horse.name,
        subtitle: [
          horse.tendonHistoryAlert ? "Historial de tendón" : null,
          horse.bufferStatus === "exhausted"
            ? "Margen de recuperación agotado"
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/${tenantSlug}/rendimiento/${horse.horseId}`,
        icon: <Warning weight="duotone" />,
      })),
    ...upcomingHealth
      .filter((event) => event.nextDueDate)
      .map((event) => ({
        id: `health-${event.id}`,
        due: new Date(event.nextDueDate!),
        title: event.name,
        subtitle: `${event.horse.name} · ${healthTypeLabels[event.type] ?? event.type}`,
        href: `/${tenantSlug}/sanidad`,
        icon: <Heartbeat weight="duotone" />,
      })),
    ...foalingsSoon.map(({ cycle, g }) => ({
      id: `foaling-${cycle.id}`,
      due: g.windowFrom,
      title: `Parto previsto · ${cycle.mare.name}`,
      subtitle: `Hacia el ${format(g.expected, "d 'de' MMMM", { locale: es })} · día ${g.days} de gestación`,
      href: `/${tenantSlug}/reproduccion/${cycle.id}`,
      icon: <Baby weight="duotone" />,
    })),
    ...checksDue.map(({ cycle, next }) => ({
      id: `check-${cycle.id}`,
      due: next.due,
      title: `${next.label} · ${cycle.mare.name}`,
      subtitle: `Días ${next.from}-${next.to} tras la cubrición`,
      href: `/${tenantSlug}/reproduccion/${cycle.id}`,
      icon: <Baby weight="duotone" />,
    })),
    ...(receivables?.overdue ?? []).map((invoice) => ({
      id: `invoice-${invoice.id}`,
      due: invoice.dueDate ? new Date(invoice.dueDate) : new Date(today),
      title: `Cobro vencido · ${invoice.client}`,
      subtitle: `Factura ${invoice.label} · ${formatEuros(invoice.pending)} pendientes`,
      href: `/${tenantSlug}/facturacion/${invoice.id}`,
      icon: <Receipt weight="duotone" />,
    })),
    ...openTasks
      .filter((task) => task.dueDate)
      .map((task) => ({
        id: `task-${task.id}`,
        due: new Date(task.dueDate),
        title: task.title,
        subtitle: [task.horseName, task.assigneeName].filter(Boolean).join(" · ") || "Tarea pendiente",
        href: `/${tenantSlug}/tareas`,
        icon: <CheckSquare weight="duotone" />,
      })),
  ].sort((a, b) => a.due.getTime() - b.due.getTime());

  const overdueCount = attention.filter(
    (item) => new Date(item.due).setHours(0, 0, 0, 0) <= today,
  ).length;

  const recentHorses = horses.filter((h) => h.status === "ACTIVE").slice(0, 6);

  return (
    <div className="animate-in fade-in-0 space-y-8 duration-300">
      <PageHeader
        title="Inicio"
        description={format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        actions={
          <>
            {horses.length > 0 && (
              <Button asChild variant="outline">
                <Link href={`/${tenantSlug}/sanidad/nuevo`}>
                  <Heartbeat weight="bold" />
                  Registrar sanidad
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href={`/${tenantSlug}/caballos/nuevo`}>
                <Plus weight="bold" />
                Añadir caballo
              </Link>
            </Button>
          </>
        }
      />

      {/* Una yeguada recién creada no necesita estadísticas: necesita saber
          por dónde empezar. */}
      {horses.length < 3 && <FirstSteps tenantSlug={tenantSlug} />}

      <SessionCheckIn sessions={pendingCheckIns} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Caballos activos"
          value={activeHorses}
          hint={`${horses.length} en total`}
          href={`/${tenantSlug}/caballos`}
        />
        <StatCard
          label="Requiere atención"
          value={overdueCount}
          hint={
            overdueCount === 0
              ? "Nada vencido"
              : "Vencido o para hoy"
          }
          emphasis={overdueCount > 0}
          // Lleva al motivo mas urgente: puede ser sanidad, una tarea o la
          // alerta de tendon de un caballo.
          href={attention[0]?.href}
        />
        <StatCard
          label="Yeguas preñadas"
          value={pregnantMares}
          hint={
            foalingsIn60 > 0
              ? `${foalingsIn60} ${foalingsIn60 === 1 ? "parto" : "partos"} en 60 días`
              : `${cycles.length} ciclos esta temporada`
          }
          href={`/${tenantSlug}/reproduccion`}
        />
        {receivables ? (
          <StatCard
            label="Pendiente de cobro"
            value={formatEuros(receivables.pendingTotal)}
            hint={
              receivables.overdue.length > 0
                ? `${receivables.overdue.length} ${receivables.overdue.length === 1 ? "factura vencida" : "facturas vencidas"}`
                : `${receivables.openCount} ${receivables.openCount === 1 ? "factura emitida" : "facturas emitidas"}`
            }
            emphasis={receivables.overdue.length > 0}
            href={`/${tenantSlug}/facturacion`}
          />
        ) : (
          <StatCard
            label="Tareas abiertas"
            value={openTasks.length}
            hint="Sin completar"
            href={`/${tenantSlug}/tareas`}
          />
        )}
      </div>

      <section className="space-y-3">
        <SectionHeading
          title="Requiere tu atención"
          description="Sanidad, ecografías, partos, cobros y tareas: lo más urgente primero"
          action={
            attention.length > 0 && (
              <Button asChild variant="ghost" size="sm">
                <Link href={attention[0].href}>
                  Resolver primero
                  <CaretRight weight="bold" />
                </Link>
              </Button>
            )
          }
        />
        {attention.length === 0 ? (
          <EmptyState
            icon={<Sun weight="duotone" />}
            title="Todo al día"
            description="No hay vencimientos, ecografías, partos cercanos ni cobros vencidos."
          />
        ) : (
          <ListRows>
            {attention.slice(0, 8).map((item) => {
              const due = dueLabel(item.due, today);
              return (
                <ListRow
                  key={item.id}
                  href={item.href}
                  leading={
                    <RowIcon tone={due.overdue ? "alert" : "neutral"}>
                      {item.icon}
                    </RowIcon>
                  }
                  title={item.title}
                  subtitle={item.subtitle}
                  meta={
                    <span
                      className={
                        due.overdue
                          ? "font-semibold text-amber-700"
                          : "text-muted-foreground"
                      }
                    >
                      {due.text}
                    </span>
                  }
                />
              );
            })}
          </ListRows>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Tu cuadra"
          description={`${activeHorses} ${activeHorses === 1 ? "caballo activo" : "caballos activos"}`}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${tenantSlug}/caballos`}>
                Ver todos
                <CaretRight weight="bold" />
              </Link>
            </Button>
          }
        />
        {recentHorses.length === 0 ? (
          <EmptyState
            icon={<Horse weight="duotone" />}
            title="Sin caballos aún"
            description="Registra tu primer caballo para empezar a llevar su sanidad y su documentación."
            action={
              <Button asChild>
                <Link href={`/${tenantSlug}/caballos/nuevo`}>
                  <Plus weight="bold" />
                  Añadir el primero
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recentHorses.map((horse) => (
              <Link
                key={horse.id}
                href={`/${tenantSlug}/caballos/${horse.id}`}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {horse.photoUrl ? (
                    <Image
                      src={horse.photoUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 12rem, 45vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Horse
                        weight="duotone"
                        className="h-7 w-7 text-muted-foreground/40"
                      />
                    </span>
                  )}
                </div>
                <div className="px-2.5 py-2">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {horse.name}
                  </p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {horse.breed || "Sin raza"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
