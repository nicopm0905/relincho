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
import { Heartbeat, CalendarBlank, User, CurrencyEur } from "@phosphor-icons/react";
import { HealthEventType } from "@prisma/client";

const healthEventSchema = z.object({
  horseId: z.string().uuid(),
  type: z.nativeEnum(HealthEventType),
  name: z.string().min(1, "Requerido"),
  date: z.string().min(1, "Requerido"),
  nextDueDate: z.string().optional(),
  cost: z.number().positive("El coste debe ser mayor a 0").optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof healthEventSchema>;

interface HealthEventFormProps {
  tenantSlug: string;
  defaultHorseId?: string;
  horses: { id: string; name: string }[];
}

const typeLabels: Record<HealthEventType, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión general",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro"
};

export function HealthEventForm({ tenantSlug, defaultHorseId, horses }: HealthEventFormProps) {
  const router = useRouter();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm<FormData>({
    resolver: zodResolver(healthEventSchema) as any,
    defaultValues: {
      horseId: defaultHorseId || (horses.length === 1 ? horses[0].id : undefined),
      date: new Date().toISOString().split('T')[0],
      type: "VACCINE",
    }
  });

  const createMutation = trpc.health.create.useMutation({
    onSuccess: () => {
      toast.success("Registro guardado correctamente");
      if (defaultHorseId) {
        router.push(`/${tenantSlug}/caballos/${defaultHorseId}?tab=timeline`);
      } else {
        router.push(`/${tenantSlug}/sanidad`);
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
      nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
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
          <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Tipo</Label>
          <div className="relative">
            <select 
              {...register("type")} 
              className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none font-medium"
            >
              {Object.entries(typeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
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

      <div className="space-y-2">
        <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Tratamiento / Descripción</Label>
        <Input 
          {...register("name")} 
          placeholder="Ej: Vacuna Tétanos, Herrador completo..." 
          className="h-12 rounded-xl text-base"
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Próxima Fecha (Opcional)</Label>
          <div className="relative">
            <CalendarBlank className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input type="date" {...register("nextDueDate")} className="h-12 pl-10 rounded-xl text-base" />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Coste (€) (Opcional)</Label>
          <div className="relative">
            <CurrencyEur className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input type="number" step="0.01" {...register("cost", { valueAsNumber: true })} className="h-12 pl-10 rounded-xl text-base" placeholder="0.00" />
          </div>
          {errors.cost && <p className="text-sm text-destructive">{errors.cost.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Notas adicionales</Label>
        <Textarea {...register("notes")} className="rounded-xl min-h-[100px] text-base" placeholder="Cualquier observación relevante..." />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-xl text-lg font-bold shadow-md">
        {isSubmitting ? "Guardando..." : "Guardar Registro"}
      </Button>
    </form>
  );
}
