"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Scales, SpinnerGap } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  HENNEKE,
  ageInMonths,
  weightFromMeasurements,
  type WeightMethod,
} from "@/lib/body-condition";

type Mode = WeightMethod | "SIN_PESO";

const MODES: { value: Mode; label: string }[] = [
  { value: "CINTA", label: "Cinta" },
  { value: "BASCULA", label: "Báscula" },
  { value: "MEDIDAS", label: "Medidas" },
  { value: "SIN_PESO", label: "Sin pesar" },
];

interface Props {
  horseId: string;
  horseName: string;
  birthDate?: Date | string | null;
  /** Último método usado: se propone el mismo para que la tendencia sea comparable. */
  lastMethod?: WeightMethod | null;
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
}

const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const parse = (value: string) => {
  const n = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(n) ? null : n;
};

/**
 * Pesar y puntuar la condición corporal en menos de un minuto. Con la cinta
 * basta escribir lo que marca; con las medidas, la app calcula el peso.
 */
export function WeighDialog({
  horseId,
  horseName,
  birthDate,
  lastMethod,
  triggerLabel = "Pesar",
  triggerVariant = "outline",
  triggerSize = "sm",
}: Props) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayInput);
  const [mode, setMode] = useState<Mode>(lastMethod ?? "CINTA");
  const [weight, setWeight] = useState("");
  const [girth, setGirth] = useState("");
  const [length, setLength] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const save = trpc.bodyCondition.save.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.weightKg != null
          ? `${horseName}: ${result.weightKg.toLocaleString("es-ES")} kg guardados. La ración ya usa este peso.`
          : `${horseName}: condición corporal guardada.`,
      );
      setOpen(false);
      setWeight("");
      setGirth("");
      setLength("");
      setScore(null);
      setNotes("");
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo guardar el pesaje"),
  });

  const day = new Date(`${date}T12:00:00Z`);
  const months = ageInMonths(birthDate ? new Date(birthDate) : null, day);
  const g = parse(girth);
  const l = parse(length);
  const computed = mode === "MEDIDAS" && g && l ? weightFromMeasurements(g, l, months) : null;
  const w = parse(weight);

  const weightReady =
    mode === "SIN_PESO" ||
    (mode === "MEDIDAS" ? g != null && l != null : w != null);
  const canSave = weightReady && (mode !== "SIN_PESO" || score != null) && !save.isPending;

  const submit = () =>
    save.mutate({
      horseId,
      date: day,
      method: mode === "SIN_PESO" ? null : mode,
      weightKg: mode === "CINTA" || mode === "BASCULA" ? w : null,
      girthCm: mode === "MEDIDAS" || mode === "CINTA" ? g : null,
      lengthCm: mode === "MEDIDAS" ? l : null,
      bodyCondition: score,
      notes: notes.trim() || null,
    });

  const selected = HENNEKE.find((h) => h.score === score);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        <Scales weight="bold" className="mr-1.5 h-4 w-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Peso y condición de {horseName}</DialogTitle>
          <DialogDescription>
            Pésalo siempre de la misma forma y a la misma hora (mejor antes de comer) para que la
            tendencia sea fiable. El último peso pasa solo a la ración.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-date`}>Fecha</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={date}
            max={todayInput()}
            onChange={(e) => setDate(e.target.value || todayInput())}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Cómo lo pesas</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  "min-h-10 rounded-md border px-1 text-[13px] font-medium transition-colors",
                  mode === option.value
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {(mode === "CINTA" || mode === "BASCULA") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-weight`}>Peso (kg)</Label>
                <Input
                  id={`${id}-weight`}
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Ej.: 520"
                  autoFocus
                />
              </div>
              {mode === "CINTA" && (
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-girth-tape`}>Perímetro (cm, opcional)</Label>
                  <Input
                    id={`${id}-girth-tape`}
                    inputMode="decimal"
                    value={girth}
                    onChange={(e) => setGirth(e.target.value)}
                    placeholder="Ej.: 185"
                  />
                </div>
              )}
            </div>
          )}

          {mode === "MEDIDAS" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-girth`}>Perímetro torácico (cm)</Label>
                  <Input
                    id={`${id}-girth`}
                    inputMode="decimal"
                    value={girth}
                    onChange={(e) => setGirth(e.target.value)}
                    placeholder="Ej.: 185"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-length`}>Longitud (cm)</Label>
                  <Input
                    id={`${id}-length`}
                    inputMode="decimal"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="Ej.: 160"
                  />
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Perímetro: la cinta rodeando el tórax justo detrás de la cruz y del codo, al soltar
                el aire. Longitud: de la punta del hombro a la punta de la nalga.
              </p>
              <p className="text-[13px] font-medium text-foreground" aria-live="polite">
                {computed != null
                  ? `Peso calculado: ${computed.toLocaleString("es-ES")} kg`
                  : "Escribe las dos medidas y te calculo el peso."}
              </p>
            </div>
          )}

          {mode === "SIN_PESO" && (
            <p className="text-[12.5px] text-muted-foreground">
              Solo apuntas la condición corporal; el peso se queda como estaba.
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            Condición corporal (1 muy flaco · 5 ideal · 9 obeso)
          </legend>
          <div className="grid grid-cols-9 gap-1">
            {HENNEKE.map((h) => (
              <button
                key={h.score}
                type="button"
                aria-pressed={score === h.score}
                aria-label={`${h.score}: ${h.name}`}
                onClick={() => setScore(score === h.score ? null : h.score)}
                className={cn(
                  "min-h-10 rounded-md border text-[14px] font-semibold tabular-nums transition-colors",
                  score === h.score
                    ? h.score <= 3 || h.score >= 8
                      ? "border-transparent bg-red-600 text-white"
                      : h.score === 4 || h.score >= 6
                        ? "border-transparent bg-amber-500 text-white"
                        : "border-transparent bg-green-600 text-white"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {h.score}
              </button>
            ))}
          </div>
          <p className="min-h-10 text-[12.5px] text-muted-foreground" aria-live="polite">
            {selected ? (
              <>
                <span className="font-semibold text-foreground">{selected.name}.</span>{" "}
                {selected.description}
              </>
            ) : (
              "Mira y palpa cuello, cruz, dorso, costillas, base de la cola y detrás del hombro. Opcional."
            )}
          </p>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-notes`}>Notas</Label>
          <Textarea
            id={`${id}-notes`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej.: pesado antes del pienso de la mañana."
          />
        </div>

        <DialogFooter>
          <Button disabled={!canSave} onClick={submit} className="w-full sm:w-auto">
            {save.isPending && <SpinnerGap className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
