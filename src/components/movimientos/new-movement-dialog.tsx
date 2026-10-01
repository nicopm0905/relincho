"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, PencilSimple, Path, SpinnerGap, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/react";
import { isValidRega } from "@/lib/identifiers";
import { cn } from "@/lib/utils";
import {
  CAUSE_CODES,
  CAUSE_LABELS,
  DISPOSAL_METHODS,
  DOCUMENT_TYPES,
  ENTRY_CAUSES,
  EXIT_CAUSES,
  TEMPORARY_EXIT_DAYS,
  missingMovementFields,
  type DisposalMethod,
  type DocumentType,
  type MovementCause,
} from "@/lib/farm-book";

type HorseOption = { id: string; name: string };

export type EditableMovement = {
  id: string;
  horseId: string;
  direction: string;
  date: Date;
  cause: MovementCause;
  originRega: string | null;
  destinationRega: string | null;
  reason: string | null;
  documentType: string | null;
  documentNumber: string | null;
  transporterName: string | null;
  transporterId: string | null;
  vehiclePlate: string | null;
  trailerPlate: string | null;
  expectedReturnDate: Date | null;
  disposalMethod: string | null;
  disposalPlace: string | null;
  notifiedAt: Date | null;
};

function toDateInput(date: Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}
const fromDateInput = (value: string) => (value ? new Date(`${value}T12:00:00`) : null);

/** Documento que se suele usar para cada causa (se puede cambiar). */
const DEFAULT_DOCUMENT: Partial<Record<MovementCause, DocumentType>> = {
  COMPRA: "GUIA",
  VENTA: "GUIA",
  TRASLADO_PROVISIONAL: "TME",
  RETORNO: "TME",
  SACRIFICIO: "CERTIFICADO_SANITARIO",
};

/**
 * Alta o baja en el libro de explotación con todo lo que pide el anexo IV:
 * causa oficial, explotación de origen o destino, guía o documento de
 * traslado, transportista y matrícula, y en una muerte el destino del cadáver
 * y la fecha en que se comunicó. Con `movement` edita uno existente.
 */
