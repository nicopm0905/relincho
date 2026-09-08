import { z } from "zod";

/**
 * Contratos publicos de los modulos de rendimiento.
 * Son la unica fuente de verdad para el cliente movil (lectura de chip y
 * reporte de sesion por voz) y para el webhook de ajuste diario.
 */

export const disciplineSchema = z.enum([
  "DOMA_CLASICA",
  "DOMA_VAQUERA",
  "SALTO",
  "COMPLETO",
  "RAID",
  "ENGANCHES",
  "FUNCIONALIDAD",
  "OCIO",
]);

export const mesocyclePhaseSchema = z.enum([
  "ACUMULACION",
  "TRANSMUTACION",
  "REALIZACION",
  "TRANSICION",
]);

export const workTypeSchema = z.enum([
  "DESCANSO",
  "RECUPERACION_ACTIVA",
  "PISTA_TECNICA",
  "PISTA_ALTA_INTENSIDAD",
  "CAMPO_FONDO",
  "GIMNASIA_SALTO",
  "COMPETICION",
]);

export const fatigueZoneSchema = z.enum(["BAJA", "MEDIA", "ALTA"]);
export const sweatLossSchema = z.enum(["BAJA", "MEDIA", "ALTA"]);

export const reproductiveStatusSchema = z.enum([
  "NA",
  "CICLANDO",
  "GESTANTE",
  "LACTANDO",
  "SEMENTAL_EN_MONTA",
  "SEMENTAL_REPOSO",
]);

/** Identificador leido del chip fisico (NFC/RFID). */
export const chipIdSchema = z.string().min(3).max(64);

/** Payload que devuelve GET /api/horses/scan. */
export const scanResponseSchema = z.object({
  horse_id: z.string(),
  chip_id: z.string(),
  name: z.string(),
  discipline: disciplineSchema.nullable(),
  competition_target: z
    .object({ event_name: z.string(), date: z.string() })
    .nullable(),
  injury_history: z.array(
    z.object({
      date: z.string(),
      type: z.string(),
      name: z.string(),
      notes: z.string().nullable(),
    }),
  ),
  periodization_plan: z
    .object({
      current_macrocycle_id: z.string(),
      current_mesocycle: mesocyclePhaseSchema.nullable(),
      microcycle_week: z.number().int().nullable(),
      daily_load_target: z
        .object({
          rpe_target: z.number().int(),
          duration_minutes: z.number().int(),
          work_type: workTypeSchema,
        })
        .nullable(),
      recovery_metrics: z.object({
        mandatory_rest_days_per_microcycle: z.number().int(),
        dynamic_buffer_status: z.string(),
        fatigue_index_alert: z.boolean(),
      }),
    })
    .nullable(),
  veterinary_constraints: z.object({
    tendon_history_alert: z.boolean(),
    max_impact_surface_minutes: z.number().int().nullable(),
    max_rpe: z.number().int().nullable(),
  }),
});

export type ScanResponse = z.infer<typeof scanResponseSchema>;

/** Reporte de fin de sesion del jinete (fricción cero: minutos + RPE). */
export const sessionReportSchema = z.object({
  horse_id: z.string().uuid().optional(),
  chip_id: chipIdSchema.optional(),
  date: z.coerce.date().optional(),
  duration_minutes: z.number().int().min(0).max(600),
  rpe: z.number().int().min(0).max(10),
  rider_name: z.string().max(120).optional(),
  rider_notes: z.string().max(2000).optional(),
  sweat_loss: sweatLossSchema.optional(),
  /** El jinete reporta fatiga o menor rendimiento aunque la carga no se dispare. */
  rider_reported_fatigue: z.boolean().optional(),
  /** Sesion de fuerza/potencia, para el ajuste proteico nocturno. */
  strength_session: z.boolean().optional(),
});

export type SessionReport = z.infer<typeof sessionReportSchema>;
