"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { healthTypeLabels } from "./health-events-list";
import { isMedicinal } from "@/lib/treatments";
import {
  MedicationFields,
  medicationFromRecord,
  medicationPayload,
} from "./medication-fields";

type HealthType =
  | "VACCINE"
  | "DEWORMING"
  | "DENTAL"
  | "FARRIER"
  | "VET_CHECKUP"
  | "TREATMENT"
  | "INJURY"
  | "OTHER";

export type EditableHealthEvent = {
  id: string;
  name: string;
  type: string;
  date: Date;
  nextDueDate: Date | null;
  dose?: string | null;
  notes?: string | null;
  vetContactId?: string | null;
  prescriptionNumber?: string | null;
  withdrawalDays?: number | null;
  durationDays?: number | null;
  supplier?: string | null;
  purchaseReference?: string | null;
  batchNumber?: string | null;
  horse: {
    name: string;
    uelnCode?: string | null;
    microchip?: string | null;
    excludedFromFoodChain?: boolean;
  };
};

function toDateInput(date: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

const atNoon = (value: string) => new Date(`${value}T12:00:00`);

/** Corregir o borrar un registro sanitario sin salir del historial. */
export function EditHealthEventDialog({ event }: { event: EditableHealthEvent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [type, setType] = useState<HealthType>(event.type as HealthType);
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(toDateInput(event.date));
  const [nextDueDate, setNextDueDate] = useState(toDateInput(event.nextDueDate));
  const [dose, setDose] = useState(event.dose ?? "");
  const [medication, setMedication] = useState(() => medicationFromRecord(event));
  const medicinal = isMedicinal(type);
  const [notes, setNotes] = useState(event.notes ?? "");

  const done = (message: string) => {
    toast.success(message);
    setOpen(false);
    router.refresh();
  };

  const update = trpc.health.update.useMutation({
    onSuccess: () => done("Registro actualizado"),
    onError: (err) => toast.error(err.message || "No se ha podido guardar"),
  });
  const remove = trpc.health.delete.useMutation({
    onSuccess: () => done("Registro eliminado"),
    onError: (err) =>
      toast.error(
        err.data?.code === "FORBIDDEN"
          ? "Solo el propietario o el encargado pueden eliminar registros"
          : err.message || "No se ha podido eliminar",
      ),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      id: event.id,
      type,
      name: name.trim(),
      date: atNoon(date),
      nextDueDate: nextDueDate ? atNoon(nextDueDate) : null,
      notes: notes.trim() || undefined,
      // En un medicamento la cantidad va con el resto de datos del libro.
      ...(medicinal ? medicationPayload(medication) : { dose: dose.trim() || null }),
    });
  };

  const busy = update.isPending || remove.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setConfirmDelete(false);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={`Editar ${event.name} de ${event.horse.name}`}
          />
        }
      >
        <PencilSimple weight="bold" className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
          <DialogDescription>{event.horse.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`type-${event.id}`}>Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as HealthType)}>
                <SelectTrigger id={`type-${event.id}`}>
                  <SelectValue>
                    {(val: string) => healthTypeLabels[val] ?? val}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(healthTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`date-${event.id}`}>Fecha</Label>
              <Input
                id={`date-${event.id}`}
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`name-${event.id}`}>Producto / descripción</Label>
            <Input
              id={`name-${event.id}`}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {medicinal && (
            <MedicationFields
              values={medication}
              onChange={setMedication}
              type={type}
              foodChainExcluded={event.horse.excludedFromFoodChain ?? false}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            {!medicinal && (
              <div className="space-y-1.5">
                <Label htmlFor={`dose-${event.id}`}>Dosis</Label>
                <Input
                  id={`dose-${event.id}`}
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`next-${event.id}`}>Próxima dosis</Label>
              <Input
                id={`next-${event.id}`}
                type="date"
                min={date}
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`notes-${event.id}`}>Notas</Label>
            <Textarea
              id={`notes-${event.id}`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => remove.mutate({ id: event.id })}
                >
                  Sí, eliminar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash weight="bold" className="mr-1.5 h-4 w-4" />
                Eliminar
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {update.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
