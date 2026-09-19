import { google } from "@ai-sdk/google";
import { streamText, tool, convertToModelMessages, isStepCount } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { auth } from "@/server/auth";
import { HealthEventType, Prisma } from "@prisma/client";
import { reportError } from "@/lib/observability";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * Tope diario de consultas por yeguada. El asistente gasta cuota de Gemini y
 * sin tope una sola persona curiosa puede agotar el presupuesto del mes. Es un
 * contador en memoria: frena el abuso accidental, no sustituye a un limitador
 * compartido entre instancias.
 */
const DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT ?? 200);
const chatUsage = new Map<string, { day: string; count: number }>();

function consumeQuota(tenantId: string): { ok: boolean; used: number } {
  const day = new Date().toISOString().slice(0, 10);
  const entry = chatUsage.get(tenantId);
  if (!entry || entry.day !== day) {
    chatUsage.set(tenantId, { day, count: 1 });
    return { ok: true, used: 1 };
  }
  entry.count += 1;
  return { ok: entry.count <= DAILY_LIMIT, used: entry.count };
}

export async function POST(req: Request) {
  try {
    const { messages, horseId, tenantSlug } = (await req.json()) as {
      messages: UIMessage[];
      horseId?: string;
      tenantSlug?: string;
    };
    const session = await auth();

    if (!session?.user) {
      return new Response("No estás autenticado. Por favor inicia sesión.", { status: 401 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return new Response("Falta la clave de API (GOOGLE_GENERATIVE_AI_API_KEY) en el archivo .env. Añade una API key válida de Google Gemini para usar el asistente.", { status: 400 });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      select: { tenantId: true, tenant: { select: { slug: true } } },
      orderBy: { id: "asc" },
    });

    if (memberships.length === 0) {
      return new Response("No perteneces a ninguna yeguada.", { status: 400 });
    }

    // La yeguada se resuelve por slug. Antes se cogia siempre la primera
    // membresia, asi que quien estaba en dos fincas podia recibir el contexto
    // de la que no estaba mirando.
    const membership = tenantSlug
      ? memberships.find((m) => m.tenant.slug === tenantSlug) ?? memberships[0]
      : memberships[0];
    const tenantId = membership.tenantId;

    const quota = consumeQuota(tenantId);
    if (!quota.ok) {
      return new Response(
        "El asistente ha alcanzado su límite diario para esta yeguada. Vuelve mañana.",
        { status: 429 },
      );
    }

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
            await prisma.healthEvent.create({
              data: {
                tenantId,
                horseId,
                type: type as HealthEventType,
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
            await prisma.trainingSession.create({
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
            const plan = items as unknown as Prisma.InputJsonValue;
            await prisma.feedingPlan.upsert({
              where: { horseId },
              update: { items: plan },
              create: { tenantId, horseId, items: plan }
            });
            return `Plan de alimentación / dieta actualizado con éxito en la base de datos (${items.length} raciones configuradas).`;
          }
        })
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    await reportError(error, { scope: "api.chat" });
    const message =
      error instanceof Error ? error.message : "Error al procesar la consulta con la IA.";
    return new Response(message, { status: 400 });
  }
}
