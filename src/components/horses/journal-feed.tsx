"use client"

import { trpc } from "@/lib/trpc/react"
import { BrainCircuit, Loader2 } from "lucide-react"

export function JournalFeed({ horseId }: { horseId: string }) {
  const { data: journals, isLoading } = trpc.journal.list.useQuery({ horseId })

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!journals || journals.length === 0) {
    return (
      <div className="text-center p-8 border rounded-xl border-dashed">
        <p className="text-sm text-muted-foreground">Aún no hay entradas en el diario.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {journals.map((journal) => (
        <div key={journal.id} className="p-4 border rounded-xl shadow-sm bg-white">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {new Date(journal.date).toLocaleDateString()} a las {new Date(journal.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{journal.content}</p>
          
          {journal.aiAnalysis && (
            <div className="mt-4 bg-primary/5 p-3 rounded-lg border-l-4 border-primary">
              <div className="flex items-center gap-2 mb-1">
                <BrainCircuit className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Análisis IA</span>
              </div>
              <p className="text-sm text-primary/90 leading-relaxed">{journal.aiAnalysis}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
