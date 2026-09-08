import Link from "next/link";
import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListRow, ListRows, RowIcon } from "@/components/ui/list-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import { CalendarCheck, Plus } from "@phosphor-icons/react/dist/ssr";
import { MassHealthDialog } from "@/components/sanidad/mass-health-dialog";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import {
  HealthEventsList,
  healthTypeLabels,
} from "@/components/sanidad/health-events-list";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Sanidad — ${tenantSlug}` };
}

export default async function SanidadPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const [events, upcoming, horses] = await Promise.all([
    caller.health.list({}),
    caller.health.upcoming({ days: 30 }),
    caller.horses.list(),
  ]);

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <PageHeader
        title="Sanidad"
        description="Control veterinario y sanitario de tus caballos"
        actions={
          <>
            <MassHealthDialog horses={horses} tenantSlug={tenantSlug} />
            <Button asChild>
              <Link href={`/${tenantSlug}/sanidad/nuevo`}>
                <Plus weight="bold" />
                Nuevo evento
              </Link>
            </Button>
          </>
        }
      />

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <SectionHeading
            title="Vence en los próximos 30 días"
            description={`${upcoming.length} ${upcoming.length === 1 ? "vencimiento" : "vencimientos"} programados`}
          />
          <ListRows>
            {upcoming.map((ev) => (
              <ListRow
                key={ev.id}
                leading={
                  <RowIcon tone="alert">
                    <CalendarCheck weight="duotone" />
                  </RowIcon>
                }
                title={ev.horse.name}
                subtitle={ev.name}
                meta={
                  <>
                    <Badge variant="warning">
                      {healthTypeLabels[ev.type] ?? ev.type}
                    </Badge>
                    <span>{formatDate(ev.nextDueDate!)}</span>
                  </>
                }
              />
            ))}
          </ListRows>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de eventos ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <HealthEventsList events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
