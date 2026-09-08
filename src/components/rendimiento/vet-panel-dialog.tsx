"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Stethoscope, SpinnerGap } from "@phosphor-icons/react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/**
 * Panel del veterinario: estado basal, restricciones de carga y techos de
 * seguridad de la dieta. Es el unico sitio donde se fijan los limites que la
 * IA nunca puede sobrepasar.
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
        gestationMonth: gestationMonth ? Number(gestationMonth) : undefined,
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ficha veterinaria de {horseName}</DialogTitle>
          <DialogDescription>
            Estado basal, restricciones de carga y techos de la dieta. El motor
            nunca prescribe por encima de estos límites.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="clinico">
          <TabsList className="w-full">
            <TabsTrigger value="clinico">Estado clínico</TabsTrigger>
            <TabsTrigger value="dieta">Dieta y techos</TabsTrigger>
          </TabsList>

          <TabsContent value="clinico" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Disciplina</Label>
                <Select
                  value={discipline}
                  onValueChange={(v) => setDiscipline(v ?? "DOMA_CLASICA")}
                >
                  <SelectTrigger>
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
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weight">Peso base (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estado reproductivo</Label>
                <Select
                  value={reproStatus}
                  onValueChange={(v) => setReproStatus(v ?? "NA")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(reproductiveStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reproStatus === "GESTANTE" && (
                <div className="space-y-1.5">
                  <Label htmlFor="gestation">Mes de gestación</Label>
                  <Input
                    id="gestation"
                    type="number"
                    min={1}
                    max={12}
                    value={gestationMonth}
                    onChange={(e) => setGestationMonth(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
              <div>
                <Label htmlFor="tendon">Historial de tendón</Label>
                <p className="text-[12px] text-muted-foreground">
                  Limita la intensidad a RPE 8 y recorta el trabajo de impacto.
                </p>
              </div>
              <Switch id="tendon" checked={tendon} onCheckedChange={setTendon} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="maxImpact">Máx. minutos de impacto</Label>
                <Input
                  id="maxImpact"
                  type="number"
                  placeholder="Sin límite"
                  value={maxImpact}
                  onChange={(e) => setMaxImpact(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxRpe">RPE máximo</Label>
                <Input
                  id="maxRpe"
                  type="number"
                  min={1}
                  max={10}
                  placeholder="Sin límite"
                  value={maxRpe}
                  onChange={(e) => setMaxRpe(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Restricciones</Label>
              <div className="flex flex-wrap gap-2">
                {RESTRICTION_OPTIONS.map((option) => {
                  const active = restrictions.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleRestriction(option.value)}
                      aria-pressed={active}
                      className={`rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                        active
                          ? "border-transparent bg-foreground text-background"
                          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dieta" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="forage">Forraje base (kg)</Label>
                <Input
                  id="forage"
                  type="number"
                  step="0.1"
                  value={forage}
                  onChange={(e) => setForage(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="concentrate">Concentrado base (kg)</Label>
                <Input
                  id="concentrate"
                  type="number"
                  step="0.1"
                  value={concentrate}
                  onChange={(e) => setConcentrate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="protein">Proteína objetivo (%)</Label>
                <Input
                  id="protein"
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meals">Tomas al día</Label>
                <Input
                  id="meals"
                  type="number"
                  min={2}
                  max={6}
                  value={meals}
                  onChange={(e) => setMeals(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-amber-300/70 bg-amber-50/50 p-3.5">
              <p className="text-[13px] font-semibold text-amber-900">
                Techos de seguridad
              </p>
              <p className="mt-0.5 text-[12px] text-amber-800">
                Ningún cálculo automático puede superar estos valores.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="minForagePct">Forraje mínimo (% peso vivo)</Label>
                  <Input
                    id="minForagePct"
                    type="number"
                    step="0.1"
                    value={minForagePct}
                    onChange={(e) => setMinForagePct(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxConcentrate">Máx. concentrado (kg/día)</Label>
                  <Input
                    id="maxConcentrate"
                    type="number"
                    step="0.1"
                    value={maxConcentrate}
                    onChange={(e) => setMaxConcentrate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxPerMeal">Máx. concentrado (kg/toma)</Label>
                  <Input
                    id="maxPerMeal"
                    type="number"
                    step="0.1"
                    value={maxPerMeal}
                    onChange={(e) => setMaxPerMeal(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxElectrolytes">Máx. electrolitos (g)</Label>
                  <Input
                    id="maxElectrolytes"
                    type="number"
                    value={maxElectrolytes}
                    onChange={(e) => setMaxElectrolytes(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxVitE">Máx. vitamina E (UI)</Label>
                  <Input
                    id="maxVitE"
                    type="number"
                    value={maxVitE}
                    onChange={(e) => setMaxVitE(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <SpinnerGap className="animate-spin" />}
            Guardar ficha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
