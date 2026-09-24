"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/react";
import { toast } from "sonner";
import { Plus } from "@phosphor-icons/react";
import { format } from "date-fns";

const SELECT_TRANSLATIONS: Record<string, string> = {
  MALE: "Macho", FEMALE: "Hembra", UNKNOWN: "Desconocido", GELDING: "Macho (Castrado)",
  ACTIVE: "Activo", INACTIVE: "Inactivo", SOLD: "Vendido", DECEASED: "Fallecido",
  POSITIVE: "Positiva", NEGATIVE: "Negativa", TWINS: "Gemelos", REABSORBED: "Reabsorbida", ABORTION: "Aborto",
  NATURAL: "Monta Natural", AI_FRESH: "IA Fresco", AI_CHILLED: "IA Refrigerado", AI_FROZEN: "IA Congelado",
  DEWORMING: "Desparasitación", VACCINATION: "Vacunación", DENTISTRY: "Odontología", FARRIER: "Herrador", VET_CHECK: "Revisión Veterinaria", TREATMENT: "Tratamiento Médico", OTHER: "Otro"
};

const methods = [
  { value: "NATURAL", label: "Monta Natural" },
  { value: "AI_FRESH", label: "IA Fresca" },
  { value: "AI_REFRIGERATED", label: "IA Refrigerada" },
  { value: "AI_FROZEN", label: "IA Congelada" },
  { value: "ET", label: "Transferencia Embrionaria" },
] as const;

const formSchema = z.object({
  stallionId: z.string().optional(),
  method: z.enum(["NATURAL", "AI_FRESH", "AI_REFRIGERATED", "AI_FROZEN", "ET"], {
    error: "Debes seleccionar un método",
  }),
  date: z.string().min(1, "Debes seleccionar una fecha"),
});

interface CreateCoveringDialogProps {
  cycleId: string;
}

export function CreateCoveringDialog({ cycleId }: CreateCoveringDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const params = useParams() as { tenantSlug: string };
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      method: "NATURAL",
      date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const { data: horses } = trpc.horses.list.useQuery();
  const stallions = horses?.filter((h) => h.sex === "MALE") || [];

  const addCovering = trpc.reproduction.addCovering.useMutation({
    onSuccess: () => {
      toast.success("Cubrición registrada correctamente");
      setOpen(false);
      form.reset();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || "Error al registrar la cubrición");
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    addCovering.mutate({
      cycleId,
      stallionId: values.stallionId || undefined,
      method: values.method,
      date: new Date(values.date),
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus weight="bold" className="mr-2 h-4 w-4" />
        Añadir Cubrición
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar nueva cubrición</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el método">
                          {(val: string) => SELECT_TRANSLATIONS[val] || val}
                        </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {methods.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="stallionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Semental (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={stallions.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={stallions.length === 0 ? "No hay sementales" : "Selecciona semental"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stallions.map((stallion) => (
                        <SelectItem key={stallion.id} value={stallion.id}>
                          {stallion.name}
                        </SelectItem>
                      ))}
                      
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addCovering.isPending}>
                {addCovering.isPending ? "Guardando..." : "Guardar Cubrición"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
      </Dialog>
    </>
  );
}

