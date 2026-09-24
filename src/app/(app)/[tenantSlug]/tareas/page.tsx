import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { TasksBoard } from "@/components/tareas/tasks-board";

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
  const [pending, done, horses, assignees] = await Promise.all([
    caller.tasks.list({ done: false }),
    caller.tasks.list({ done: true }),
    caller.horses.list(),
    // Un externo no asigna tareas al personal: sin lista, el selector queda
    // en "Sin asignar".
    caller.tasks.assignees().catch(() => []),
  ]);

  return (
    <div className="animate-in fade-in-0 space-y-8 duration-300">
      <PageHeader
        title="Tareas"
        description="Lo que queda por hacer en la cuadra"
      />
      <TasksBoard
        pending={pending}
        // Las completadas, de la mas reciente a la mas antigua.
        done={[...done].sort(
          (a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0),
        )}
        horses={horses.map((h) => ({ id: h.id, name: h.name }))}
        assignees={assignees}
      />
    </div>
  );
}
