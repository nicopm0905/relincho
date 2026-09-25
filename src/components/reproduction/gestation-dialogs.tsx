"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Baby, ListChecks, Plus, Stethoscope, Trash } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { FOALING_COMPLICATIONS, complicationLabels, udderLabels } from "@/lib/repro-gestation";

const chip = (active: boolean) =>
  cn(
    "min-h-9 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:text-foreground",
  );

const num = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

function useDone(message: string, close: () => void) {
  const router = useRouter();
  return {
    onSuccess: () => {
      toast.success(message);
      close();
      router.refresh();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
}

// ---------------------------------------------------------------------------
// Vigilancia preparto
// ---------------------------------------------------------------------------

export function FoalingWatchDialog({ coveringId }: { coveringId: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [udder, setUdder] = useState<number | null>(null);
  const [wax, setWax] = useState(false);
  const [relaxation, setRelaxation] = useState(false);
  const [calcium, setCalcium] = useState("");
  const [notes, setNotes] = useState("");
  const add = trpc.reproduction.addFoalingWatch.useMutation(useDone("Vigilancia registrada", () => setOpen(false)));

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setUdder(null);
      setWax(false);
      setRelaxation(false);
      setCalcium("");
      setNotes("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus weight="bold" />
        Vigilancia
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vigilancia preparto</DialogTitle>
          <DialogDescription>
            Con 200 ppm o más de calcio en leche, o cera en los pezones, el parto suele llegar en 24-72 h.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({
              coveringId,
              date: new Date(date),
              udderScore: udder,
              wax,
              relaxation,
              milkCalciumPpm: num(calcium),
              notes: notes.trim() || null,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fw-date">Fecha y hora</Label>
              <Input id="fw-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fw-ca">Calcio en leche (ppm)</Label>
              <Input id="fw-ca" type="number" inputMode="numeric" min={0} value={calcium} onChange={(e) => setCalcium(e.target.value)} />
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] font-medium">Ubre</legend>
            <div className="flex flex-wrap gap-1.5">
              {udderLabels.map((label, i) => (
                <button key={label} type="button" aria-pressed={udder === i} className={chip(udder === i)} onClick={() => setUdder(udder === i ? null : i)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="fw-wax">Cera en los pezones</Label>
            <Switch id="fw-wax" checked={wax} onCheckedChange={setWax} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="fw-relax">Ligamentos de la grupa y vulva relajados</Label>
            <Switch id="fw-relax" checked={relaxation} onCheckedChange={setRelaxation} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fw-notes">Notas</Label>
            <Textarea id="fw-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteWatchButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const remove = trpc.reproduction.deleteFoalingWatch.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button
      variant="ghost"
      size={confirm ? "xs" : "icon-sm"}
      aria-label="Borrar registro de vigilancia"
      disabled={remove.isPending}
      onClick={() => (confirm ? remove.mutate({ id }) : setConfirm(true))}
      onBlur={() => setConfirm(false)}
      className={cn(confirm && "text-destructive")}
    >
      {confirm ? "¿Borrar?" : <Trash className="h-4 w-4" />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Parto y potro
// ---------------------------------------------------------------------------

export type NeonatalValues = {
  id: string;
  foalStoodMinutes: number | null;
  foalSuckledMinutes: number | null;
  placentaMinutes: number | null;
  meconiumPassed: boolean | null;
  foalIggMgDl: number | null;
  birthWeightKg: number | null;
  complications: string[];
};

export function NeonatalDialog({ foaling }: { foaling: NeonatalValues }) {
  const [open, setOpen] = useState(false);
  const [stood, setStood] = useState(foaling.foalStoodMinutes?.toString() ?? "");
  const [suckled, setSuckled] = useState(foaling.foalSuckledMinutes?.toString() ?? "");
  const [placenta, setPlacenta] = useState(foaling.placentaMinutes?.toString() ?? "");
  const [meconium, setMeconium] = useState<boolean | null>(foaling.meconiumPassed);
  const [igg, setIgg] = useState(foaling.foalIggMgDl?.toString() ?? "");
  const [weight, setWeight] = useState(foaling.birthWeightKg?.toString() ?? "");
  const [complications, setComplications] = useState<string[]>(foaling.complications);
  const update = trpc.reproduction.updateFoaling.useMutation(useDone("Datos del parto guardados", () => setOpen(false)));

  const field = (id: string, label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" min={0} value={value} onChange={(e) => set(e.target.value)} />
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Stethoscope />
        Datos del parto y del potro
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parto y potro</DialogTitle>
          <DialogDescription>
            Regla 1-2-3: el potro de pie antes de 1 h, mamando antes de 2 h y la placenta fuera antes de 3 h.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({
              id: foaling.id,
              foalStoodMinutes: num(stood),
              foalSuckledMinutes: num(suckled),
              placentaMinutes: num(placenta),
              meconiumPassed: meconium,
              foalIggMgDl: num(igg),
              birthWeightKg: weight.trim() ? Number(weight) : null,
              complications: complications as (typeof FOALING_COMPLICATIONS)[number][],
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {field("nn-stood", "De pie (min)", stood, setStood)}
            {field("nn-suckled", "Mama (min)", suckled, setSuckled)}
            {field("nn-placenta", "Placenta (min)", placenta, setPlacenta)}
            {field("nn-igg", "IgG (mg/dl)", igg, setIgg, "A las 12-24 h")}
            {field("nn-weight", "Peso al nacer (kg)", weight, setWeight)}
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] font-medium">Meconio</legend>
            <div className="flex gap-1.5">
              {([
                [true, "Expulsado"],
                [false, "No expulsado"],
              ] as const).map(([value, label]) => (
                <button key={label} type="button" aria-pressed={meconium === value} className={chip(meconium === value)} onClick={() => setMeconium(meconium === value ? null : value)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] font-medium">Incidencias</legend>
            <div className="flex flex-wrap gap-1.5">
              {FOALING_COMPLICATIONS.map((c) => {
                const active = complications.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    className={chip(active)}
                    onClick={() => setComplications((prev) => (active ? prev.filter((x) => x !== c) : [...prev, c]))}
                  >
                    {complicationLabels[c]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegisterFoalDialog({
  foalingId,
  sex,
  tenantSlug,
  foalId,
}: {
  foalingId: string;
  sex: string | null;
  tenantSlug: string;
  foalId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [foalSex, setFoalSex] = useState<"MALE" | "FEMALE" | "">((sex as "MALE" | "FEMALE" | null) ?? "");
  const register = trpc.reproduction.registerFoal.useMutation(useDone("Potro dado de alta en Caballos", () => setOpen(false)));

  if (foalId) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href={`/${tenantSlug}/caballos/${foalId}`}>
          <Baby />
          Ficha del potro
        </Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Baby />
        Dar de alta el potro
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar de alta el potro</DialogTitle>
          <DialogDescription>
            Se crea su ficha en Caballos con madre, padre (si es de la yeguada) y fecha de nacimiento.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            register.mutate({ foalingId, name: name.trim(), sex: foalSex || undefined });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="foal-name">Nombre</Label>
            <Input id="foal-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] font-medium">Sexo</legend>
            <div className="flex gap-1.5">
              {([
                ["FEMALE", "Hembra"],
                ["MALE", "Macho"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={foalSex === value} className={chip(foalSex === value)} onClick={() => setFoalSex(value)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={register.isPending || !name.trim() || !foalSex}>
              {register.isPending ? "Creando…" : "Crear ficha"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

export function SyncTasksButton() {
  const router = useRouter();
  const sync = trpc.reproduction.syncGestationTasks.useMutation({
    onSuccess: ({ created, removed }) => {
      toast.success(
        created || removed
          ? `${created} tareas creadas${removed ? `, ${removed} retiradas` : ""}`
          : "Las tareas de hitos ya estaban al día",
      );
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>
      <ListChecks />
      {sync.isPending ? "Creando…" : "Crear tareas de hitos"}
    </Button>
  );
}
