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
import { CalendarBlank, Clock, User, Barbell } from "@phosphor-icons/react";

const trainingSchema = z.object({
  horseId: z.string().uuid(),
  date: z.string().min(1, "Requerido"),
  minutes: z.number().int().positive("Los minutos deben ser mayores a 0").default(45),
  type: z.string().optional(),
  riderName: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof trainingSchema>;

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
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(trainingSchema) as any,
    defaultValues: {
      horseId: defaultHorseId || (horses.length === 1 ? horses[0].id : undefined),
      date: new Date().toISOString().split('T')[0],
      minutes: 45,
      type: "Doma Clásica",
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
          <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Caballo</Label>
          <div className="relative">
            <select 
              {...register("horseId")} 
              className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none font-medium"
            >
              <option value="">Selecciona un caballo...</option>
              {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          {errors.horseId && <p className="text-sm text-destructive">{errors.horseId.message}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Tipo de Trabajo</Label>
          <div className="relative">
            <select 
              {...register("type")} 
              className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none font-medium"
            >
              {trainingTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Fecha</Label>
          <div className="relative">
            <CalendarBlank className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input type="date" {...register("date")} className="h-12 pl-10 rounded-xl text-base" />
          </div>
          {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Duración (min)</Label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input type="number" {...register("minutes", { valueAsNumber: true })} className="h-12 pl-10 rounded-xl text-base" />
          </div>
          {errors.minutes && <p className="text-sm text-destructive">{errors.minutes.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Jinete / Entrenador</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input type="text" {...register("riderName")} className="h-12 pl-10 rounded-xl text-base" placeholder="Nombre (opcional)" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Progreso / Notas</Label>
        <Textarea {...register("notes")} className="rounded-xl min-h-[100px] text-base" placeholder="Evaluación del caballo hoy..." />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-xl text-lg font-bold shadow-md bg-blue-600 hover:bg-blue-700 text-white">
        {isSubmitting ? "Guardando..." : "Registrar Sesión"}
      </Button>
    </form>
  );
}
