import { z } from "zod"
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { prisma, withTenant } from "@/server/db/prisma"

const dailyProcedure = roleProcedure("OWNER", "MANAGER", "GROOM")

export const journalRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ horseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, (tx) => 
        tx.dailyJournal.findMany({
          where: {
            tenantId: ctx.tenantId,
            horseId: input.horseId,
          },
          orderBy: {
            date: "desc",
          },
        })
      )
    }),

  add: dailyProcedure
    .input(
      z.object({
        horseId: z.string(),
        date: z.date(),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch context (horse, last health event, diet, trainings)
      const horse = await withTenant(ctx.tenantId, (tx) => 
        tx.horse.findUnique({
          where: { id: input.horseId, tenantId: ctx.tenantId },
          include: {
            healthEvents: {
              where: { type: "VET_CHECKUP" },
              orderBy: { date: "desc" },
              take: 1,
            },
            trainings: {
              orderBy: { date: "desc" },
              take: 3,
            },
          },
        })
      )

      if (!horse) throw new Error("Caballo no encontrado")

      const vetContext = horse.healthEvents.length > 0 
        ? `Último chequeo veterinario: ${horse.healthEvents[0].date.toLocaleDateString()} - Notas: ${horse.healthEvents[0].notes || "Ninguna"}` 
        : "Sin historial veterinario reciente."

      // 2. Generate analysis with Gemini
      let aiAnalysis = null
      try {
        const { text } = await generateText({
          model: google("gemini-3.6-flash"),
          system: `Eres un asistente experto equino. El usuario acaba de registrar un evento en el diario para el caballo ${horse.name}.
Historial: ${vetContext}.
Tarea: Analiza la entrada del diario y da un breve aviso o recomendación nutricional/de entrenamiento (máximo 2 frases). Si todo es normal, di algo alentador. No uses formato Markdown complejo.`,
          prompt: `Entrada del diario: "${input.content}"`,
        })
        aiAnalysis = text
      } catch (error) {
        console.error("Error generating AI analysis:", error)
        // We don't fail the creation if AI fails
      }

      // 3. Save journal
      return withTenant(ctx.tenantId, (tx) => 
        tx.dailyJournal.create({
          data: {
            tenantId: ctx.tenantId,
            horseId: input.horseId,
            date: input.date,
            content: input.content,
            aiAnalysis: aiAnalysis,
          },
        })
      )
    }),
})
