import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { CalendarCheck, Heartbeat } from "@phosphor-icons/react/dist/ssr";
import { MassHealthDialog } from "@/components/sanidad/mass-health-dialog";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

const typeLabels: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión vet.",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro",
};

export default async function SanidadPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const [events, upcoming, horses] = await Promise.all([
    caller.health.list({}),
    caller.health.upcoming({ days: 30 }),
    caller.horses.list(),
  ]);

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">Sanidad</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control veterinario y sanitario de tus caballos
          </p>
        </div>
        <MassHealthDialog horses={horses} tenantSlug={tenantSlug} />
      </div>

      {upcoming.length > 0 && (
        <Card className="border-amber-200/60 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck weight="fill" className="h-4 w-4 text-amber-600" />
              Próximos 30 días ({upcoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {upcoming.map((ev) => (
                <li key={ev.id} className="flex justify-between items-center py-2.5 border-b border-border/50 last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <CalendarCheck weight="fill" className="h-3.5 w-3.5 text-amber-700" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground">{ev.horse.name}</span>
                      <span className="mx-1.5 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{ev.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="warning">
                      {typeLabels[ev.type] ?? ev.type}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(ev.nextDueDate!)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de eventos ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Heartbeat weight="duotone" className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between gap-4 py-3 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Heartbeat weight="fill" className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate text-foreground">{ev.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ev.horse.name} · {typeLabels[ev.type] ?? ev.type}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-xs text-muted-foreground">
                    <div>{formatDate(ev.date)}</div>
                    {ev.nextDueDate && (
                      <div className="text-amber-600 font-medium">
                        Próx: {formatDate(ev.nextDueDate)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
