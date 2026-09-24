"use client";

import { useState } from "react";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function toDateInput(date: Date | string) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function errorText(err: { message: string; data?: { code?: string } | null }) {
  return err.data?.code === "FORBIDDEN"
    ? "No tienes permiso para cambiar esto"
    : err.message || "No se ha podido guardar";
}

function DeleteConfirm({
  busy,
  onDelete,
}: {
  busy: boolean;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onDelete}>
        Sí, eliminar
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        No
      </Button>
    </div>
  ) : (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      onClick={() => setConfirm(true)}
    >
      <Trash weight="bold" />
      Eliminar
    </Button>
  );
}

/** Corregir una sesion del registro rapido desde el historial del caballo. */
export function EditTrainingDialog({
  session,
}: {
  session: {
    id: string;
    date: Date | string;
    minutes: number;
    type: string | null;
    riderName: string | null;
    notes: string | null;
  };
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toDateInput(session.date));
  const [minutes, setMinutes] = useState(String(session.minutes));
  const [type, setType] = useState(session.type ?? "");
  const [rider, setRider] = useState(session.riderName ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");

  const done = (message: string) => {
    toast.success(message);
    setOpen(false);
    utils.horses.timeline.invalidate();
    utils.training.list.invalidate();
  };
  const update = trpc.training.update.useMutation({
    onSuccess: () => done("Sesión actualizada"),
    onError: (err) => toast.error(errorText(err)),
  });
  const remove = trpc.training.delete.useMutation({
    onSuccess: () => done("Sesión eliminada"),
    onError: (err) => toast.error(errorText(err)),
  });
  const busy = update.isPending || remove.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Editar sesión" className="text-muted-foreground" />}
      >
        <PencilSimple weight="bold" className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Editar sesión</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({
              id: session.id,
              date: new Date(`${date}T12:00:00`),
              minutes: Number(minutes),
              type: type.trim() || null,
              riderName: rider.trim() || null,
              notes: notes.trim() || null,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`tr-date-${session.id}`}>Fecha</Label>
              <Input id={`tr-date-${session.id}`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tr-min-${session.id}`}>Minutos</Label>
              <Input
                id={`tr-min-${session.id}`}
                type="number"
                min={1}
                max={600}
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`tr-type-${session.id}`}>Tipo de trabajo</Label>
              <Input id={`tr-type-${session.id}`} value={type} onChange={(e) => setType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tr-rider-${session.id}`}>Jinete</Label>
              <Input id={`tr-rider-${session.id}`} value={rider} onChange={(e) => setRider(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`tr-notes-${session.id}`}>Notas</Label>
            <Textarea id={`tr-notes-${session.id}`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <DeleteConfirm busy={busy} onDelete={() => remove.mutate({ id: session.id })} />
            <Button type="submit" disabled={busy}>
              {update.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Editar o borrar una entrada del diario. */
export function EditJournalDialog({ entry }: { entry: { id: string; content: string } }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(entry.content);

  const done = (message: string) => {
    toast.success(message);
    setOpen(false);
    utils.journal.list.invalidate();
  };
  const update = trpc.journal.update.useMutation({
    onSuccess: () => done("Entrada actualizada"),
    onError: (err) => toast.error(errorText(err)),
  });
  const remove = trpc.journal.delete.useMutation({
    onSuccess: () => done("Entrada eliminada"),
    onError: (err) => toast.error(errorText(err)),
  });
  const busy = update.isPending || remove.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Editar entrada" className="text-muted-foreground" />}
      >
        <PencilSimple weight="bold" className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Editar entrada del diario</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ id: entry.id, content });
          }}
        >
          <Textarea rows={6} required value={content} onChange={(e) => setContent(e.target.value)} aria-label="Texto de la entrada" />
          <p className="text-xs text-muted-foreground">
            Al cambiar el texto se quita el análisis de IA, que hablaba del anterior.
          </p>
          <div className="flex items-center justify-between gap-3">
            <DeleteConfirm busy={busy} onDelete={() => remove.mutate({ id: entry.id })} />
            <Button type="submit" disabled={busy || !content.trim()}>
              {update.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
