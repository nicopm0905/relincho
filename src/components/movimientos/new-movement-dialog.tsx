"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Path, ArrowRight, ArrowLeft, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { isValidRega } from "@/lib/identifiers";

type HorseOption = { id: string; name: string };

export type EditableMovement = {
  id: string;
  horseId: string;
  direction: string;
  date: Date;
  originRega: string | null;
  destinationRega: string | null;
  reason: string | null;
};

type Outcome = "SALE" | "DEATH" | "TRANSFER";
const OUTCOMES: Record<Outcome, string> = {
  SALE: "Venta",
  DEATH: "Muerte",
  TRANSFER: "Traslado (sigue siendo nuestro)",
};

function toDateInput(date: Date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Alta o baja en el libro de explotacion. Con `movement` edita uno existente
 * (y muestra un lapiz como disparador en vez del boton grande).
 */
export function NewMovementDialog({
  horses,
  movement,
}: {
  horses: HorseOption[];
  movement?: EditableMovement;
}) {
  const editing = Boolean(movement);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [direction, setDirection] = useState<"IN" | "OUT">(
    movement?.direction === "OUT" ? "OUT" : "IN",
  );
  const [horseId, setHorseId] = useState(movement?.horseId ?? "");
  const [date, setDate] = useState(toDateInput(movement?.date ?? new Date()));
  const [rega, setRega] = useState(
    (movement?.direction === "OUT" ? movement?.destinationRega : movement?.originRega) ?? "",
  );
  const [reason, setReason] = useState(movement?.reason ?? "");
  const [outcome, setOutcome] = useState<Outcome>("SALE");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const regaInvalid = rega.trim() !== "" && !isValidRega(rega);

  const reset = () => {
    setHorseId("");
    setRega("");
    setReason("");
    setOutcome("SALE");
  };
  const finish = (message: string) => {
    toast.success(message);
    setOpen(false);
    router.refresh();
    if (!editing) reset();
  };
  const onError = (err: { message: string }) =>
    toast.error(err.message || "Error al guardar el movimiento");

  const createMovement = trpc.movements.create.useMutation({
    onSuccess: () =>
      finish(
        direction === "IN"
          ? "Alta registrada"
          : outcome === "TRANSFER"
            ? "Baja registrada"
            : `Baja registrada: el caballo queda como ${outcome === "SALE" ? "vendido" : "fallecido"}`,
      ),
    onError,
  });
  const updateMovement = trpc.movements.update.useMutation({
    onSuccess: () => finish("Movimiento actualizado"),
    onError,
  });
  const deleteMovement = trpc.movements.delete.useMutation({
    onSuccess: () => finish("Movimiento eliminado"),
    onError,
  });
  const busy = createMovement.isPending || updateMovement.isPending || deleteMovement.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) {
      toast.error("Debes seleccionar un caballo");
      return;
    }
    if (regaInvalid) return;

    const data = {
      horseId,
      direction,
      date: new Date(`${date}T12:00:00`),
      originRega: direction === "IN" ? rega : undefined,
      destinationRega: direction === "OUT" ? rega : undefined,
      reason: reason || undefined,
    };
    if (movement) updateMovement.mutate({ id: movement.id, ...data });
    else createMovement.mutate({ ...data, outcome: direction === "OUT" ? outcome : undefined });
  };

  return (
    <>
      {editing ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Editar movimiento"
          className="text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <PencilSimple weight="bold" className="h-4 w-4" />
        </Button>
      ) : (
        <Button className="shadow-sm" onClick={() => setOpen(true)}>
          <Path weight="bold" className="mr-2 h-4 w-4" />
          Registrar Movimiento
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          setConfirmDelete(false);
        }}
      >
        <DialogContent className="overflow-hidden rounded-2xl bg-popover p-0 sm:max-w-[500px]">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold font-heading text-foreground flex items-center gap-2">
              <Path weight="duotone" className="h-6 w-6 text-primary" />
              {editing ? "Editar Movimiento" : "Nuevo Movimiento"}
            </DialogTitle>
            <DialogDescription>
              Registra una entrada (alta) o salida (baja) en tu libro de explotación.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">

            {/* Tipo de Movimiento (Tabs visuales) */}
            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-2xl">
              <button
                type="button"
                aria-pressed={direction === "IN"}
                onClick={() => setDirection("IN")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  direction === "IN"
                    ? "bg-card text-emerald-600 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowRight weight="bold" /> Alta (Entrada)
              </button>
              <button
                type="button"
                aria-pressed={direction === "OUT"}
                onClick={() => setDirection("OUT")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  direction === "OUT"
                    ? "bg-card text-rose-600 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowLeft weight="bold" /> Baja (Salida)
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="movement-horse">Caballo</Label>
                <Select value={horseId} onValueChange={(val) => setHorseId((val as string) || "")} disabled={horses.length === 0}>
                  <SelectTrigger id="movement-horse" className="rounded-xl border-border/50 bg-muted/20">
                    <SelectValue placeholder={horses.length === 0 ? "No hay caballos" : "Selecciona el caballo"}>
                      {(v: string) => horses.find((h) => h.id === v)?.name ?? "Selecciona el caballo"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {horses.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {direction === "OUT" && !editing && (
                <div className="space-y-2">
                  <Label htmlFor="movement-outcome">¿Por qué sale?</Label>
                  <Select value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}>
                    <SelectTrigger id="movement-outcome" className="rounded-xl border-border/50 bg-muted/20">
                      <SelectValue>{(v: string) => OUTCOMES[v as Outcome] ?? v}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(OUTCOMES) as Outcome[]).map((key) => (
                        <SelectItem key={key} value={key}>{OUTCOMES[key]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {outcome !== "TRANSFER" && (
                    <p className="text-xs text-muted-foreground">
                      El caballo quedará como {outcome === "SALE" ? "vendido" : "fallecido"} en la cuadra.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="movement-date">Fecha</Label>
                  <Input
                    id="movement-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-xl border-border/50 bg-muted/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-rega">{direction === "IN" ? "Código REGA Origen" : "Código REGA Destino"}</Label>
                  <Input
                    id="movement-rega"
                    placeholder="Ej. ES110200000123"
                    value={rega}
                    onChange={(e) => setRega(e.target.value)}
                    aria-invalid={regaInvalid}
                    aria-describedby={regaInvalid ? "movement-rega-error" : undefined}
                    className="rounded-xl border-border/50 bg-muted/20 uppercase"
                  />
                  {regaInvalid && (
                    <p id="movement-rega-error" className="text-xs text-destructive">
                      ES seguido de 12 dígitos
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="movement-reason">Motivo / Observaciones</Label>
                <Input
                  id="movement-reason"
                  placeholder={direction === "IN" ? "Ej. Compra, Nacimiento..." : "Ej. Comprador, destino..."}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="rounded-xl border-border/50 bg-muted/20"
                />
              </div>
            </div>

          </div>

          <div className="p-6 pt-4 bg-muted/10 border-t border-border/40 flex items-center justify-between gap-3">
            {editing ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => movement && deleteMovement.mutate({ id: movement.id })}
                  >
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
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-full">
                Cancelar
              </Button>
              <Button type="submit" disabled={!horseId || busy || regaInvalid} className="shadow-sm">
                {busy ? "Guardando..." : "Guardar Registro"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}
