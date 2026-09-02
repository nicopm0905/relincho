import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { CheckCircle, Circle, ClipboardText } from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function TareasPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const [pending, done] = await Promise.all([
    caller.tasks.list({ done: false }),
    caller.tasks.list({ done: true }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tareas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona las tareas pendientes de tu ganadería
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendientes ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle weight="duotone" className="h-6 w-6 text-primary-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">¡Todo al día!</p>
              <p className="text-xs text-muted-foreground mt-1">No hay tareas pendientes</p>
            </div>
          ) : (
            <div className="space-y-1">
              {pending.map((task) => {
                const overdue = new Date(task.dueDate) < new Date();
                return (
                  <div key={task.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Circle weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{task.title}</p>
                      {task.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{task.notes}</p>
                      )}
                    </div>
                    <Badge
                      variant={overdue ? "destructive" : "outline"}
                    >
                      {formatDate(task.dueDate)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground">
              Completadas ({done.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {done.slice(0, 10).map((task) => (
                <div key={task.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 text-sm text-muted-foreground">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle weight="fill" className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <span className="line-through flex-1">{task.title}</span>
                  <span className="text-xs shrink-0">{task.doneAt ? formatDate(task.doneAt) : ""}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
