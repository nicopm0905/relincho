import { google } from "@ai-sdk/google";
import { streamText, tool, convertToModelMessages, isStepCount } from "ai";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { auth } from "@/server/auth";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, horseId } = await req.json();
    const session = await auth();

    if (!session?.user) {
      return new Response("No estás autenticado. Por favor inicia sesión.", { status: 401 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return new Response("Falta la clave de API (GOOGLE_GENERATIVE_AI_API_KEY) en el archivo .env. Añade una API key válida de Google Gemini para usar el asistente.", { status: 400 });
    }

    // Obtenemos los memberships del usuario para saber a qué tenants pertenece
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { memberships: true }
    });
    
    if (!user || user.memberships.length === 0) {
      return new Response("No tenant found", { status: 400 });
    }

    const tenantId = user.memberships[0].tenantId;
    const modelMessages = await convertToModelMessages(messages);

    // Pre-obtener contexto del caballo para respuesta ultrarrápida sin latencia de herramientas
    let horseContextText = "";
    if (horseId) {
      const horse = await prisma.horse.findFirst({
        where: { tenantId, id: horseId },
        select: {
          name: true,
          breed: true,
          sex: true,
          birthDate: true,
          healthEvents: {
            where: { type: "VET_CHECKUP" },
            orderBy: { date: "desc" },
            take: 1,
            select: { date: true, name: true, notes: true }
          },
          trainings: {
            orderBy: { date: "desc" },
            take: 3,
            select: { date: true, type: true, minutes: true, notes: true }
          },
          feedingPlan: {
            select: { items: true }
          },
          dailyJournals: {
            orderBy: { date: "desc" },
            take: 3,
            select: { date: true, content: true, aiAnalysis: true }
          }
        }
      });

      if (horse) {
        const age = horse.birthDate ? new Date().getFullYear() - horse.birthDate.getFullYear() : "Desconocida";
        const vet = horse.healthEvents[0]
          ? `Último chequeo (${horse.healthEvents[0].date.toLocaleDateString()}): ${horse.healthEvents[0].notes || horse.healthEvents[0].name}`
          : "Sin chequeos recientes";
        const train = horse.trainings.length
          ? horse.trainings.map(t => `${t.date.toLocaleDateString()} ${t.type || "Entrenamiento"} (${t.minutes} min)`).join(", ")
          : "Sin entrenamientos recientes";
        const diet = horse.feedingPlan ? JSON.stringify(horse.feedingPlan.items) : "Sin plan configurado";
        const journal = horse.dailyJournals.length
          ? horse.dailyJournals.map(j => `${j.date.toLocaleDateString()}: "${j.content}"`).join("; ")
          : "Sin entradas recientes";

        horseContextText = `\n\n[CONTEXTO DEL CABALLO ATENDIDO]\n- Nombre: ${horse.name}\n- Raza: ${horse.breed || "Desconocida"}\n- Edad: ${age} años\n- Sexo: ${horse.sex}\n- Chequeo veterinario: ${vet}\n- Entrenamientos recientes: ${train}\n- Plan alimentación: ${diet}\n- Diario reciente: ${journal}`;
      }
    }

    const result = streamText({
      model: google("gemini-3.6-flash"),
      system: `Eres un experto asistente veterinario y entrenador de caballos (IA) para la aplicación Equigest/Relincho. Tu objetivo es ayudar al usuario a entender el estado de sus caballos, recomendar planes de entrenamiento, detectar problemas y registrar eventos médicos y de entrenamiento.

Tienes herramientas para GUARDAR REGISTROS directamente en la base de datos de Equigest:
- 'createHealthEvent': para crear eventos de salud (vacunas, revisiones veterinarias, herrador, tratamientos, lesiones).
- 'createTrainingSession': para registrar entrenamientos realizados o planificados.

Si el usuario te pide registrar, agendar o guardar una revisión, vacuna o entrenamiento, EJECUTA INMEDIATAMENTE la herramienta correspondiente para guardarlo en la base de datos y confirma el registro al usuario.

Como el chat está dentro de la ficha de un caballo específico, usa el contexto proporcionado para responder sus dudas de forma inmediata. Responde de forma clara, amigable y bien estructurada mediante párrafos separados y viñetas simples. No uses separadores '---' ni encabezados complejos con '###'. Utiliza negritas (**texto**) para destacar los nombres de secciones y datos importantes.${horseContextText}`,
      messages: modelMessages,
      stopWhen: isStepCount(2),
      tools: {
        createHealthEvent: tool({
          description: "Registra o agenda un evento de salud o revisión médica para el caballo (vacuna, desparasitación, herrador, chequeo veterinario, tratamiento, lesión u otros).",
          inputSchema: z.object({
            type: z.enum(["VACCINE", "DEWORMING", "DENTAL", "FARRIER", "VET_CHECKUP", "TREATMENT", "INJURY", "OTHER"]).describe("Tipo de evento de salud"),
            name: z.string().describe("Nombre o título del evento (ej: Vacuna de la Gripe, Revisión dental, Chequeo veterinario general)"),
            date: z.string().describe("Fecha del evento en formato YYYY-MM-DD"),
            notes: z.string().optional().describe("Notas adicionales o instrucciones del veterinario"),
          }),
          execute: async ({ type, name, date, notes }: { type: string, name: string, date: string, notes?: string }) => {
            if (!horseId) return "No se proporcionó ID de caballo.";
            const eventDate = new Date(date);
            const newEvent = await prisma.healthEvent.create({
              data: {
                tenantId,
                horseId,
                type: type as any,
                name,
                date: eventDate,
                notes: notes || null
              }
            });
            return `Evento de salud '${name}' de tipo '${type}' registrado con éxito en la base de datos para la fecha ${eventDate.toLocaleDateString()}.`;
          }
        }),
        createTrainingSession: tool({
          description: "Registra una sesión de entrenamiento realizada o planificada para el caballo.",
          inputSchema: z.object({
            minutes: z.number().describe("Duración del entrenamiento en minutos"),
            type: z.string().optional().describe("Tipo de entrenamiento (ej: Salto, Doma, Cuerda, Paseo)"),
            date: z.string().optional().describe("Fecha en formato YYYY-MM-DD. Si no se especifica se usa la fecha actual."),
            notes: z.string().optional().describe("Observaciones o notas sobre el rendimiento del caballo"),
          }),
          execute: async ({ minutes, type, date, notes }: { minutes: number, type?: string, date?: string, notes?: string }) => {
            if (!horseId) return "No se proporcionó ID de caballo.";
            const eventDate = date ? new Date(date) : new Date();
            const newTraining = await prisma.trainingSession.create({
              data: {
                tenantId,
                horseId,
                minutes,
                type: type || "Entrenamiento",
                date: eventDate,
                notes: notes || null
              }
            });
            return `Sesión de entrenamiento (${type || "Entrenamiento"}, ${minutes} min) registrada con éxito en la base de datos para la fecha ${eventDate.toLocaleDateString()}.`;
          }
        }),
        generateTrainingPlan: tool({
          description: "Genera un borrador de plan de entrenamiento para un objetivo competitivo.",
          inputSchema: z.object({
            targetDate: z.string().describe("Fecha objetivo de la competición (YYYY-MM-DD)"),
          }),
          execute: async ({ targetDate }: { targetDate: string }) => {
            return `Planificación solicitada para la fecha ${targetDate}. La IA debe sugerir la estructura basándose en esta confirmación.`;
          }
        }),
        updateFeedingPlan: tool({
          description: "Configura o actualiza la dieta o plan de alimentación diaria del caballo.",
          inputSchema: z.object({
            items: z.array(
              z.object({
                meal: z.enum(["MAÑANA", "MEDIODIA", "TARDE", "NOCHE"]).describe("Momento de la comida"),
                food: z.string().describe("Nombre del alimento (ej: Pienso Alta Energía, Heno de Alfalfa, Avena)"),
                quantity: z.string().describe("Cantidad (ej: 2 kg, 1 copo, 500g)")
              })
            ).describe("Lista de raciones diarias que componen el plan de alimentación")
          }),
          execute: async ({ items }: { items: Array<{ meal: string; food: string; quantity: string }> }) => {
            if (!horseId) return "No se proporcionó ID de caballo.";
            await prisma.feedingPlan.upsert({
              where: { horseId },
              update: { items: items as any },
              create: { tenantId, horseId, items: items as any }
            });
            return `Plan de alimentación / dieta actualizado con éxito en la base de datos (${items.length} raciones configuradas).`;
          }
        })
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Error in /api/chat route:", error);
    return new Response(error?.message || "Error al procesar la consulta con la IA.", { status: 400 });
  }
}