export function NewMovementDialog({
  horses,
  movement,
  defaultHorseId,
  triggerLabel,
}: {
  horses: HorseOption[];
  movement?: EditableMovement;
  defaultHorseId?: string;
  triggerLabel?: string;
}) {
  const editing = Boolean(movement);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const init = () => ({
    direction: (movement?.direction === "OUT" ? "OUT" : "IN") as "IN" | "OUT",
    cause: movement?.cause ?? ("COMPRA" as MovementCause),
    horseId: movement?.horseId ?? defaultHorseId ?? "",
    date: toDateInput(movement?.date ?? new Date()),
    rega: (movement?.direction === "OUT" ? movement?.destinationRega : movement?.originRega) ?? "",
    documentType: (movement?.documentType as DocumentType | null) ?? "",
    documentNumber: movement?.documentNumber ?? "",
    transporterName: movement?.transporterName ?? "",
    transporterId: movement?.transporterId ?? "",
    vehiclePlate: movement?.vehiclePlate ?? "",
    trailerPlate: movement?.trailerPlate ?? "",
    expectedReturnDate: toDateInput(movement?.expectedReturnDate),
    disposalMethod: (movement?.disposalMethod as DisposalMethod | null) ?? "",
    disposalPlace: movement?.disposalPlace ?? "",
    notifiedAt: toDateInput(movement?.notifiedAt),
    reason: movement?.reason ?? "",
  });
  const [f, setF] = useState(init);
  const set = <K extends keyof ReturnType<typeof init>>(key: K, value: ReturnType<typeof init>[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const setDirection = (direction: "IN" | "OUT") =>
    setF((prev) => ({
      ...prev,
      direction,
      cause: direction === "IN" ? "COMPRA" : "VENTA",
      documentType: "",
    }));

  const direction = f.direction;
  const isEntry = direction === "IN";
  const needsRega = isEntry ? f.cause === "COMPRA" || f.cause === "RETORNO" : f.cause !== "MUERTE";
  const needsDocument = needsRega;
  const needsTransport = isEntry ? f.cause === "COMPRA" || f.cause === "RETORNO" : f.cause !== "MUERTE";
  const isDeath = f.cause === "MUERTE";
  const isTemporary = f.cause === "TRASLADO_PROVISIONAL";
  const regaInvalid = f.rega.trim() !== "" && !isValidRega(f.rega);

  const missing = useMemo(
    () =>
      missingMovementFields({
        direction: f.direction,
        cause: f.cause,
        originRega: isEntry ? f.rega : null,
        destinationRega: isEntry ? null : f.rega,
        documentNumber: f.documentNumber,
        transporterName: f.transporterName,
        vehiclePlate: f.vehiclePlate,
        disposalMethod: f.disposalMethod || null,
        disposalPlace: f.disposalPlace,
        notifiedAt: fromDateInput(f.notifiedAt),
      }),
    [f, isEntry],
  );

  const finish = (message: string) => {
    toast.success(message);
    setOpen(false);
    setConfirmDelete(false);
    router.refresh();
    if (!editing) setF(init());
  };
  const onError = (err: { message: string }) => toast.error(err.message || "No se pudo guardar");

  const create = trpc.movements.create.useMutation({
    onSuccess: () =>
      finish(
        f.cause === "VENTA"
          ? "Baja registrada: el caballo queda como vendido"
          : f.cause === "MUERTE" || f.cause === "SACRIFICIO"
            ? "Baja registrada: el caballo queda como fallecido"
            : isEntry
              ? "Alta registrada en el libro"
              : "Baja registrada en el libro",
      ),
    onError,
  });
  const update = trpc.movements.update.useMutation({ onSuccess: () => finish("Anotación actualizada"), onError });
  const remove = trpc.movements.delete.useMutation({ onSuccess: () => finish("Anotación eliminada"), onError });
  const busy = create.isPending || update.isPending || remove.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.horseId) {
      toast.error("Elige el caballo");
      return;
    }
    if (regaInvalid) return;
    const data = {
      horseId: f.horseId,
      direction: f.direction,
      date: fromDateInput(f.date) ?? new Date(),
      cause: f.cause,
      originRega: isEntry && needsRega ? f.rega : undefined,
      destinationRega: !isEntry && needsRega ? f.rega : undefined,
      reason: f.reason || undefined,
      documentType: needsDocument && f.documentType ? (f.documentType as DocumentType) : undefined,
      documentNumber: needsDocument ? f.documentNumber : undefined,
      transporterName: needsTransport ? f.transporterName : undefined,
      transporterId: needsTransport ? f.transporterId : undefined,
      vehiclePlate: needsTransport ? f.vehiclePlate : undefined,
      trailerPlate: needsTransport ? f.trailerPlate : undefined,
      expectedReturnDate: isTemporary ? fromDateInput(f.expectedReturnDate) : null,
      disposalMethod: isDeath && f.disposalMethod ? (f.disposalMethod as DisposalMethod) : null,
      disposalPlace: isDeath ? f.disposalPlace : undefined,
      notifiedAt: isDeath ? fromDateInput(f.notifiedAt) : null,
    };
    if (movement) update.mutate({ id: movement.id, ...data });
    else create.mutate(data);
  };

  const causes = isEntry ? ENTRY_CAUSES : EXIT_CAUSES;

  return (
    <>
      {editing ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Editar anotación"
          className="text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <PencilSimple weight="bold" className="h-4 w-4" />
        </Button>
      ) : (
        <Button className="shadow-sm" onClick={() => setOpen(true)}>
          <Path weight="bold" className="mr-2 h-4 w-4" />
          {triggerLabel ?? "Anotar alta o baja"}
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          setConfirmDelete(false);
        }}
      >
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar anotación del libro" : "Nueva anotación en el libro"}</DialogTitle>
            <DialogDescription>
              Lo que pide el libro de explotación para cada alta o baja. Lo que falte queda marcado para
              completarlo después.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-1.5">
              <button
                type="button"
                aria-pressed={direction === "IN"}
                onClick={() => setDirection("IN")}
                className={cn(
                  "flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
                  direction === "IN"
                    ? "bg-card text-emerald-700 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ArrowRight weight="bold" /> Alta (entra)
              </button>
              <button
                type="button"
                aria-pressed={direction === "OUT"}
                onClick={() => setDirection("OUT")}
                className={cn(
                  "flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
                  direction === "OUT"
                    ? "bg-card text-rose-700 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ArrowLeft weight="bold" /> Baja (sale)
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mv-cause">Causa</Label>
                <NativeSelect
                  id="mv-cause"
                  value={f.cause}
                  onChange={(e) => {
                    const cause = e.target.value as MovementCause;
                    setF((prev) => ({
                      ...prev,
                      cause,
                      documentType: prev.documentType || DEFAULT_DOCUMENT[cause] || "",
                    }));
                  }}
                >
                  {causes.map((c) => (
                    <option key={c} value={c}>
                      {CAUSE_LABELS[c]} ({CAUSE_CODES[c]})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-date">Fecha</Label>
                <Input
                  id="movement-date"
                  type="date"
                  required
                  value={f.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="movement-horse">Caballo</Label>
              <NativeSelect
                id="movement-horse"
                value={f.horseId}
                onChange={(e) => set("horseId", e.target.value)}
                disabled={horses.length === 0}
              >
                <option value="">{horses.length === 0 ? "No hay caballos" : "Elige el caballo"}</option>
                {horses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </NativeSelect>
              {isEntry && f.cause === "COMPRA" && !editing && (
                <p className="text-xs text-muted-foreground">
                  ¿Es un caballo nuevo? Créalo antes en{" "}
                  <Link href="caballos/nuevo" className="font-medium text-primary-ink underline">
                    Caballos
                  </Link>{" "}
                  con su microchip y UELN.
                </p>
              )}
              {f.cause === "NACIMIENTO" && !editing && (
                <p className="text-xs text-muted-foreground">
                  Los potros dados de alta desde Reproducción ya entran solos con causa N.
                </p>
              )}
            </div>

            {needsRega && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="movement-rega">
                    {isEntry ? "REGA de procedencia" : "REGA de destino"}
                  </Label>
                  <Input
                    id="movement-rega"
                    placeholder="ES110200000123"
                    value={f.rega}
                    onChange={(e) => set("rega", e.target.value)}
                    aria-invalid={regaInvalid}
                    className="font-mono uppercase"
                  />
                  {regaInvalid && (
                    <p className="text-xs text-destructive">ES seguido de 12 dígitos.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mv-doc-type">Documento del traslado</Label>
                  <NativeSelect
                    id="mv-doc-type"
                    value={f.documentType}
                    onChange={(e) => set("documentType", e.target.value as DocumentType)}
                  >
                    <option value="">Elige</option>
                    {(Object.keys(DOCUMENT_TYPES) as DocumentType[]).map((k) => (
                      <option key={k} value={k}>
                        {DOCUMENT_TYPES[k]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="mv-doc-number">Nº de guía, certificado o documento</Label>
                  <Input
                    id="mv-doc-number"
                    value={f.documentNumber}
                    onChange={(e) => set("documentNumber", e.target.value)}
                  />
                </div>
              </div>
            )}

            {needsTransport && (
              <fieldset className="space-y-3 rounded-xl border border-border p-3.5">
                <legend className="px-1 text-[13px] font-semibold text-foreground">
                  Transporte {isEntry ? "" : "(si lo hay)"}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-tr-name">Transportista</Label>
                    <Input
                      id="mv-tr-name"
                      value={f.transporterName}
                      onChange={(e) => set("transporterName", e.target.value)}
                      placeholder="Nombre o empresa"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-tr-id">NIF o nº de autorización</Label>
                    <Input
                      id="mv-tr-id"
                      value={f.transporterId}
                      onChange={(e) => set("transporterId", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-plate">Matrícula del vehículo</Label>
                    <Input
                      id="mv-plate"
                      value={f.vehiclePlate}
                      onChange={(e) => set("vehiclePlate", e.target.value)}
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-trailer">Matrícula del remolque</Label>
                    <Input
                      id="mv-trailer"
                      value={f.trailerPlate}
                      onChange={(e) => set("trailerPlate", e.target.value)}
                      className="font-mono uppercase"
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {isTemporary && (
              <div className="space-y-1.5">
                <Label htmlFor="mv-return">Vuelta prevista</Label>
                <Input
                  id="mv-return"
                  type="date"
                  value={f.expectedReturnDate}
                  onChange={(e) => set("expectedReturnDate", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Con tarjeta de movimiento equina, la salida no puede pasar de {TEMPORARY_EXIT_DAYS} días.
                  Cuando vuelva, anota el alta con causa &quot;Retorno&quot;.
                </p>
              </div>
            )}

            {isDeath && (
              <fieldset className="space-y-3 rounded-xl border border-border p-3.5">
                <legend className="px-1 text-[13px] font-semibold text-foreground">Baja por muerte</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-disposal">Destino del cadáver</Label>
                    <NativeSelect
                      id="mv-disposal"
                      value={f.disposalMethod}
                      onChange={(e) => set("disposalMethod", e.target.value as DisposalMethod)}
                    >
                      <option value="">Elige</option>
                      {(Object.keys(DISPOSAL_METHODS) as DisposalMethod[]).map((k) => (
                        <option key={k} value={k}>
                          {DISPOSAL_METHODS[k]}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-notified">Baja comunicada el</Label>
                    <Input
                      id="mv-notified"
                      type="date"
                      value={f.notifiedAt}
                      onChange={(e) => set("notifiedAt", e.target.value)}
                    />
                  </div>
                  {f.disposalMethod === "ENTERRAMIENTO" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="mv-place">Lugar del enterramiento</Label>
                      <Input
                        id="mv-place"
                        value={f.disposalPlace}
                        onChange={(e) => set("disposalPlace", e.target.value)}
                        placeholder="Parcela, paraje o coordenadas"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  En Andalucía, la baja se comunica a la Oficina Comarcal Agraria con el DIE en 7 días hábiles,
                  y en toda España al emisor del DIE en 15 días.
                </p>
              </fieldset>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="movement-reason">Observaciones</Label>
              <Textarea
                id="movement-reason"
                rows={2}
                value={f.reason}
                onChange={(e) => set("reason", e.target.value)}
                placeholder={isEntry ? "Ej.: comprada a Yeguada X" : "Ej.: concurso en Sevilla"}
              />
            </div>

            {missing.length > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                Para que la anotación esté completa falta: {missing.join(", ")}. Puedes guardarla y
                completarla después.
              </p>
            )}

            <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
              {editing ? (
                confirmDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => movement && remove.mutate({ id: movement.id })}
                  >
                    Confirmar borrado
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash className="h-4 w-4" /> Borrar
                  </Button>
                )
              ) : (
                <span />
              )}
              <Button type="submit" disabled={busy || regaInvalid}>
                {busy && <SpinnerGap className="animate-spin" />}
                {editing ? "Guardar cambios" : "Anotar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
