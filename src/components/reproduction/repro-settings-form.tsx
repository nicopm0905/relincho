"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import {
  COVERING_METHODS,
  DEFAULT_REPRO_SETTINGS as D,
  MILESTONE_KINDS,
  type CoveringMethodKey,
  type ReproSettings,
} from "@/lib/repro-settings";
import { methodLabels, monthLabels } from "@/lib/repro-labels";
import { milestoneKindLabels } from "@/lib/repro-gestation";

type NumericKey = {
  [K in keyof ReproSettings]: ReproSettings[K] extends number ? K : never;
}[keyof ReproSettings];

function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  step = 1,
  hint,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="w-28"
        />
        <span className="text-[13px] text-muted-foreground">{unit}</span>
      </div>
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MonthPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number[];
  onChange: (value: number[]) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[13px] font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {monthLabels.map((m, i) => {
          const month = i + 1;
          const active = value.includes(month);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(active ? value.filter((x) => x !== month) : [...value, month].sort((a, b) => a - b))
              }
              className={cn(
                "min-h-9 w-12 rounded-lg border text-[12.5px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

export function ReproSettingsForm({ initial, canEdit }: { initial: ReproSettings; canEdit: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<ReproSettings>(initial);
  const set = <K extends keyof ReproSettings>(key: K, value: ReproSettings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));
  const num = (key: NumericKey, label: string, unit: string, opts: { step?: number } = {}) => (
    <NumberField
      id={`rs-${key}`}
      label={label}
      unit={unit}
      value={s[key]}
      onChange={(v) => set(key, v)}
      step={opts.step}
      hint={s[key] !== D[key] ? `Por defecto: ${D[key]} ${unit}` : undefined}
    />
  );

  const save = trpc.reproduction.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Parámetros guardados. Las predicciones ya los usan.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const reset = trpc.reproduction.resetSettings.useMutation({
    onSuccess: () => {
      setS(D);
      toast.success("Valores por defecto restaurados");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const setWindow = (m: CoveringMethodKey, side: "fromHours" | "toHours", value: number) =>
    set("breedingWindows", { ...s.breedingWindows, [m]: { ...s.breedingWindows[m], [side]: value } });

  const checkpoints = s.pregnancyCheckpoints;
  const setCheckpoint = (idx: number, patch: Partial<(typeof checkpoints)[number]>) =>
    set(
      "pregnancyCheckpoints",
      checkpoints.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(s);
      }}
      className="space-y-5"
    >
      <fieldset disabled={!canEdit} className="space-y-5">
        <Section
          title="Ciclo estral"
          description="La yegua es poliéstrica estacional: cicla con días largos y entra en anestro en invierno. Cada yegua aprende su propio ciclo a partir de sus ovulaciones."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {num("cycleLengthDays", "Duración del ciclo", "días")}
            {num("estrusLengthDays", "Duración del celo", "días")}
            {num("estrusFollicleMm", "Folículo que indica celo", "mm")}
          </div>
          <MonthPicker
            label="Meses de anestro esperado (sin programa de luz)"
            value={s.anestrusMonths}
            onChange={(v) => set("anestrusMonths", v)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rs-season-start">Temporada de cubriciones</Label>
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <NativeSelect
                  id="rs-season-start"
                  containerClassName="w-24"
                  value={s.breedingSeasonStartMonth}
                  onChange={(e) => set("breedingSeasonStartMonth", Number(e.target.value))}
                >
                  {monthLabels.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </NativeSelect>
                a
                <NativeSelect
                  aria-label="Fin de la temporada de cubriciones"
                  containerClassName="w-24"
                  value={s.breedingSeasonEndMonth}
                  onChange={(e) => set("breedingSeasonEndMonth", Number(e.target.value))}
                >
                  {monthLabels.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Ovulación e inducción"
          description="El folículo dominante crece unos 2-3 mm/día. Con hCG o deslorelina y un folículo ≥ 35 mm, la yegua ovula a las 36-48 h."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {num("preovulatoryFollicleMm", "Folículo preovulatorio", "mm")}
            {num("follicleGrowthMmPerDay", "Crecimiento folicular", "mm/día", { step: 0.1 })}
            {num("inductionMinFollicleMm", "Folículo mínimo para inducir", "mm")}
            {num("inductionToOvulationHours", "De inducción a ovulación", "horas")}
            {num("pgfMinDaysAfterOvulation", "PGF2α: días mínimos tras ovular", "días")}
            {num("pgfToEstrusDays", "PGF2α: días hasta el celo", "días")}
            {num("pgfToOvulationDays", "PGF2α: días hasta ovular", "días")}
          </div>
        </Section>

        <Section
          title="Ventanas de cubrición"
          description="Horas respecto a la ovulación (negativo = antes). El semen congelado tiene la ventana más estrecha."
        >
          <div className="space-y-3">
            {COVERING_METHODS.map((m) => (
              <div key={m} className="grid grid-cols-[1fr_auto_auto] items-end gap-3 sm:grid-cols-[220px_auto_auto_1fr]">
                <p className="pb-2 text-[13.5px] font-medium text-foreground">{methodLabels[m]}</p>
                <div className="space-y-1">
                  <Label htmlFor={`bw-${m}-from`} className="text-[12px] text-muted-foreground">Desde (h)</Label>
                  <Input
                    id={`bw-${m}-from`}
                    type="number"
                    className="w-24"
                    value={s.breedingWindows[m].fromHours}
                    onChange={(e) => setWindow(m, "fromHours", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`bw-${m}-to`} className="text-[12px] text-muted-foreground">Hasta (h)</Label>
                  <Input
                    id={`bw-${m}-to`}
                    type="number"
                    className="w-24"
                    value={s.breedingWindows[m].toHours}
                    onChange={(e) => setWindow(m, "toHours", Number(e.target.value))}
                  />
                </div>
                <label className="col-span-3 flex items-center gap-2 pb-2 text-[13px] text-muted-foreground sm:col-span-1">
                  <input
                    type="radio"
                    name="defaultMethod"
                    checked={s.defaultMethod === m}
                    onChange={() => set("defaultMethod", m)}
                  />
                  Método habitual
                </label>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Celo del potro"
          description="Primer celo tras el parto. Si la ovulación cae antes del día mínimo, la fertilidad es menor y se aconseja saltarlo."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {num("foalHeatFromDay", "Empieza el día", "postparto")}
            {num("foalHeatToDay", "Termina el día", "postparto")}
            {num("foalHeatMinOvulationDay", "Ovulación mínima", "día")}
          </div>
        </Section>

        <Section
          title="Gestación"
          description="Media de la especie ~340 días; es normal entre 320 y 365. Cada yegua tiende a repetir su duración y el sistema la aprende de sus partos."
        >
          <div className="grid gap-4 sm:grid-cols-4">
            {num("gestationDays", "Gestación media", "días")}
            {num("gestationMinDays", "Mínimo normal", "días")}
            {num("gestationMaxDays", "Máximo normal", "días")}
            {num("foalingWatchDays", "Vigilancia de parto", "días antes")}
          </div>
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-foreground">Ecografías de control (días desde la cubrición)</p>
            {checkpoints.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Nombre de la ecografía"
                  className="min-w-0 flex-1 sm:max-w-xs"
                  value={c.label}
                  onChange={(e) => setCheckpoint(i, { label: e.target.value })}
                />
                <Input
                  aria-label="Desde el día"
                  type="number"
                  className="w-20"
                  value={c.from}
                  onChange={(e) => setCheckpoint(i, { from: Number(e.target.value) })}
                />
                <span className="text-[13px] text-muted-foreground">a</span>
                <Input
                  aria-label="Hasta el día"
                  type="number"
                  className="w-20"
                  value={c.to}
                  onChange={(e) => setCheckpoint(i, { to: Number(e.target.value) })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${c.label}`}
                  onClick={() => set("pregnancyCheckpoints", checkpoints.filter((_, j) => j !== i))}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {checkpoints.length < 8 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const last = checkpoints[checkpoints.length - 1];
                  const from = last ? last.to + 10 : 14;
                  set("pregnancyCheckpoints", [
                    ...checkpoints,
                    { key: `custom-${Date.now()}`, label: "Nueva ecografía", from, to: from + 10 },
                  ]);
                }}
              >
                <Plus /> Añadir ecografía
              </Button>
            )}
          </div>
        </Section>

        <Section
          title="Hitos de la gestación"
          description="Cada hito se convierte en una tarea para la yegua gestante unos días antes. Vacunas de rinoneumonitis (EHV-1) en los meses 5, 7 y 9; refuerzos 4-6 semanas antes del parto; desparasitar un mes antes."
        >
          <div className="space-y-2">
            {s.gestationMilestones.map((m, i) => {
              const setM = (patch: Partial<typeof m>) =>
                set(
                  "gestationMilestones",
                  s.gestationMilestones.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                );
              return (
                <div key={m.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2">
                  <Input
                    aria-label="Nombre del hito"
                    className="min-w-0 flex-1 basis-56"
                    value={m.label}
                    onChange={(e) => setM({ label: e.target.value })}
                  />
                  <NativeSelect
                    aria-label="Tipo de hito"
                    containerClassName="w-auto"
                    value={m.kind}
                    onChange={(e) => setM({ kind: e.target.value as typeof m.kind })}
                  >
                    {MILESTONE_KINDS.map((k) => (
                      <option key={k} value={k}>{milestoneKindLabels[k]}</option>
                    ))}
                  </NativeSelect>
                  <Input
                    aria-label="Días"
                    type="number"
                    className="w-20"
                    value={m.day}
                    onChange={(e) => setM({ day: Number(e.target.value) })}
                  />
                  <NativeSelect
                    aria-label="Referencia"
                    containerClassName="w-auto"
                    value={m.anchor}
                    onChange={(e) => setM({ anchor: e.target.value as typeof m.anchor })}
                  >
                    <option value="COVERING">días tras la cubrición</option>
                    <option value="FOALING">días antes del parto</option>
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar ${m.label}`}
                    onClick={() => set("gestationMilestones", s.gestationMilestones.filter((_, j) => j !== i))}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {s.gestationMilestones.length < 15 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set("gestationMilestones", [
                    ...s.gestationMilestones,
                    { key: `custom-${Date.now()}`, label: "Nuevo hito", kind: "MANAGEMENT", anchor: "FOALING", day: 30 },
                  ])
                }
              >
                <Plus /> Añadir hito
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {num("milestoneTaskLeadDays", "Crear la tarea con", "días de antelación")}
          </div>
        </Section>

        <Section
          title="Preparto y potro"
          description="Calcio en leche ≥ 200 ppm: parto probable en 24-72 h. Regla 1-2-3 del potro e IgG a las 12-24 h (< 400 mg/dl, fallo de transferencia)."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {num("milkCalciumAlertPpm", "Aviso de calcio en leche", "ppm")}
            {num("foalStandMaxMinutes", "Potro de pie antes de", "min")}
            {num("foalSuckleMaxMinutes", "Potro mamando antes de", "min")}
            {num("placentaMaxMinutes", "Placenta fuera antes de", "min")}
            {num("iggFailureMgDl", "IgG: fallo por debajo de", "mg/dl")}
            {num("iggAdequateMgDl", "IgG: adecuada desde", "mg/dl")}
          </div>
        </Section>

        <Section title="Aprendizaje por yegua">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="rs-learn" className="font-normal text-muted-foreground">
              Usar la duración del ciclo, el folículo preovulatorio y la gestación que cada yegua ha
              mostrado en su historial (si hay datos suficientes) en lugar de los valores de la yeguada.
            </Label>
            <Switch id="rs-learn" checked={s.learnFromHistory} onCheckedChange={(v) => set("learnFromHistory", v)} />
          </div>
        </Section>
      </fieldset>

      {canEdit && (
        <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-border bg-background/95 p-3 shadow-raised backdrop-blur sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" disabled={reset.isPending} onClick={() => reset.mutate()}>
            Restaurar valores por defecto
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Guardando…" : "Guardar parámetros"}
          </Button>
        </div>
      )}
    </form>
  );
}
