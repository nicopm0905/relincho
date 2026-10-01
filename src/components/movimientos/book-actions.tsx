"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, CheckCircle, PencilSimple, Plus, SpinnerGap, Trash } from "@phosphor-icons/react";
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

function toDateInput(date: Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
const fromDateInput = (v: string) => (v ? new Date(`${v}T12:00:00`) : null);

function useDone(message: string, after?: () => void) {
  const router = useRouter();
  return {
    onSuccess: () => {
      toast.success(message);
      after?.();
      router.refresh();
    },
    onError: (e: { message: string }) => toast.error(e.message || "No se pudo guardar"),
  };
}

// ---------------------------------------------------------------------------
// Abrir el libro
// ---------------------------------------------------------------------------

export function OpenBookButton({ pending }: { pending: number }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toDateInput(new Date()));
  const mutation = trpc.farmBook.open.useMutation(
    useDone("Libro abierto: los caballos quedan anotados con causa A", () => setOpen(false)),
  );
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <BookOpen weight="bold" className="h-4 w-4" />
        Abrir el libro ({pending} {pending === 1 ? "caballo" : "caballos"})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir el libro de explotación</DialogTitle>
            <DialogDescription>
              Los caballos de la cuadra que aún no están en el libro se anotan como alta con causa A
              (apertura) en la fecha que elijas. Lo normal es la fecha en que empiezas a llevar el libro en
              Relincho o la de tu último libro en papel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="open-date">Fecha de apertura</Label>
            <Input id="open-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending || !date}
              onClick={() => mutation.mutate({ date: fromDateInput(date) ?? new Date() })}
            >
              {mutation.isPending && <SpinnerGap className="animate-spin" />}
              Abrir el libro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Baja comunicada
// ---------------------------------------------------------------------------

export function MarkNotifiedButton({ movementId }: { movementId: string }) {
  const mutation = trpc.movements.markNotified.useMutation(useDone("Comunicación anotada"));
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ id: movementId, date: new Date() })}
    >
      <CheckCircle weight="bold" />
      La he comunicado hoy
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Borrar una fila (incidencia, inspección, cuidador)
// ---------------------------------------------------------------------------

