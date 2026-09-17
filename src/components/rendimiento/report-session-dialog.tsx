"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Microphone, SpinnerGap } from "@phosphor-icons/react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { fatigueZoneLabels } from "./labels";

/** Lo que el jinete diria en voz alta para cada nivel de intensidad. */
const RPE_HINTS: Record<number, string> = {
  1: "Paseo suelto",
  2: "Muy suave",
  3: "Suave",
  4: "Cómodo",
  5: "Moderado",
  6: "Algo exigente",
  7: "Durillo",
  8: "Fuerte",
  9: "Muy fuerte",
  10: "Al máximo",
};

const SWEAT_OPTIONS = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
];

/** Zona de fatiga estimada en vivo, con los mismos umbrales que el backend. */
function previewZone(load: number): keyof typeof fatigueZoneLabels {
  if (load < 200) return "BAJA";
  if (load <= 400) return "MEDIA";
  return "ALTA";
}

interface Props {
  horseId: string;
  horseName: string;
  /** Minutos e intensidad previstos, usados como valores de partida. */
  plannedMinutes?: number;
  plannedRpe?: number;
  /** Dia al que se imputa la sesion. Por defecto, hoy. */
  sessionDate?: Date;
  /** Texto del boton que abre el dialogo. */
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}

export function ReportSessionDialog({
  horseId,
  horseName,
  plannedMinutes = 45,
  plannedRpe = 6,
  sessionDate,
  triggerLabel = "Reportar sesión",
  triggerVariant,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(plannedMinutes);
  const [rpe, setRpe] = useState(plannedRpe);
  const [sweatLoss, setSweatLoss] = useState("MEDIA");
  const [heartRate, setHeartRate] = useState("");
  const [notes, setNotes] = useState("");
  const [fatigue, setFatigue] = useState(false);
  const [strength, setStrength] = useState(false);

  const report = trpc.performance.reportSession.useMutation({
    onSuccess: (result) => {
      const adjusted = result.adjustments.length;
      toast.success(
        adjusted > 0
          ? `Sesión registrada. Se han reajustado ${adjusted} días del mesociclo.`
          : "Sesión registrada. El plan sigue su curso.",
      );
      setOpen(false);
      setNotes("");
      setHeartRate("");
      setFatigue(false);
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo registrar la sesión"),
  });

  const load = minutes * rpe;
  const zone = previewZone(load);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} />}>
        <Microphone weight="fill" className="mr-2 h-4 w-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sesión de {horseName}</DialogTitle>
          <DialogDescription>
            Solo dos datos: cuánto ha durado y cómo de duro ha sido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="minutes">Duración</Label>
              <span className="text-[13px] font-medium tabular-nums text-foreground">
                {minutes} min
              </span>
            </div>
            <input
              id="minutes"
              type="range"
              min={0}
              max={120}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
            />
            <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>0</span>
              <span>60</span>
              <span>120</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Intensidad (según el jinete)</Label>
              <span className="text-[13px] text-muted-foreground">
                {RPE_HINTS[rpe] ?? "—"}
              </span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={rpe === value}
                  aria-label={`Intensidad ${value} de 10: ${RPE_HINTS[value]}`}
                  onClick={() => setRpe(value)}
                  className={cn(
                    "rounded-md border py-1.5 text-[12.5px] font-medium tabular-nums transition-colors",
                    rpe === value
                      ? "border-transparent bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-baseline justify-between rounded-lg border border-border bg-muted/50 px-3.5 py-3">
            <div>
              <div className="text-[12.5px] text-muted-foreground">
                Carga interna estimada
              </div>
              <div className="text-[12px] text-muted-foreground">
                {fatigueZoneLabels[zone]}
              </div>
            </div>
            <div className="text-[22px] leading-none font-semibold tabular-nums text-foreground">
              {load}
              <span className="ml-1 text-[12px] font-medium text-muted-foreground">
                UA
              </span>
            </div>
          </div>

          {/* Dato medido y opcional: la intensidad la pone el jinete, esto solo
              la matiza cuando hay pulsómetro. */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="heartRate">Frecuencia cardiaca</Label>
              <span className="text-[12px] text-muted-foreground">Opcional</span>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                id="heartRate"
                type="number"
                inputMode="numeric"
                min={20}
                max={260}
                placeholder="—"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="h-9 w-24 rounded-md border border-border bg-card px-3 text-[13px] tabular-nums text-foreground outline-none focus-visible:border-foreground/30"
              />
              <span className="text-[12.5px] text-muted-foreground">
                ppm de media, si lo has medido
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sudoración</Label>
            <div className="flex gap-2">
              {SWEAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={sweatLoss === option.value}
                  onClick={() => setSweatLoss(option.value)}
                  className={cn(
                    "flex-1 rounded-md border py-1.5 text-[12.5px] font-medium transition-colors",
                    sweatLoss === option.value
                      ? "border-transparent bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas del jinete</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trabajo fuerte de galope, mucha calor hoy."
            />
          </div>

          <div className="divide-y divide-border/70 rounded-lg border border-border">
            <div className="flex items-center justify-between gap-4 px-3.5 py-3">
              <div>
                <Label htmlFor="fatigue">Ha acusado fatiga</Label>
                <p className="text-[12px] text-muted-foreground">
                  Fuerza la descarga del resto del mesociclo.
                </p>
              </div>
              <Switch id="fatigue" checked={fatigue} onCheckedChange={setFatigue} />
            </div>
            <div className="flex items-center justify-between gap-4 px-3.5 py-3">
              <div>
                <Label htmlFor="strength">Fuerza o potencia</Label>
                <p className="text-[12px] text-muted-foreground">
                  Sube la proteína de la ración nocturna.
                </p>
              </div>
              <Switch id="strength" checked={strength} onCheckedChange={setStrength} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={report.isPending}
            onClick={() =>
              report.mutate({
                horseId,
                date: sessionDate ?? new Date(),
                minutes,
                rpe,
                notes: notes || undefined,
                sweatLoss: sweatLoss as "BAJA" | "MEDIA" | "ALTA",
                heartRateBpm: heartRate ? Number(heartRate) : undefined,
                riderReportedFatigue: fatigue,
                strengthSession: strength,
              })
            }
          >
            {report.isPending && <SpinnerGap className="animate-spin" />}
            Guardar y recalcular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
