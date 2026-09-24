"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TaskOption = { id: string; name: string };

export type EditableTask = {
  id: string;
  title: string;
  dueDate: Date;
  notes: string | null;
  horseId: string | null;
  assigneeMembershipId: string | null;
};

const NONE = "__none__";

function toDateInput(date: Date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Alta y edicion de tareas: mismo formulario, `task` decide cual. */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  horses,
  assignees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: EditableTask;
  horses: TaskOption[];
  assignees: TaskOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(task?.title ?? "");
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate ?? new Date()));
  const [horseId, setHorseId] = useState(task?.horseId ?? NONE);
  const [assignee, setAssignee] = useState(task?.assigneeMembershipId ?? NONE);
  const [notes, setNotes] = useState(task?.notes ?? "");

  const onDone = (message: string) => {
    toast.success(message);
    onOpenChange(false);
    router.refresh();
  };
  const onError = (err: { message: string }) =>
    toast.error(err.message || "No se ha podido guardar");

  const create = trpc.tasks.create.useMutation({
    onSuccess: () => onDone("Tarea creada"),
    onError,
  });
  const update = trpc.tasks.update.useMutation({
    onSuccess: () => onDone("Tarea actualizada"),
    onError,
  });
  const busy = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const base = {
      title: title.trim(),
      dueDate: new Date(`${dueDate}T12:00:00`),
    };
    if (task) {
      update.mutate({
        id: task.id,
        ...base,
        horseId: horseId === NONE ? null : horseId,
        assigneeMembershipId: assignee === NONE ? null : assignee,
        notes: notes.trim() || null,
      });
    } else {
      create.mutate({
        ...base,
        horseId: horseId === NONE ? undefined : horseId,
        assigneeMembershipId: assignee === NONE ? undefined : assignee,
        notes: notes.trim() || undefined,
      });
    }
  };

  const horseLabel = (id: string) =>
    id === NONE ? "Ninguno" : (horses.find((h) => h.id === id)?.name ?? "—");
  const assigneeLabel = (id: string) =>
    id === NONE ? "Sin asignar" : (assignees.find((a) => a.id === id)?.name ?? "—");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
          <DialogDescription>
            {task ? "Cambia lo que haga falta." : "Algo que hay que hacer en la cuadra."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Qué hay que hacer</Label>
            <Input
              id="task-title"
              required
              autoFocus
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Llamar al herrador para Llorona V"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Para cuándo</Label>
              <Input
                id="task-due"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Quién</Label>
              <Select value={assignee} onValueChange={(v) => setAssignee(v as string)}>
                <SelectTrigger id="task-assignee">
                  <SelectValue>{(v: string) => assigneeLabel(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-horse">Caballo (opcional)</Label>
            <Select value={horseId} onValueChange={(v) => setHorseId(v as string)}>
              <SelectTrigger id="task-horse">
                <SelectValue>{(v: string) => horseLabel(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Ninguno</SelectItem>
                {horses.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notas</Label>
            <Textarea
              id="task-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : task ? "Guardar cambios" : "Crear tarea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