export function DeleteRowButton({
  kind,
  id,
}: {
  kind: "incident" | "inspection" | "caretaker";
  id: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const done = useDone("Borrado");
  const incident = trpc.farmBook.deleteIncident.useMutation(done);
  const inspection = trpc.farmBook.deleteInspection.useMutation(done);
  const caretaker = trpc.farmBook.deleteCaretaker.useMutation(done);
  const busy = incident.isPending || inspection.isPending || caretaker.isPending;
  if (!confirm) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Borrar"
        className="text-muted-foreground"
        onClick={() => setConfirm(true)}
      >
        <Trash className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Button
      variant="destructive"
      size="xs"
      disabled={busy}
      onClick={() => {
        if (kind === "incident") incident.mutate({ id });
        if (kind === "inspection") inspection.mutate({ id });
        if (kind === "caretaker") caretaker.mutate({ id });
      }}
    >
      Confirmar
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Incidencia en la identificación (hoja 3)
// ---------------------------------------------------------------------------

export function IncidentDialog({ horses }: { horses: { id: string; name: string; idLabel: string }[] }) {
  const [open, setOpen] = useState(false);
  const empty = {
    horseId: "",
    date: toDateInput(new Date()),
    previousId: "",
    newId: "",
    cause: "PERDIDA" as "PERDIDA" | "DETERIORO" | "OTRA_REGION" | "OTRA",
    duplicate: false,
    notes: "",
  };
  const [f, setF] = useState(empty);
  const mutation = trpc.farmBook.addIncident.useMutation(
    useDone("Incidencia anotada", () => {
      setOpen(false);
      setF(empty);
    }),
  );
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus weight="bold" className="h-4 w-4" /> Anotar incidencia
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Incidencia en la identificación</DialogTitle>
            <DialogDescription>
              Pérdida o deterioro del microchip o del documento, o un animal que llega de otra comunidad con
              otra identificación.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="inc-horse">Caballo</Label>
              <NativeSelect
                id="inc-horse"
                value={f.horseId}
                onChange={(e) => {
                  const h = horses.find((x) => x.id === e.target.value);
                  setF({ ...f, horseId: e.target.value, previousId: f.previousId || h?.idLabel || "" });
                }}
              >
                <option value="">Elige el caballo</option>
                {horses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-date">Fecha</Label>
              <Input id="inc-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-cause">Causa</Label>
              <NativeSelect
                id="inc-cause"
                value={f.cause}
                onChange={(e) => setF({ ...f, cause: e.target.value as typeof f.cause })}
              >
                <option value="PERDIDA">Pérdida (A)</option>
                <option value="DETERIORO">Deterioro (B)</option>
                <option value="OTRA_REGION">Procede de otra comunidad (C)</option>
                <option value="OTRA">Otra</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-prev">Identificación anterior</Label>
              <Input id="inc-prev" value={f.previousId} onChange={(e) => setF({ ...f, previousId: e.target.value })} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-new">Identificación nueva</Label>
              <Input id="inc-new" value={f.newId} onChange={(e) => setF({ ...f, newId: e.target.value })} className="font-mono" />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={f.duplicate}
                onChange={(e) => setF({ ...f, duplicate: e.target.checked })}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Se ha pedido duplicado del documento (se anota &quot;DUPLICADO&quot;)
            </label>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="inc-notes">Observaciones</Label>
              <Textarea id="inc-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending || !f.horseId}
              onClick={() =>
                mutation.mutate({
                  horseId: f.horseId,
                  date: fromDateInput(f.date) ?? new Date(),
                  previousId: f.previousId,
                  newId: f.newId,
                  cause: f.cause,
                  duplicate: f.duplicate,
                  notes: f.notes,
                })
              }
            >
              {mutation.isPending && <SpinnerGap className="animate-spin" />}
              Anotar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inspección o control oficial
// ---------------------------------------------------------------------------

export function InspectionDialog() {
  const [open, setOpen] = useState(false);
  const empty = { date: toDateInput(new Date()), reason: "", actNumber: "", officialName: "", notes: "" };
  const [f, setF] = useState(empty);
  const mutation = trpc.farmBook.addInspection.useMutation(
    useDone("Inspección anotada", () => {
      setOpen(false);
      setF(empty);
    }),
  );
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus weight="bold" className="h-4 w-4" /> Anotar inspección
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Inspección o control oficial</DialogTitle>
            <DialogDescription>
              Para tener el registro al día. En el PDF queda además una hoja con huecos para que el inspector
              firme a mano.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ins-date">Fecha</Label>
              <Input id="ins-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-act">Nº de acta</Label>
              <Input id="ins-act" value={f.actNumber} onChange={(e) => setF({ ...f, actNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ins-reason">Motivo</Label>
              <Input
                id="ins-reason"
                value={f.reason}
                onChange={(e) => setF({ ...f, reason: e.target.value })}
                placeholder="Ej.: control de bienestar animal, identificación, programa sanitario"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ins-official">Veterinario o funcionario actuante</Label>
              <Input id="ins-official" value={f.officialName} onChange={(e) => setF({ ...f, officialName: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ins-notes">Observaciones</Label>
              <Textarea id="ins-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending || !f.reason.trim()}
              onClick={() =>
                mutation.mutate({
                  date: fromDateInput(f.date) ?? new Date(),
                  reason: f.reason,
                  actNumber: f.actNumber,
                  officialName: f.officialName,
                  notes: f.notes,
                })
              }
            >
              {mutation.isPending && <SpinnerGap className="animate-spin" />}
              Anotar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Persona al cuidado de los animales
// ---------------------------------------------------------------------------

export interface CaretakerValue {
  id: string;
  name: string;
  documentId: string | null;
  role: string | null;
  phone: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

export function CaretakerDialog({ caretaker }: { caretaker?: CaretakerValue }) {
  const [open, setOpen] = useState(false);
  const init = () => ({
    name: caretaker?.name ?? "",
    documentId: caretaker?.documentId ?? "",
    role: caretaker?.role ?? "",
    phone: caretaker?.phone ?? "",
    startDate: toDateInput(caretaker?.startDate),
    endDate: toDateInput(caretaker?.endDate),
  });
  const [f, setF] = useState(init);
  const mutation = trpc.farmBook.saveCaretaker.useMutation(
    useDone(caretaker ? "Datos actualizados" : "Persona añadida", () => {
      setOpen(false);
      if (!caretaker) setF(init());
    }),
  );
  return (
    <>
      {caretaker ? (
        <Button variant="ghost" size="icon-sm" aria-label="Editar" className="text-muted-foreground" onClick={() => setOpen(true)}>
          <PencilSimple weight="bold" className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus weight="bold" className="h-4 w-4" /> Añadir persona
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Persona al cuidado de los animales</DialogTitle>
            <DialogDescription>Mayoral, mozos y quien atienda a los caballos a diario.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ct-name">Nombre y apellidos</Label>
              <Input id="ct-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-doc">DNI / NIE</Label>
              <Input id="ct-doc" value={f.documentId} onChange={(e) => setF({ ...f, documentId: e.target.value })} className="uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-role">Puesto</Label>
              <Input id="ct-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Mayoral, mozo..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-phone">Teléfono</Label>
              <Input id="ct-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-start">Desde</Label>
              <Input id="ct-start" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-end">Hasta (si ya no está)</Label>
              <Input id="ct-end" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending || !f.name.trim()}
              onClick={() =>
                mutation.mutate({
                  id: caretaker?.id,
                  name: f.name,
                  documentId: f.documentId.toUpperCase(),
                  role: f.role,
                  phone: f.phone,
                  startDate: fromDateInput(f.startDate),
                  endDate: fromDateInput(f.endDate),
                })
              }
            >
              {mutation.isPending && <SpinnerGap className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Datos de la explotación (hoja 1)
// ---------------------------------------------------------------------------

export interface FarmSettingsValue {
  farmName: string | null;
  farmAddress: string | null;
  farmMunicipality: string | null;
  farmProvince: string | null;
  latitude: number | null;
  longitude: number | null;
  holderPhone: string | null;
  holderEmail: string | null;
  legalRepName: string | null;
  legalRepNif: string | null;
  adsg: string | null;
  classification: string | null;
  capacity: number | null;
  surfaceHa: number | null;
  installationsM2: number | null;
  sanitaryQualification: string | null;
}

const CLASSIFICATIONS = [
  "Reproducción para silla",
  "Reproducción mixta",
  "Reproducción para producción de carne",
  "Cebo",
  "Ocio, enseñanza e investigación",
  "Pupilaje / centro ecuestre",
  "Tratante u operador comercial",
  "Centro de concentración",
];

export function FarmSettingsForm({ value, canEdit }: { value: FarmSettingsValue; canEdit: boolean }) {
  const s = (v: string | null) => v ?? "";
  const n = (v: number | null) => (v == null ? "" : String(v));
  const [f, setF] = useState({
    farmName: s(value.farmName),
    farmAddress: s(value.farmAddress),
    farmMunicipality: s(value.farmMunicipality),
    farmProvince: s(value.farmProvince),
    latitude: n(value.latitude),
    longitude: n(value.longitude),
    holderPhone: s(value.holderPhone),
    holderEmail: s(value.holderEmail),
    legalRepName: s(value.legalRepName),
    legalRepNif: s(value.legalRepNif),
    adsg: s(value.adsg),
    classification: s(value.classification),
    capacity: n(value.capacity),
    surfaceHa: n(value.surfaceHa),
    installationsM2: n(value.installationsM2),
    sanitaryQualification: s(value.sanitaryQualification),
  });
  const mutation = trpc.farmBook.saveSettings.useMutation(useDone("Datos de la explotación guardados"));
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const field = (key: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`fs-${key}`}>{label}</Label>
      <Input
        id={`fs-${key}`}
        value={f[key]}
        disabled={!canEdit}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({
          ...f,
          latitude: num(f.latitude),
          longitude: num(f.longitude),
          capacity: f.capacity.trim() === "" ? null : Math.round(Number(f.capacity)),
          surfaceHa: num(f.surfaceHa),
          installationsM2: num(f.installationsM2),
        });
      }}
    >
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground">Ubicación de la explotación</legend>
        {field("farmName", "Nombre o paraje")}
        {field("farmAddress", "Dirección")}
        {field("farmMunicipality", "Municipio")}
        {field("farmProvince", "Provincia")}
        {field("latitude", "Latitud", { inputMode: "decimal", placeholder: "36.6866" })}
        {field("longitude", "Longitud", { inputMode: "decimal", placeholder: "-6.1261" })}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground">Contacto y representante</legend>
        {field("holderPhone", "Teléfono del titular", { type: "tel" })}
        {field("holderEmail", "Correo del titular", { type: "email" })}
        {field("legalRepName", "Representante legal (si es empresa)")}
        {field("legalRepNif", "NIF del representante")}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground">Clasificación y capacidad</legend>
        <div className="space-y-1.5">
          <Label htmlFor="fs-classification">Clasificación zootécnica</Label>
          <NativeSelect
            id="fs-classification"
            value={f.classification}
            disabled={!canEdit}
            onChange={(e) => setF({ ...f, classification: e.target.value })}
          >
            <option value="">Elige</option>
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        {field("capacity", "Capacidad autorizada (animales)", { inputMode: "numeric" })}
        {field("surfaceHa", "Superficie (ha)", { inputMode: "decimal" })}
        {field("installationsM2", "Instalaciones (m²)", { inputMode: "decimal" })}
        {field("adsg", "ADSG a la que pertenece")}
        {field("sanitaryQualification", "Calificación sanitaria")}
      </fieldset>
      {canEdit && (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <SpinnerGap className="animate-spin" />}
          Guardar datos de la explotación
        </Button>
      )}
    </form>
  );
}
