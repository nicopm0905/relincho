"use client"

import { useState, useEffect, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { trpc } from "@/lib/trpc/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MessageCircle, BrainCircuit, Trash2, AlertTriangle, CheckCircle2, Info } from "lucide-react"

export function HorseChat({
  horseId,
  horseName,
  tenantSlug,
}: {
  horseId: string;
  horseName: string;
  /** La yeguada va en cada consulta: un usuario puede estar en varias. */
  tenantSlug: string;
}) {
  const [input, setInput] = useState("")
  const storageKey = `equigest_chat_${horseId}`

  const { data: horseData } = trpc.horses.byId.useQuery({ id: horseId });
  const { data: journals } = trpc.journal.list.useQuery({ horseId });

  // Detección automática y proactiva de alertas por la IA
  const aiAlerts = useMemo(() => {
    const alerts: { type: "warning" | "info" | "success", message: string }[] = [];
    if (!horseData) return alerts;

    // 1. Verificación de revisiones médicas
    const lastVet = horseData.healthEvents?.find(h => h.type === "VET_CHECKUP");
    if (!lastVet) {
      alerts.push({ type: "warning", message: "Sin revisiones veterinarias periódicas registradas." });
    } else {
      const monthsSince = (new Date().getTime() - new Date(lastVet.date).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSince > 6) {
        alerts.push({ type: "warning", message: `La última revisión veterinaria fue hace más de 6 meses (${new Date(lastVet.date).toLocaleDateString()}).` });
      }
    }

    // 2. Análisis proactivo del diario reciente
    if (journals && journals.length > 0) {
      const recentContent = (journals[0].content || "").toLowerCase();
      if (recentContent.includes("cansado") || recentContent.includes("fatiga") || recentContent.includes("agotado")) {
        alerts.push({ type: "warning", message: "Aviso de salud: El caballo mostró signos de cansancio en la última nota del diario. Se recomienda jornada de reposo." });
      } else if (recentContent.includes("cojo") || recentContent.includes("dolor") || recentContent.includes("fiebre") || recentContent.includes("tos")) {
        alerts.push({ type: "warning", message: "Atención médica: Se ha detectado una anomalía física o sintomatología en la última anotación del diario." });
      }
    }

    // 3. Plan de alimentación
    if (!horseData.feedingPlan) {
      alerts.push({ type: "info", message: "No se ha configurado un plan de alimentación específico." });
    }

    if (alerts.length === 0) {
      alerts.push({ type: "success", message: `Estado saludable óptimo: No se han detectado anomalías en el historial de ${horseName}.` });
    }

    return alerts;
  }, [horseData, journals, horseName]);

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        horseId,
        tenantSlug,
      },
    }),
  })

  // Cargar historial persistido al montar el caballo
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch (e) {
      console.error("Error al cargar historial del chat:", e)
    }
  }, [horseId, storageKey, setMessages])

  // Guardar mensajes en localStorage tras cada cambio
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(messages))
      } catch (e) {
        console.error("Error al guardar historial del chat:", e)
      }
    }
  }, [messages, storageKey])

  const handleClearHistory = () => {
    try {
      localStorage.removeItem(storageKey)
      setMessages([])
    } catch (e) {
      console.error("Error al limpiar historial del chat:", e)
    }
  }

  const isLoading = status === "submitted" || status === "streaming"

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    const textToSend = input
    setInput("")
    await sendMessage({ text: textToSend })
  }

  const getMessageText = (m: any) => {
    if (typeof m.content === "string" && m.content) return m.content
    if (Array.isArray(m.parts)) {
      return m.parts
        .map((p: any) => (p.type === "text" ? p.text : ""))
        .join("")
    }
    return ""
  }

  const renderFormattedText = (text: string) => {
    // Split lines and parse **bold** text
    const lines = text.split("\n")
    return lines.map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g)
      const formattedLine = parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
        }
        return part
      })

      return (
        <span key={i} className="block">
          {formattedLine}
        </span>
      )
    })
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="py-4 border-b flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            Asistente {horseName}
          </CardTitle>
          <CardDescription>
            Consulta dudas, pide sugerencias o solicita registrar revisiones y entrenamientos.
          </CardDescription>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearHistory}
            title="Limpiar chat"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>

      {/* Banner de alertas e insights automáticos de la IA */}
      {aiAlerts.length > 0 && (
        <div className="p-3 bg-muted/50 border-b text-xs space-y-1.5">
          <div className="font-semibold flex items-center gap-1.5 text-foreground">
            <BrainCircuit className="w-3.5 h-3.5 text-primary" />
            Alertas de salud y rendimiento (Detección IA):
          </div>
          <div className="space-y-1">
            {aiAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-1.5 px-2.5 py-1 rounded-md ${
                  alert.type === "warning"
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 font-medium"
                    : alert.type === "info"
                    ? "bg-blue-500/15 text-blue-800 dark:text-blue-300"
                    : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {alert.type === "warning" && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                {alert.type === "info" && <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                {alert.type === "success" && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground">
            <MessageCircle className="w-10 h-10 opacity-20" />
            <p className="text-sm max-w-[250px]">
              Pregunta lo que necesites sobre la salud, alimentación o rutinas de {horseName}.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const text = getMessageText(m)
            if (!text && m.role === "assistant") return null
            return (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`px-3.5 py-2.5 rounded-xl max-w-[90%] text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  {renderFormattedText(text)}
                </div>
              </div>
            )
          })
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl rounded-tl-sm bg-muted text-sm italic">
              Escribiendo...
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
            <span>Error al comunicarse con la IA: {error.message || "Verifique la configuración del servidor."}</span>
          </div>
        )}
      </CardContent>
      <div className="p-3 border-t">
        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre su evolución..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input?.trim()}>
            Enviar
          </Button>
        </form>
      </div>
    </Card>
  )
}
