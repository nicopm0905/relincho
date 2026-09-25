"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  CheckCircle,
  Circle,
  PencilSimple,
  Plus,
  Sun,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/layout/page-header";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { TaskDialog, type EditableTask, type TaskOption } from "./task-dialog";

export type BoardTask = EditableTask & {
  doneAt: Date | null;
  horseName: string | null;
  assigneeName: string | null;
};

function subtitle(task: BoardTask) {
  return [task.horseName, task.assigneeName, task.notes].filter(Boolean).join(" · ");
}

export function TasksBoard({
  pending,
  done,
  horses,
  assignees,
}: {
  pending: BoardTask[];
  done: BoardTask[];
  horses: TaskOption[];
  assignees: TaskOption[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Mientras vuelve el servidor, la tarea pulsada ya se ve como hecha.
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());

  const onError = (err: { message: string; data?: { code?: string } | null }) =>
    toast.error(
      err.data?.code === "FORBIDDEN"
        ? "No tienes permiso para hacer esto"
        : err.message || "Algo ha fallado",
    );

  const complete = trpc.tasks.complete.useMutation({
    onSuccess: (_data, { id }) => {
      toast.success("Tarea hecha", {
        action: { label: "Deshacer", onClick: () => reopen.mutate({ id }) },
      });
      router.refresh();
    },
    onError: (err, { id }) => {
      setOptimisticDone((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onError(err);
    },
  });
  const reopen = trpc.tasks.reopen.useMutation({
    onSuccess: (_data, { id }) => {
      setOptimisticDone((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    },
    onError,
  });
  const remove = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast.success("Tarea eliminada");
      setConfirmDelete(null);
      router.refresh();
    },
    onError,
  });

  const today = new Date().setHours(0, 0, 0, 0);
  const visiblePending = pending.filter((t) => !optimisticDone.has(t.id));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <SectionHeading
            title="Pendientes"
            description={`${visiblePending.length} sin completar`}
          />
          <Button onClick={() => setCreating(true)} className="shrink-0">
            <Plus weight="bold" className="h-4 w-4" />
            Nueva tarea
          </Button>
        </div>

        {visiblePending.length === 0 ? (
          <EmptyState
            icon={<Sun />}
            title="Todo al día"
            description="No hay tareas pendientes."
          />
        ) : (
          <ul className="divide-y divide-border/70">
            {visiblePending.map((task) => {
              const overdue = new Date(task.dueDate).setHours(0, 0, 0, 0) < today;
              const detail = subtitle(task);
              return (
                <li key={task.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOptimisticDone((prev) => new Set(prev).add(task.id));
                      complete.mutate({ id: task.id });
                    }}
                    aria-label={`Marcar como hecha: ${task.title}`}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors [&>svg]:h-5 [&>svg]:w-5",
                      overdue
                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-primary-ink",
                    )}
                  >
                    <Circle weight="regular" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-foreground">
                      {task.title}
                    </div>
                    {detail && (
                      <div className="truncate text-[12.5px] text-muted-foreground">
                        {detail}
                      </div>
                    )}
                  </div>

                  <Badge variant={overdue ? "destructive" : "secondary"} className="shrink-0">
                    {formatDate(task.dueDate)}
                  </Badge>

                  {confirmDelete === task.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="xs"
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate({ id: task.id })}
                      >
                        Eliminar
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(null)}>
                        No
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Editar ${task.title}`}
                        onClick={() => setEditing(task)}
                      >
                        <PencilSimple weight="bold" className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Eliminar ${task.title}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(task.id)}
                      >
                        <Trash weight="bold" className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <SectionHeading
            title="Completadas"
            description={`Últimas ${Math.min(done.length, 10)} de ${done.length}`}
          />
          <ul className="divide-y divide-border/70">
            {done.slice(0, 10).map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-primary-ink [&>svg]:h-4 [&>svg]:w-4">
                  <CheckCircle weight="fill" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-muted-foreground line-through">
                    {task.title}
                  </div>
                  {task.doneAt && (
                    <div className="text-[12.5px] text-muted-foreground">
                      Hecha el {formatDate(task.doneAt)}
                    </div>
                  )}
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={reopen.isPending}
                  onClick={() => reopen.mutate({ id: task.id })}
                >
                  <ArrowCounterClockwise weight="bold" />
                  Deshacer
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating && (
        <TaskDialog
          open
          onOpenChange={setCreating}
          horses={horses}
          assignees={assignees}
        />
      )}
      {editing && (
        <TaskDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          task={editing}
          horses={horses}
          assignees={assignees}
        />
      )}
    </div>
  );
}
