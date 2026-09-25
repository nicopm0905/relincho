import { z } from "zod";

/**
 * Parametros reproductivos de una yeguada. Se guardan como JSON en
 * `ReproSettings.config` y se validan aqui: cualquier campo que falte (o que
 * se añada en una version posterior) toma su valor por defecto, asi que un
 * parametro nuevo no necesita migracion.
 *
 * Valores por defecto contrastados con la literatura veterinaria (sep 2026):
 * - Ciclo ~21 d, estro 2-8 d: Merck Veterinary Manual, "The Reproductive Cycle of Horses".
 * - Folículo preovulatorio 35-45 mm; induccion desde ~35 mm: Merck.
 * - Crecimiento folicular ~2,2 mm/dia (1,2-3,6): PMC3600040.
 * - hCG/deslorelina: ovulacion a las ~36-48 h: J Equine Vet Sci (S0737080606006988).
 * - PGF2α: el cuerpo luteo no responde antes del dia 5; celo a los 2-5 d: Merck.
 * - Ventanas de inseminacion por tipo de semen: PMC8063980.
 * - Celo del potro: ovulacion media dia 10 (7-15); mejor si ovula >= dia 10: eXtension.
 * - Ecografias: vesicula dia 10-11, gemelos antes de la fijacion (~16), latido 28-36: Colorado State ERL.
 * - Gestacion media ~340 d, normal 320-365; < 320 prematuro: KER.
 * No hay datos publicados especificos del PRE para estos parametros: son los
 * generales de la especie, y por eso cada yegua aprende los suyos.
 */

export const COVERING_METHODS = ["NATURAL", "AI_FRESH", "AI_REFRIGERATED", "AI_FROZEN", "ET"] as const;
export type CoveringMethodKey = (typeof COVERING_METHODS)[number];

const hours = z.number().int().min(-120).max(120);
const window = z.object({ fromHours: hours, toHours: hours });

const checkpoint = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  from: z.number().int().min(8).max(330),
  to: z.number().int().min(8).max(330),
});

export const DEFAULT_CHECKPOINTS = [
  { key: "detection", label: "Eco de detección y gemelos", from: 14, to: 16 },
  { key: "heartbeat", label: "Eco de latido", from: 28, to: 35 },
  { key: "confirmation", label: "Eco de confirmación", from: 45, to: 60 },
];

export const reproSettingsSchema = z.object({
  // Ciclo estral
  cycleLengthDays: z.number().int().min(15).max(30).default(21),
  estrusLengthDays: z.number().int().min(2).max(10).default(6),
  /** Meses (1-12) en los que se espera anestro sin programa de luz. */
  anestrusMonths: z.array(z.number().int().min(1).max(12)).default([11, 12, 1]),
  /** Temporada de cubriciones de la yeguada. */
  breedingSeasonStartMonth: z.number().int().min(1).max(12).default(2),
  breedingSeasonEndMonth: z.number().int().min(1).max(12).default(7),

  // Ovulacion
  preovulatoryFollicleMm: z.number().int().min(25).max(55).default(35),
  follicleGrowthMmPerDay: z.number().min(1).max(6).default(2.5),
  /** Diametro a partir del cual se considera celo aunque no haya recela. */
  estrusFollicleMm: z.number().int().min(20).max(45).default(30),
  inductionMinFollicleMm: z.number().int().min(25).max(50).default(35),
  inductionToOvulationHours: z.number().int().min(12).max(72).default(40),
  /** PGF2α: dias minimos tras ovular para que responda el cuerpo luteo. */
  pgfMinDaysAfterOvulation: z.number().int().min(3).max(10).default(5),
  pgfToEstrusDays: z.number().int().min(1).max(7).default(4),
  pgfToOvulationDays: z.number().int().min(4).max(14).default(8),

  // Ventanas de cubricion/inseminacion respecto a la ovulacion (horas).
  breedingWindows: z
    .object({
      NATURAL: window.default({ fromHours: -48, toHours: 6 }),
      AI_FRESH: window.default({ fromHours: -48, toHours: 6 }),
      AI_REFRIGERATED: window.default({ fromHours: -24, toHours: 12 }),
      AI_FROZEN: window.default({ fromHours: -12, toHours: 6 }),
      ET: window.default({ fromHours: -48, toHours: 6 }),
    })
    .default({
      NATURAL: { fromHours: -48, toHours: 6 },
      AI_FRESH: { fromHours: -48, toHours: 6 },
      AI_REFRIGERATED: { fromHours: -24, toHours: 12 },
      AI_FROZEN: { fromHours: -12, toHours: 6 },
      ET: { fromHours: -48, toHours: 6 },
    }),
  defaultMethod: z.enum(COVERING_METHODS).default("NATURAL"),

  // Celo del potro
  foalHeatFromDay: z.number().int().min(4).max(20).default(7),
  foalHeatToDay: z.number().int().min(5).max(25).default(15),
  /** Si la ovulacion cae antes de este dia postparto, se aconseja saltarlo. */
  foalHeatMinOvulationDay: z.number().int().min(5).max(20).default(10),

  // Gestacion
  pregnancyCheckpoints: z.array(checkpoint).max(8).default(DEFAULT_CHECKPOINTS),
  gestationDays: z.number().int().min(300).max(380).default(340),
  gestationMinDays: z.number().int().min(280).max(360).default(320),
  gestationMaxDays: z.number().int().min(320).max(400).default(365),
  /** Dias antes del inicio de la ventana de parto en que la yegua pasa a "parto próximo". */
  foalingWatchDays: z.number().int().min(0).max(60).default(20),

  // Aprendizaje por yegua
  learnFromHistory: z.boolean().default(true),
});

export type ReproSettings = z.infer<typeof reproSettingsSchema>;

export const DEFAULT_REPRO_SETTINGS: ReproSettings = reproSettingsSchema.parse({});

/**
 * Lee el JSON guardado. Si esta corrupto no rompe la pantalla: se descarta lo
 * que no valida campo a campo y se quedan los valores por defecto.
 */
export function parseReproSettings(raw: unknown): ReproSettings {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const full = reproSettingsSchema.safeParse(input);
  if (full.success) return full.data;
  const clean: Record<string, unknown> = {};
  const shape = reproSettingsSchema.shape;
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    if (!(key in input)) continue;
    if (shape[key].safeParse(input[key]).success) clean[key] = input[key];
  }
  return reproSettingsSchema.parse(clean);
}

/** Coherencia entre campos, para el formulario de ajustes. */
export const reproSettingsInputSchema = reproSettingsSchema
  .refine((s) => s.gestationMinDays < s.gestationDays && s.gestationDays < s.gestationMaxDays, {
    message: "La gestación media debe quedar entre el mínimo y el máximo",
    path: ["gestationDays"],
  })
  .refine((s) => s.estrusLengthDays < s.cycleLengthDays, {
    message: "El celo no puede durar más que el ciclo",
    path: ["estrusLengthDays"],
  })
  .refine((s) => s.foalHeatFromDay < s.foalHeatToDay, {
    message: "El inicio del celo del potro debe ser anterior al final",
    path: ["foalHeatToDay"],
  })
  .refine((s) => s.pregnancyCheckpoints.every((c) => c.from <= c.to), {
    message: "Cada ecografía debe tener 'desde' ≤ 'hasta'",
    path: ["pregnancyCheckpoints"],
  })
  .refine(
    (s) => Object.values(s.breedingWindows).every((w) => w.fromHours < w.toHours),
    { message: "Cada ventana debe empezar antes de acabar", path: ["breedingWindows"] },
  );
