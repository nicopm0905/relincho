"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
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
import {
  EXAM_TREATMENTS,
  cervixLabels,
  corpusLuteumLabels,
  edemaLabels,
  sideLabels,
  teasingLabels,
  treatmentLabels,
  type ExamTreatment,
} from "@/lib/repro-labels";

export type ExamValues = {
  id?: string;
  date: Date | string;
  teasingScore: number | null;
  leftFollicleMm: number | null;
  rightFollicleMm: number | null;
  corpusLuteum: string | null;
  uterineEdema: number | null;
  uterineFluidMm: number | null;
  cervix: string | null;
  ovulated: boolean;
  ovulationSide: string | null;
  treatments: string[];
  notes: string | null;
};

/** Botonera de una sola eleccion; pulsar la activa la deja sin valor. */
function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[13px] font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? null : o.value)}
              className={cn(
                "min-h-9 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const empty = (): ExamValues => ({
  date: new Date(),
  teasingScore: null,
  leftFollicleMm: null,
  rightFollicleMm: null,
  corpusLuteum: null,
  uterineEdema: null,
  uterineFluidMm: null,
  cervix: null,
  ovulated: false,
  ovulationSide: null,
  treatments: [],
  notes: null,
});

export function ExamDialog({
  cycleId,
  exam,
  trigger = "button",
}: {
  cycleId: string;
  exam?: ExamValues;
  trigger?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [v, setV] = useState<ExamValues>(exam ?? empty());
  const [dateText, setDateText] = useState(format(new Date(v.date), "yyyy-MM-dd'T'HH:mm"));
  const [left, setLeft] = useState(v.leftFollicleMm?.toString() ?? "");
  const [right, setRight] = useState(v.rightFollicleMm?.toString() ?? "");
  const [fluid, setFluid] = useState(v.uterineFluidMm?.toString() ?? "");

  const set = <K extends keyof ExamValues>(key: K, value: ExamValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const onDone = (message: string) => {
    toast.success(message);
    setOpen(false);
    router.refresh();
  };
  const add = trpc.reproduction.addExam.useMutation({
    onSuccess: () => onDone("Exploración registrada"),
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.reproduction.updateExam.useMutation({
    onSuccess: () => onDone("Exploración actualizada"),
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.reproduction.deleteExam.useMutation({
    onSuccess: () => onDone("Exploración borrada"),
    onError: (e) => toast.error(e.message),
  });

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    setConfirmDelete(false);
    if (nextOpen && !exam) {
      const fresh = empty();
      setV(fresh);
      setDateText(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setLeft("");
      setRight("");
      setFluid("");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
      toast.error("Fecha no válida");
      return;
    }
    const payload = {
      date,
      teasingScore: v.teasingScore,
      leftFollicleMm: toNumber(left),
      rightFollicleMm: toNumber(right),
      corpusLuteum: v.corpusLuteum as "NONE" | "LEFT" | "RIGHT" | "BOTH" | null,
      uterineEdema: v.uterineEdema,
      uterineFluidMm: toNumber(fluid),
      cervix: v.cervix as "CLOSED" | "RELAXING" | "OPEN" | null,
      ovulated: v.ovulated,
      ovulationSide: v.ovulated ? (v.ovulationSide as "LEFT" | "RIGHT" | null) : null,
      treatments: v.treatments as ExamTreatment[],
      notes: v.notes?.trim() || null,
    };
    if (exam?.id) update.mutate({ id: exam.id, ...payload });
    else add.mutate({ cycleId, ...payload });
  }

  const pending = add.isPending || update.isPending || remove.isPending;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger
        render={
          trigger === "icon" ? (
            <Button variant="ghost" size="icon-sm" aria-label="Editar exploración" />
          ) : (
            <Button />
          )
        }
      >
        {trigger === "icon" ? (
          <PencilSimple className="h-4 w-4" />
        ) : (
          <>
            <Plus weight="bold" />
            Exploración
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{exam ? "Editar exploración" : "Nueva exploración ginecológica"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="exam-date">Fecha y hora</Label>
            <Input
              id="exam-date"
              type="datetime-local"
              value={dateText}
              onChange={(e) => setDateText(e.target.value)}
              required
            />
          </div>

          <Segmented
            label="Recela"
            options={teasingLabels.map((label, i) => ({ value: i, label }))}
            value={v.teasingScore}
            onChange={(x) => set("teasingScore", x)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exam-left">Folículo ovario izq. (mm)</Label>
              <Input
                id="exam-left"
                inputMode="numeric"
                type="number"
                min={0}
                max={80}
                value={left}
                onChange={(e) => setLeft(e.target.value)}
                placeholder="p. ej. 32"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam-right">Folículo ovario dcho. (mm)</Label>
              <Input
                id="exam-right"
                inputMode="numeric"
                type="number"
                min={0}
                max={80}
                value={right}
                onChange={(e) => setRight(e.target.value)}
                placeholder="p. ej. 25"
              />
            </div>
          </div>

          <Segmented
            label="Edema uterino"
            options={edemaLabels.map((label, i) => ({ value: i, label }))}
            value={v.uterineEdema}
            onChange={(x) => set("uterineEdema", x)}
          />

          <Segmented
            label="Cuerpo lúteo"
            options={Object.entries(corpusLuteumLabels).map(([value, label]) => ({ value, label }))}
            value={v.corpusLuteum}
            onChange={(x) => set("corpusLuteum", x)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Segmented
              label="Cérvix"
              options={Object.entries(cervixLabels).map(([value, label]) => ({ value, label }))}
              value={v.cervix}
              onChange={(x) => set("cervix", x)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="exam-fluid">Líquido intrauterino (mm)</Label>
              <Input
                id="exam-fluid"
                inputMode="numeric"
                type="number"
                min={0}
                max={100}
                value={fluid}
                onChange={(e) => setFluid(e.target.value)}
                placeholder="0 = sin líquido"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="exam-ovulated">Ovulación detectada</Label>
              <Switch
                id="exam-ovulated"
                checked={v.ovulated}
                onCheckedChange={(checked) => set("ovulated", checked)}
              />
            </div>
            {v.ovulated && (
              <Segmented
                label="Ovario"
                options={Object.entries(sideLabels).map(([value, label]) => ({ value, label }))}
                value={v.ovulationSide}
                onChange={(x) => set("ovulationSide", x)}
              />
            )}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] font-medium text-foreground">Tratamientos aplicados</legend>
            <div className="flex flex-wrap gap-1.5">
              {EXAM_TREATMENTS.map((t) => {
                const active = v.treatments.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      set(
                        "treatments",
                        active ? v.treatments.filter((x) => x !== t) : [...v.treatments, t],
                      )
                    }
                    className={cn(
                      "min-h-9 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {treatmentLabels[t]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="exam-notes">Notas</Label>
            <Textarea
              id="exam-notes"
              value={v.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
            {exam?.id ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={pending}
                onClick={() =>
                  confirmDelete ? remove.mutate({ id: exam.id! }) : setConfirmDelete(true)
                }
              >
                {confirmDelete ? "Pulsa otra vez para borrar" : "Borrar"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
