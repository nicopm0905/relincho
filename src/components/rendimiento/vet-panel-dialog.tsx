"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Stethoscope, SpinnerGap } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { disciplineLabels, reproductiveStatusLabels } from "./labels";

/** Etiquetas de restriccion que el motor de nutricion entiende. */
const RESTRICTION_OPTIONS = [
  { value: "tendencia_colico", label: "Tendencia a cólico" },
  { value: "limitar_almidon", label: "Limitar almidón" },
  { value: "insulinorresistencia", label: "Insulinorresistencia" },
  { value: "ulcera_gastrica", label: "Úlcera gástrica" },
];

interface VetProfile {
  discipline: string | null;
  baseWeightKg: unknown;
  reproductiveStatus: string;
  gestationMonth: number | null;
  tendonHistoryAlert: boolean;
  maxImpactSurfaceMinutes: number | null;
  maxRpe: number | null;
  restrictions: string[];
  notes: string | null;
}

interface Baseline {
  baseForageKg: unknown;
  baseConcentrateKg: unknown;
  proteinPercentTarget: number;
  mealsPerDay: number;
  minForagePctBodyweight: unknown;
  maxConcentrateKgPerDay: unknown;
  maxConcentrateKgPerMeal: unknown;
  maxElectrolytesGrams: number;
  maxVitaminEIu: number;
}

interface Props {
  horseId: string;
  horseName: string;
  profile: VetProfile | null;
  baseline: Baseline | null;
}

const num = (value: unknown, fallback: number) =>
  value == null ? String(fallback) : String(Number(value));

/** Titulo de seccion dentro del formulario. */
function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-0.5">
      <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
      </h3>
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Campo numerico con su unidad a la derecha, para no inflar la etiqueta. */
function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  hint,
}: {
  id: string;
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn("w-full", unit && "pr-11")}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Panel del veterinario: estado basal, restricciones de carga y techos de
 * seguridad de la dieta. Es el unico sitio donde se fijan los limites que el
 * calculo automatico nunca puede sobrepasar.
 */
