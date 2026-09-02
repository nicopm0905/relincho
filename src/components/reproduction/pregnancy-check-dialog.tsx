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
import { format } from "date-fns";

const SELECT_TRANSLATIONS: Record<string, string> = {
  MALE: "Macho", FEMALE: "Hembra", UNKNOWN: "Desconocido", GELDING: "Macho (Castrado)",
  ACTIVE: "Activo", INACTIVE: "Inactivo", SOLD: "Vendido", DECEASED: "Fallecido",
  POSITIVE: "Positiva", NEGATIVE: "Negativa", TWINS: "Gemelos", REABSORBED: "Reabsorbida", ABORTION: "Aborto",
  NATURAL: "Monta Natural", AI_FRESH: "IA Fresco", AI_CHILLED: "IA Refrigerado", AI_FROZEN: "IA Congelado",
  DEWORMING: "Desparasitación", VACCINATION: "Vacunación", DENTISTRY: "Odontología", FARRIER: "Herrador", VET_CHECK: "Revisión Veterinaria", TREATMENT: "Tratamiento Médico", OTHER: "Otro"
};

const results = [
  { value: "POSITIVE", label: "Positiva" },
  { value: "NEGATIVE", label: "Negativa" },
  { value: "TWINS", label: "Gemelos" },
  { value: "REABSORBED", label: "Reabsorbida" },
  { value: "ABORTION", label: "Aborto" },
];

const formSchema = z.object({
  date: z.string().min(1, "Debes seleccionar una fecha"),
  result: z.string().min(1, "Debes seleccionar un resultado"),
  dayOfPregnancy: z.coerce.number().optional(),
});

interface PregnancyCheckDialogProps {
  coveringId: string;
}

export function PregnancyCheckDialog({ coveringId }: PregnancyCheckDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      result: "POSITIVE",
      dayOfPregnancy: undefined,
    },
  });

  const addPregnancyCheck = trpc.reproduction.addPregnancyCheck.useMutation({
    onSuccess: () => {
      toast.success("Ecografía registrada correctamente");
      setOpen(false);
      form.reset();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || "Error al registrar la ecografía");
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    addPregnancyCheck.mutate({
      coveringId,
      date: new Date(values.date),
      result: values.result,
      dayOfPregnancy: values.dayOfPregnancy,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Registrar Eco
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Control de Gestación (Eco)</DialogTitle>
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
                name="dayOfPregnancy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Día de Gestación (Ej. 14, 45)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resultado</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el resultado">
                          {(val: string) => SELECT_TRANSLATIONS[val] || val}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {results.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
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
              <Button type="submit" disabled={addPregnancyCheck.isPending}>
                {addPregnancyCheck.isPending ? "Guardando..." : "Guardar Eco"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

