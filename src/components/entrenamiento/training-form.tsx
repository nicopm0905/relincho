"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarBlank, Clock, User } from "@phosphor-icons/react";

const trainingSchema = z.object({
  horseId: z.string().uuid(),
  date: z.string().min(1, "Requerido"),
  minutes: z.number().int().positive("Los minutos deben ser mayores a 0").default(45),
  type: z.string().optional(),
  riderName: z.string().optional(),
  notes: z.string().optional(),
  rpe: z.number().int().min(0).max(10),
});

/**
 * Esfuerzo percibido (RPE 0-10) en cuatro toques en vez de un numero: es lo
 * que alimenta la carga del caballo, el plan y la racion.
 */
const EFFORT = [
  { rpe: 3, label: "Suave", hint: "Paseo, cuerda floja" },
  { rpe: 5, label: "Normal", hint: "Trabajo habitual" },
  { rpe: 7, label: "Duro", hint: "Ha sudado bien" },
  { rpe: 9, label: "Muy duro", hint: "Al límite" },
] as const;

type FormInput = z.input<typeof trainingSchema>;
type FormData = z.output<typeof trainingSchema>;

interface TrainingFormProps {
  tenantSlug: string;
  defaultHorseId?: string;
  horses: { id: string; name: string }[];
}

const trainingTypes = [
  "Doma Clásica",
  "Salto",
  "Cuerda",
  "Paseo / Exterior",
  "Caminador",
  "Trote ligero",
  "Trabajo pie a tierra",
  "Otro"
];

export function TrainingForm({ tenantSlug, defaultHorseId, horses }: TrainingFormProps) {
  const router = useRouter();
  
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<
    FormInput,
    unknown,
    FormData
  >({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      horseId: defaultHorseId || (horses.length === 1 ? horses[0].id : undefined),
      date: new Date().toISOString().split('T')[0],
      minutes: 45,
      type: "Doma Clásica",
      rpe: 5,
    }
  });

  const createMutation = trpc.training.create.useMutation({
    onSuccess: () => {
      toast.success("Entrenamiento guardado correctamente");
      if (defaultHorseId) {
        router.push(`/${tenantSlug}/caballos/${defaultHorseId}?tab=timeline`);
      } else {
        router.push(`/${tenantSlug}/caballos`);
      }
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || "Error al guardar");
    }
  });

  const rpe = watch("rpe");

  const onSubmit = (data: FormData) => {
    createMutation.mutate({
      ...data,
      date: new Date(data.date),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      
      {!defaultHorseId && horses.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="trainingHorse" className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Caballo</Label>
          <div className="relative">
            <select
              id="trainingHorse"
              {...register("horseId")} 
              className="flex h-12 w-full items-center justify-between rounded-xl border border-input/90 bg-card px-3 py-2.5 text-base shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 appearance-none font-medium"
            >
              <option value="">Selecciona un caballo...</option>
              {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          {errors.horseId && <p role="alert" className="text-sm text-destructive">{errors.horseId.message}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="trainingType" className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Tipo de Trabajo</Label>
          <div className="relative">
            <select
              id="trainingType"
              {...register("type")} 
              className="flex h-12 w-full items-center justify-between rounded-xl border border-input/90 bg-card px-3 py-2.5 text-base shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 appearance-none font-medium"
            >
              {trainingTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="trainingDate" className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Fecha</Label>
          <div className="relative">
            <CalendarBlank className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input id="trainingDate" type="date" {...register("date")} className="h-12 pl-10 rounded-xl text-base" />
          </div>
          {errors.date && <p role="alert" className="text-sm text-destructive">{errors.date.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="trainingMinutes" className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Duración (min)</Label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input id="trainingMinutes" type="number" {...register("minutes", { valueAsNumber: true })} className="h-12 pl-10 rounded-xl text-base" />
          </div>
          {errors.minutes && <p role="alert" className="text-sm text-destructive">{errors.minutes.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="trainingRider" className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Jinete / Entrenador</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input id="trainingRider" type="text" {...register("riderName")} className="h-12 pl-10 rounded-xl text-base" placeholder="Nombre (opcional)" />
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">¿Cómo de duro?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EFFORT.map((option) => (
            <button
              key={option.rpe}
              type="button"
              aria-pressed={rpe === option.rpe}
              onClick={() => setValue("rpe", option.rpe)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                rpe === option.rpe
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="block text-xs">{option.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="trainingNotes" className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Progreso / Notas</Label>
        <Textarea id="trainingNotes" {...register("notes")} className="rounded-xl min-h-[100px] text-base" placeholder="Evaluación del caballo hoy..." />
      </div>

      <Button type="submit" disabled={isSubmitting} className="h-12 w-full text-base sm:text-lg">
        {isSubmitting ? "Guardando..." : "Registrar Sesión"}
      </Button>
    </form>
  );
}