export function VetPanelDialog({ horseId, horseName, profile, baseline }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [discipline, setDiscipline] = useState(profile?.discipline ?? "DOMA_CLASICA");
  const [weight, setWeight] = useState(num(profile?.baseWeightKg, 500));
  const [reproStatus, setReproStatus] = useState(profile?.reproductiveStatus ?? "NA");
  const [gestationMonth, setGestationMonth] = useState(
    profile?.gestationMonth ? String(profile.gestationMonth) : "",
  );
  const [tendon, setTendon] = useState(profile?.tendonHistoryAlert ?? false);
  const [maxImpact, setMaxImpact] = useState(
    profile?.maxImpactSurfaceMinutes ? String(profile.maxImpactSurfaceMinutes) : "",
  );
  const [maxRpe, setMaxRpe] = useState(profile?.maxRpe ? String(profile.maxRpe) : "");
  const [restrictions, setRestrictions] = useState<string[]>(
    profile?.restrictions ?? [],
  );

  const [forage, setForage] = useState(num(baseline?.baseForageKg, 8));
  const [concentrate, setConcentrate] = useState(num(baseline?.baseConcentrateKg, 1.5));
  const [protein, setProtein] = useState(String(baseline?.proteinPercentTarget ?? 12));
  const [meals, setMeals] = useState(String(baseline?.mealsPerDay ?? 3));
  const [minForagePct, setMinForagePct] = useState(
    num(baseline?.minForagePctBodyweight, 1.5),
  );
  const [maxConcentrate, setMaxConcentrate] = useState(
    num(baseline?.maxConcentrateKgPerDay, 5),
  );
  const [maxPerMeal, setMaxPerMeal] = useState(num(baseline?.maxConcentrateKgPerMeal, 2));
  const [maxElectrolytes, setMaxElectrolytes] = useState(
    String(baseline?.maxElectrolytesGrams ?? 90),
  );
  const [maxVitE, setMaxVitE] = useState(String(baseline?.maxVitaminEIu ?? 5000));

  const saveProfile = trpc.performance.upsertVetProfile.useMutation();
  const saveBaseline = trpc.nutrition.upsertBaseline.useMutation();
  const pending = saveProfile.isPending || saveBaseline.isPending;

  const isPregnant = reproStatus === "GESTANTE";
  const forageFloorKg =
    (Number(weight) || 0) * ((Number(minForagePct) || 0) / 100);

  const toggleRestriction = (value: string) =>
    setRestrictions((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );

  const handleSave = async () => {
    try {
      await saveProfile.mutateAsync({
        horseId,
        discipline: discipline as never,
        baseWeightKg: Number(weight) || undefined,
        reproductiveStatus: reproStatus as never,
        gestationMonth: isPregnant && gestationMonth ? Number(gestationMonth) : undefined,
        tendonHistoryAlert: tendon,
        maxImpactSurfaceMinutes: maxImpact ? Number(maxImpact) : undefined,
        maxRpe: maxRpe ? Number(maxRpe) : undefined,
        restrictions,
      });
      await saveBaseline.mutateAsync({
        horseId,
        baseForageKg: Number(forage) || 0,
        baseConcentrateKg: Number(concentrate) || 0,
        proteinPercentTarget: Number(protein) || 12,
        mealsPerDay: Number(meals) || 3,
        minForagePctBodyweight: Number(minForagePct) || 1.5,
        maxConcentrateKgPerDay: Number(maxConcentrate) || 0,
        maxConcentrateKgPerMeal: Number(maxPerMeal) || 2,
        maxElectrolytesGrams: Number(maxElectrolytes) || 90,
        maxVitaminEIu: Number(maxVitE) || 5000,
      });
      toast.success("Ficha veterinaria guardada");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la ficha",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Stethoscope weight="bold" className="mr-2 h-4 w-4" />
        Panel veterinario
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ficha veterinaria de {horseName}</DialogTitle>
          <DialogDescription>
            Lo que se fije aquí es un techo, no una sugerencia. El cálculo
            automático nunca prescribe por encima de estos límites.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="clinico">
          <TabsList className="w-full">
            <TabsTrigger value="clinico" className="flex-1">
              Estado clínico
            </TabsTrigger>
            <TabsTrigger value="dieta" className="flex-1">
              Dieta y techos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clinico" className="space-y-6 pt-4">
            <section className="space-y-3">
              <SectionTitle>Perfil deportivo</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Disciplina</Label>
                  <Select
                    items={disciplineLabels}
                    value={discipline}
                    onValueChange={(v) => setDiscipline(v ?? "DOMA_CLASICA")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(disciplineLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11.5px] text-muted-foreground">
                    Fija la carga semanal de referencia del plan.
                  </p>
                </div>
                <NumberField
                  id="weight"
                  label="Peso base"
                  unit="kg"
                  value={weight}
                  onChange={setWeight}
                  min={100}
                  max={1200}
                  hint="Base de todos los cálculos de ración."
                />
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle>Estado reproductivo</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Situación</Label>
                  <Select
                    items={reproductiveStatusLabels}
                    value={reproStatus}
                    onValueChange={(v) => setReproStatus(v ?? "NA")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(reproductiveStatusLabels).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {isPregnant && (
                  <NumberField
                    id="gestation"
                    label="Mes de gestación"
                    value={gestationMonth}
                    onChange={setGestationMonth}
                    min={1}
                    max={12}
                    placeholder="1 a 11"
                    hint="Desde el octavo mes suben proteína y tomas."
                  />
                )}
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle hint="Vacío significa sin límite. Solo se rellenan cuando hay motivo clínico.">
                Límites de carga
              </SectionTitle>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
                <div>
                  <Label htmlFor="tendon">Historial de tendón</Label>
                  <p className="text-[12px] text-muted-foreground">
                    Limita la intensidad a 8/10 y recorta el trabajo de impacto.
                  </p>
                </div>
                <Switch id="tendon" checked={tendon} onCheckedChange={setTendon} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  id="maxImpact"
                  label="Máximo sobre impacto"
                  unit="min"
                  placeholder="Sin límite"
                  value={maxImpact}
                  onChange={setMaxImpact}
                  min={0}
                  max={240}
                  hint="Por sesión, sobre pista o terreno duro."
                />
                <NumberField
                  id="maxRpe"
                  label="Intensidad máxima"
                  placeholder="Sin límite"
                  value={maxRpe}
                  onChange={setMaxRpe}
                  min={1}
                  max={10}
                  hint="Intensidad tope que puede programar el plan."
                />
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle hint="Condicionan la ración: reducen el almidón y fraccionan más las tomas.">
                Restricciones
              </SectionTitle>
              <div className="flex flex-wrap gap-2">
                {RESTRICTION_OPTIONS.map((option) => {
                  const active = restrictions.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleRestriction(option.value)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                        active
                          ? "border-transparent bg-foreground text-background"
                          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="dieta" className="space-y-6 pt-4">
            <section className="space-y-3">
              <SectionTitle hint="Lo que come el caballo un día sin trabajo. El plan suma sobre esto.">
                Ración base
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  id="forage"
                  label="Forraje"
                  unit="kg"
                  step="0.1"
                  value={forage}
                  onChange={setForage}
                  hint={
                    forageFloorKg > 0
                      ? `Mínimo por peso vivo: ${forageFloorKg.toFixed(1)} kg.`
                      : undefined
                  }
                />
                <NumberField
                  id="concentrate"
                  label="Concentrado"
                  unit="kg"
                  step="0.1"
                  value={concentrate}
                  onChange={setConcentrate}
                />
                <NumberField
                  id="protein"
                  label="Proteína objetivo"
                  unit="%"
                  value={protein}
                  onChange={setProtein}
                  min={8}
                  max={20}
                />
                <NumberField
                  id="meals"
                  label="Tomas al día"
                  value={meals}
                  onChange={setMeals}
                  min={2}
                  max={6}
                />
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-amber-300/70 bg-amber-50/50 p-3.5">
              <div className="space-y-0.5">
                <h3 className="text-[12px] font-semibold tracking-wide text-amber-900 uppercase">
                  Techos de seguridad
                </h3>
                <p className="text-[12px] text-amber-800">
                  Ningún cálculo automático puede superar estos valores, pase lo
                  que pase con el entrenamiento.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  id="minForagePct"
                  label="Forraje mínimo"
                  unit="%"
                  step="0.1"
                  value={minForagePct}
                  onChange={setMinForagePct}
                  hint="Sobre el peso vivo. Nunca baja de aquí."
                />
                <NumberField
                  id="maxConcentrate"
                  label="Máx. concentrado al día"
                  unit="kg"
                  step="0.1"
                  value={maxConcentrate}
                  onChange={setMaxConcentrate}
                />
                <NumberField
                  id="maxPerMeal"
                  label="Máx. concentrado por toma"
                  unit="kg"
                  step="0.1"
                  value={maxPerMeal}
                  onChange={setMaxPerMeal}
                  hint="Si se pasa, el sistema parte la ración en más tomas."
                />
                <NumberField
                  id="maxElectrolytes"
                  label="Máx. electrolitos"
                  unit="g"
                  value={maxElectrolytes}
                  onChange={setMaxElectrolytes}
                />
                <NumberField
                  id="maxVitE"
                  label="Máx. vitamina E"
                  unit="UI"
                  value={maxVitE}
                  onChange={setMaxVitE}
                />
              </div>
            </section>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <SpinnerGap className="animate-spin" />}
            Guardar ficha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
