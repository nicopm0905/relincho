import { createServerCaller } from "@/lib/trpc/server";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { CheckCircle, Circle, Sun } from "@phosphor-icons/react/dist/ssr";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListRows, RowIcon } from "@/components/ui/list-row";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Tareas — ${tenantSlug}` };
}

export default async function TareasPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const [pending, done] = await Promise.all([
    caller.tasks.list({ done: false }),
    caller.tasks.list({ done: true }),
  ]);

  const today = new Date().setHours(0, 0, 0, 0);

  return (
    <div className="animate-in fade-in-0 space-y-8 duration-300">
      <PageHeader
        title="Tareas"
        description="Lo que queda por hacer en la cuadra"
      />

      <section className="space-y-3">
        <SectionHeading
          title="Pendientes"
          description={`${pending.length} sin completar`}
        />
        {pending.length === 0 ? (
          <EmptyState
            icon={<Sun weight="duotone" />}
            title="Todo al día"
            description="No hay tareas pendientes."
          />
        ) : (
          <ListRows>
            {pending.map((task) => {
              const overdue =
                new Date(task.dueDate).setHours(0, 0, 0, 0) < today;
              return (
                <ListRow
                  key={task.id}
                  leading={
                    <RowIcon tone={overdue ? "alert" : "neutral"}>
                      <Circle weight="regular" />
                    </RowIcon>
                  }
                  title={task.title}
                  subtitle={task.notes || undefined}
                  meta={
                    <Badge variant={overdue ? "destructive" : "secondary"}>
                      {formatDate(task.dueDate)}
                    </Badge>
                  }
                />
              );
            })}
          </ListRows>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <SectionHeading
            title="Completadas"
            description={`Últimas ${Math.min(done.length, 10)} de ${done.length}`}
          />
          <ListRows>
            {done.slice(0, 10).map((task) => (
              <ListRow
                key={task.id}
                leading={
                  <RowIcon>
                    <CheckCircle weight="fill" />
                  </RowIcon>
                }
                title={
                  <span className="text-muted-foreground line-through">
                    {task.title}
                  </span>
                }
                meta={task.doneAt ? formatDate(task.doneAt) : undefined}
              />
            ))}
          </ListRows>
        </section>
      )}
    </div>
  );
}
