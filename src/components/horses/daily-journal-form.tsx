"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { trpc } from "@/lib/trpc/react"
import { toast } from "sonner"
import { Brain } from "@phosphor-icons/react"

const formSchema = z.object({
  content: z.string().min(5, "El diario debe tener al menos 5 caracteres"),
})

export function DailyJournalForm({ horseId, horseName }: { horseId: string, horseName: string }) {
  const utils = trpc.useUtils()
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
    },
  })

  const addJournal = trpc.journal.add.useMutation({
    onSuccess: () => {
      toast.success("Diario guardado correctamente (Análisis automático generado)")
      form.reset()
      utils.journal.list.invalidate({ horseId })
    },
    onError: (error) => {
      toast.error(`Error al guardar: ${error.message}`)
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    addJournal.mutate({
      horseId,
      date: new Date(),
      content: values.content,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Diario Rápido
          <Brain className="w-4 h-4 text-muted-foreground" />
        </CardTitle>
        <CardDescription>
          Anota lo que ha hecho hoy {horseName} (comida, ejercicio, estado de ánimo). La IA lo analizará al guardar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea 
                      placeholder="Hoy comió avena, entrenamos 2 horas salto y estaba algo cansado..." 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={addJournal.isPending}>
                {addJournal.isPending ? "Guardando y Analizando..." : "Guardar Diario"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
