import { z } from "zod"
import { createTRPCRouter, tenantProcedure, roleProcedure } from "../init"
import { assertHorseAccess } from "../access";
import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { withTenant } from "@/server/db/prisma"
import { TRPCError } from "@trpc/server"

const dailyProcedure = roleProcedure("OWNER", "MANAGER", "GROOM")

export const journalRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ horseId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertHorseAccess(ctx, input.horseId);
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

  /** Corregir el texto. El analisis de IA se borra: hablaba del texto anterior. */
  update: dailyProcedure
    .input(z.object({ id: z.string().uuid(), content: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.dailyJournal.count({ where: { id: input.id, tenantId: ctx.tenantId } })
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
        return tx.dailyJournal.update({
          where: { id: input.id },
          data: { content: input.content, aiAnalysis: null },
        })
      })
    }),

  delete: dailyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.dailyJournal.count({ where: { id: input.id, tenantId: ctx.tenantId } })
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
        await tx.dailyJournal.delete({ where: { id: input.id } })
        return { id: input.id }
      })
    }),
})
