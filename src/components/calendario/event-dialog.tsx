"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash } from "@phosphor-icons/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const KINDS = {
  VET_VISIT: "Visita del veterinario",
  FARRIER: "Herrador",
  COMPETITION: "Concurso / feria",
  VISIT: "Visita a la yeguada",
  OTHER: "Otro",
} as const;
type Kind = keyof typeof KINDS;
const NONE = "__none__";

export type EditableEvent = {
  id: string;
  kind: string;
  title: string;
  startsAt: Date | string;
  endsAt: Date | string | null;
  location: string | null;
  notes: string | null;
  horseId: string | null;
};

/** `YYYY-MM-DDTHH:mm` en hora local, para <input type="datetime-local">. */
function toLocalInput(date: Date | string) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Alta o edicion de un evento del calendario. Sin `event` pinta el boton
 * "Nuevo evento"; con `event`, `trigger` es lo que se pulsa para abrirlo.
 */
export function EventDialog({
  horses,
  event,
  trigger,
}: {
  horses: { id: string; name: string }[];
  event?: EditableEvent;
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const defaultStart = () => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return toLocalInput(d);
  };
  const [kind, setKind] = useState<Kind>((event?.kind as Kind) in KINDS ? (event!.kind as Kind) : "VET_VISIT");
  const [title, setTitle] = useState(event?.title ?? "");
  const [startsAt, setStartsAt] = useState(event ? toLocalInput(event.startsAt) : defaultStart());
  const [endsAt, setEndsAt] = useState(event?.endsAt ? toLocalInput(event.endsAt) : "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [horseId, setHorseId] = useState(event?.horseId ?? NONE);

  const done = (message: string) => {
    toast.success(message);
    setOpen(false);
    router.refresh();
  };
  const onError = (err: { message: string; data?: { code?: string } | null }) =>
    toast.error(err.data?.code === "FORBIDDEN" ? "No tienes permiso para esto" : err.message || "No se ha podido guardar");

  const create = trpc.events.create.useMutation({ onSuccess: () => done("Evento creado"), onError });
  const update = trpc.events.update.useMutation({ onSuccess: () => done("Evento actualizado"), onError });
  const remove = trpc.events.delete.useMutation({ onSuccess: () => done("Evento eliminado"), onError });
  const busy = create.isPending || update.isPending || remove.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      kind,
      title: title.trim() || KINDS[kind],
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      horseId: horseId === NONE ? null : horseId,
    };
    if (event) update.mutate({ id: event.id, ...data });
    else create.mutate(data);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setConfirmDelete(false);
      }}
    >
      {event ? (
        <DialogTrigger render={trigger ?? <button type="button" />} />
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus weight="bold" />
          Nuevo evento
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Nuevo evento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-kind">Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger id="event-kind">
                  <SelectValue>{(v: string) => KINDS[v as Kind] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KINDS) as Kind[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {KINDS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-horse">Caballo</Label>
              <Select value={horseId} onValueChange={(v) => setHorseId(v as string)}>
                <SelectTrigger id="event-horse">
                  <SelectValue>
                    {(v: string) => (v === NONE ? "Ninguno" : (horses.find((h) => h.id === v)?.name ?? "—"))}
                  </SelectValue>
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-title">Título</Label>
            <Input
              id="event-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={KINDS[kind]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Empieza</Label>
              <Input
                id="event-start"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">Termina (opcional)</Label>
              <Input
                id="event-end"
                type="datetime-local"
                min={startsAt}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-location">Lugar</Label>
            <Input id="event-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-notes">Notas</Label>
            <Textarea id="event-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {event ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => remove.mutate({ id: event.id })}>
                    Sí, eliminar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash weight="bold" />
                  Eliminar
                </Button>
              )
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : event ? "Guardar cambios" : "Crear evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
