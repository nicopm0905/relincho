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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

const SELECT_TRANSLATIONS: Record<string, string> = {
  MALE: "Macho", FEMALE: "Hembra", UNKNOWN: "Desconocido", GELDING: "Macho (Castrado)",
  ACTIVE: "Activo", INACTIVE: "Inactivo", SOLD: "Vendido", DECEASED: "Fallecido",
  POSITIVE: "Positiva", NEGATIVE: "Negativa", TWINS: "Gemelos", REABSORBED: "Reabsorbida", ABORTION: "Aborto",
  NATURAL: "Monta Natural", AI_FRESH: "IA Fresco", AI_CHILLED: "IA Refrigerado", AI_FROZEN: "IA Congelado",
  DEWORMING: "Desparasitación", VACCINATION: "Vacunación", DENTISTRY: "Odontología", FARRIER: "Herrador", VET_CHECK: "Revisión Veterinaria", TREATMENT: "Tratamiento Médico", OTHER: "Otro"
};

const formSchema = z.object({
  date: z.string().min(1, "Debes seleccionar una fecha"),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  alive: z.boolean().default(true),
  notes: z.string().optional(),
});

interface FoalingDialogProps {
  coveringId: string;
}

export function FoalingDialog({ coveringId }: FoalingDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      alive: true,
      sex: "UNKNOWN",
    },
  });

  const addFoaling = trpc.reproduction.addFoaling.useMutation({
    onSuccess: () => {
      toast.success("Parto registrado correctamente");
      setOpen(false);
      form.reset();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || "Error al registrar el parto");
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    addFoaling.mutate({
      coveringId,
      date: new Date(values.date),
      sex: values.sex === "UNKNOWN" ? undefined : (values.sex as "MALE" | "FEMALE"),
      alive: values.alive,
      notes: values.notes,
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Registrar Parto</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Parto</DialogTitle>
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
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo del potro</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el sexo">
                          {(val: string) => SELECT_TRANSLATIONS[val] || val}
                        </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MALE">Macho</SelectItem>
                        <SelectItem value="FEMALE">Hembra</SelectItem>
                        <SelectItem value="UNKNOWN">Desconocido / No aplicable</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="alive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Nacido vivo</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Indica si el potro ha nacido vivo y sano.
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas sobre el parto</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Complicaciones, estado de la madre, retención de placenta..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addFoaling.isPending}>
                {addFoaling.isPending ? "Guardando..." : "Guardar Parto"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
      </Dialog>
    </>
  );
}

