"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, SpinnerGap, HandPalm } from "@phosphor-icons/react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LEGS, LEG_LABELS, type Lameness, type Leg } from "@/lib/readiness";

type Finding = "heat" | "swelling" | "pain";

const FINDINGS: { key: Finding; label: string }[] = [
  { key: "heat", label: "Calor" },
  { key: "swelling", label: "Hinchazón" },
  { key: "pain", label: "Dolor" },
];

const LAMENESS_OPTIONS: { value: Lameness; label: string }[] = [
  { value: "NO", label: "Va bien" },
  { value: "DUDOSA", label: "Dudoso" },
  { value: "SI", label: "Cojea" },
];

interface Initial {
  heatLegs: string[];
  swellingLegs: string[];
  painLegs: string[];
  lameness: Lameness;
  notes?: string | null;
}

interface Props {
  horseId: string;
  horseName: string;
  /** Chequeo ya guardado hoy, para corregirlo. */
  initial?: Initial | null;
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
}

function toLegs(values: string[] | undefined): Leg[] {
  return (values ?? []).filter((v): v is Leg => (LEGS as readonly string[]).includes(v));
}

/**
 * Chequeo de patas antes de trabajar. Pensado para el mozo con el móvil en la
 * mano: si todo está bien es un solo toque ("Todo normal"); si no, marca la
 * pata y lo que nota.
 */
export function LimbCheckDialog({
  horseId,
  horseName,
  initial,
  triggerLabel,
  triggerVariant = "default",
  triggerSize,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<Record<Finding, Leg[]>>({
    heat: toLegs(initial?.heatLegs),
    swelling: toLegs(initial?.swellingLegs),
    pain: toLegs(initial?.painLegs),
  });
  const [lameness, setLameness] = useState<Lameness>(initial?.lameness ?? "NO");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const save = trpc.performance.saveLimbCheck.useMutation({
    onSuccess: (result) => {
      const message = `${horseName}: ${result.label}.`;
      if (result.level === "ROJO") toast.error(`${message} ${result.advice}`);
      else if (result.level === "AMBAR") toast.warning(`${message} ${result.advice}`);
      else toast.success(message);
      setOpen(false);
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo guardar el chequeo"),
  });

  const toggle = (finding: Finding, leg: Leg) =>
    setFindings((prev) => ({
      ...prev,
      [finding]: prev[finding].includes(leg)
        ? prev[finding].filter((l) => l !== leg)
        : [...prev[finding], leg],
    }));

  const anyFinding =
    lameness !== "NO" ||
    findings.heat.length + findings.swelling.length + findings.pain.length > 0;

  const submit = (allClear: boolean) =>
    save.mutate(
      allClear
        ? { horseId, heatLegs: [], swellingLegs: [], painLegs: [], lameness: "NO" }
        : {
            horseId,
            heatLegs: findings.heat,
            swellingLegs: findings.swelling,
            painLegs: findings.pain,
            lameness,
            notes: notes.trim() || undefined,
          },
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        <HandPalm weight="fill" className="mr-2 h-4 w-4" />
        {triggerLabel ?? (initial ? "Corregir chequeo" : "Chequear patas")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chequeo de patas de {horseName}</DialogTitle>
          <DialogDescription>
            Pasa la mano por los tendones de cada caña, de la rodilla o el corvejón
            hacia abajo, y compárala con la del otro lado. Después, míralo al trote
            diez metros en recta.
          </DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          size="lg"
          disabled={save.isPending}
          onClick={() => submit(true)}
          className="h-auto min-h-12 w-full py-3 text-base"
        >
          {save.isPending ? (
            <SpinnerGap className="animate-spin" />
          ) : (
            <CheckCircle weight="fill" className="h-5 w-5" />
          )}
          Todo normal
        </Button>

        <div className="relative py-1 text-center text-[12px] text-muted-foreground">
          <span className="relative z-10 bg-background px-2">o marca lo que notas</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
          {LEGS.map((leg) => (
            <fieldset
              key={leg}
              className="rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <legend className="sr-only">{LEG_LABELS[leg]}</legend>
              <p className="mb-1.5 text-[13px] font-semibold text-foreground" aria-hidden>
                {LEG_LABELS[leg]}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {FINDINGS.map((finding) => {
                  const active = findings[finding.key].includes(leg);
                  return (
                    <button
                      key={finding.key}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${finding.label} en ${LEG_LABELS[leg].toLowerCase()}`}
                      onClick={() => toggle(finding.key, leg)}
                      className={cn(
                        "min-h-9 rounded-md border px-1 text-[12px] font-medium transition-colors",
                        active
                          ? finding.key === "pain"
                            ? "border-transparent bg-red-600 text-white"
                            : "border-transparent bg-amber-500 text-white"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {finding.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Al trote</Label>
          <div className="grid grid-cols-3 gap-2">
            {LAMENESS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={lameness === option.value}
                onClick={() => setLameness(option.value)}
                className={cn(
                  "min-h-10 rounded-md border text-[13px] font-medium transition-colors",
                  lameness === option.value
                    ? option.value === "SI"
                      ? "border-transparent bg-red-600 text-white"
                      : option.value === "DUDOSA"
                        ? "border-transparent bg-amber-500 text-white"
                        : "border-transparent bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="limb-notes">Notas</Label>
          <Textarea
            id="limb-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej.: algo de calor en el tendón de la mano izquierda al volver del campo."
          />
        </div>

        <DialogFooter>
          <Button
            variant={anyFinding ? "default" : "outline"}
            disabled={save.isPending}
            onClick={() => submit(false)}
          >
            {save.isPending && <SpinnerGap className="animate-spin" />}
            Guardar chequeo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
