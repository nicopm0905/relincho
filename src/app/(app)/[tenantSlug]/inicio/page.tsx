import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Horse, Heartbeat, Baby, CalendarCheck, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { formatDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Inicio — ${tenantSlug}` };
}

const typeLabels: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro",
};

export default async function InicioPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  
  const [horses, upcomingHealth] = await Promise.all([
    caller.horses.list(),
    caller.health.upcoming({ days: 30 }),
  ]);

  const activeHorses = horses.filter(h => h.status === 'ACTIVE').length;

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-heading">
          Resumen Diario
        </h1>
        <p className="mt-1 text-[15px] font-medium text-muted-foreground">
          Un vistazo rápido al estado de tu yeguada
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-bento border-border/40 bg-white hover:border-border/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-muted-foreground">Caballos Activos</CardTitle>
            <div className="h-10 w-10 bg-primary/5 rounded-xl flex items-center justify-center">
              <Horse weight="duotone" className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-heading text-foreground">{activeHorses}</div>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              De {horses.length} registrados
            </p>
          </CardContent>
        </Card>
        
        <Card className="shadow-bento border-border/40 bg-white hover:border-border/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-muted-foreground">Alertas Sanitarias</CardTitle>
            <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Heartbeat weight="duotone" className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-heading text-foreground">{upcomingHealth.length}</div>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Próximos 30 días
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-bento border-border/40 bg-white hover:border-border/60 transition-colors opacity-70">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-muted-foreground">Parideras Activas</CardTitle>
            <div className="h-10 w-10 bg-pink-50 rounded-xl flex items-center justify-center">
              <Baby weight="duotone" className="h-5 w-5 text-pink-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-heading text-foreground">0</div>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Próximamente
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-bento border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <WarningCircle weight="duotone" className="h-5 w-5 text-amber-500" />
              Sanidad Pendiente
            </CardTitle>
            <CardDescription>
              Tratamientos, vacunas o herrajes programados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingHealth.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground font-medium">Todo al día. No hay alertas sanitarias.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingHealth.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                        <CalendarCheck weight="duotone" className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{ev.horse.name}</p>
                        <p className="text-xs text-muted-foreground font-medium">{ev.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1 text-[10px] font-bold">
                        {typeLabels[ev.type] ?? ev.type}
                      </Badge>
                      <p className="text-xs font-semibold text-amber-600">
                        {ev.nextDueDate ? formatDate(ev.nextDueDate) : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6">
              <Button asChild variant="outline" className="w-full rounded-xl">
                <Link href={`/${tenantSlug}/sanidad`}>Ver todo el historial</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
