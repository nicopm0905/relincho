"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/react";
import { toast } from "sonner";
import { CaretLeft, Baby } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const formSchema = z.object({
  mareId: z.string().min(1, "Debes seleccionar una yegua"),
  season: z.coerce.number().min(2000).max(2100),
  notes: z.string().optional(),
});

export default function NuevoCicloPage() {
  const router = useRouter();
  const params = useParams() as { tenantSlug: string };
  const searchParams = useSearchParams();
  const tenantSlug = params.tenantSlug;
  const initialMareId = searchParams.get("mareId") || "";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      mareId: initialMareId,
      season: new Date().getFullYear(),
      notes: "",
    },
  });
  

  const { data: horses, isLoading } = trpc.horses.list.useQuery();
  const mares = horses?.filter((h) => h.sex === "FEMALE") || [];

  const createCycle = trpc.reproduction.createCycle.useMutation({
    onSuccess: (data) => {
      toast.success("Ciclo iniciado correctamente");
      router.push(`/${tenantSlug}/reproduccion/${data.id}`);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || "Error al iniciar el ciclo");
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createCycle.mutate(values);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in-0 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 text-muted-foreground hover:text-foreground">
            <Link href={`/${tenantSlug}/reproduccion`}>
              <CaretLeft weight="bold" className="mr-1 h-4 w-4" />
              Volver a reproducción
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center border border-pink-200">
              <Baby weight="duotone" className="h-6 w-6" />
            </div>
            Iniciar Ciclo Reproductivo
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Abre un nuevo cuaderno de parideras para una yegua en esta temporada.
          </p>
        </div>
      </div>

      <Card className="bg-white shadow-bento border-border/40 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-pink-400 to-purple-400 w-full" />
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="mareId"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="font-bold">Yegua</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={mares.length === 0}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border/50">
                            <SelectValue placeholder={isLoading ? "Cargando yeguas..." : (mares.length === 0 ? "No hay yeguas registradas" : "Selecciona la yegua")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mares.map((mare) => (
                            <SelectItem key={mare.id} value={mare.id} className="py-3">
                              <span className="font-semibold">{mare.name}</span>
                              {mare.uelnCode ? <span className="text-muted-foreground text-xs ml-2">({mare.uelnCode})</span> : ""}
                            </SelectItem>
                          ))}
                          
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="season"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Temporada (Año)</FormLabel>
                      <FormControl>
                        <Input type="number" className="h-12 rounded-xl bg-muted/20 border-border/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Notas iniciales (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Cualquier información relevante antes del primer salto..."
                        className="resize-none min-h-[100px] rounded-xl bg-muted/20 border-border/50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
                <Button variant="ghost" asChild className="rounded-full">
                  <Link href={`/${tenantSlug}/reproduccion`}>Cancelar</Link>
                </Button>
                <Button type="submit" disabled={createCycle.isPending} className="rounded-full shadow-sm">
                  {createCycle.isPending ? "Iniciando..." : "Crear Cuaderno"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
