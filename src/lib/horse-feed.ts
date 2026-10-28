/**
 * Feed de actividad del caballo (roadmap §4 E6): "hoy salió al paddock",
 * "trabajó 40 min", "le vio el herrador". Es lo que hace volver al propietario
 * a la app. Motor puro: los routers le pasan las filas y él las mezcla.
 *
 * Entrenamientos y actos sanitarios NO se copian a `HorseActivity`: se fusionan
 * al leer, así cada dato vive en un solo sitio.
 */

export type ActivityKind =
  | "PADDOCK"
  | "RIDDEN"
  | "LUNGED"
  | "WALKER"
  | "GROOMED"
  | "FARRIER"
  | "VET"
  | "PHYSIO"
  | "NOTE";

/** Fila de `HorseActivity` (E6-2). */
export interface ActivityInput {
  id: string;
  horseId: string;
  kind: ActivityKind;
  at: Date;
  durationMin: number | null;
  note: string | null;
  authorMembershipId: string;
  visibleToOwner: boolean;
}

/** Lo que el feed necesita de `TrainingSession`. */
export interface TrainingInput {
  id: string;
  horseId: string;
  date: Date;
  minutes: number;
  type: string | null;
  notes: string | null;
}

/** Lo que el feed necesita de `HealthEvent`. El autor llega con E7 (visita del profesional). */
export interface HealthInput {
  id: string;
  horseId: string;
  type: string;
  name: string;
  date: Date;
  authorMembershipId?: string | null;
}

export interface FeedItem {
  id: string;
  source: "activity" | "training" | "health";
  kind: ActivityKind;
  at: Date;
  durationMin: number | null;
  title: string | null;
  note: string | null;
  authorMembershipId: string | null;
}

export type FeedViewer = "STAFF" | "OWNER";

export const NO_ACTIVITY_LABEL = "Sin actividad registrada";

const TIME_ZONE = "Europe/Madrid";

/** Entrenamiento → tipo de actividad, por el texto libre de `type`. */
function trainingKind(type: string | null): ActivityKind {
  if (type && /cuerda|lunge|dar cuerda/i.test(type)) return "LUNGED";
  if (type && /caminador|walker/i.test(type)) return "WALKER";
  return "RIDDEN";
}

/** Acto sanitario → tipo de actividad. Las notas clínicas no van al feed. */
function healthKind(type: string): ActivityKind {
  return type === "FARRIER" ? "FARRIER" : "VET";
}

/**
 * Mezcla las tres fuentes del más reciente al más antiguo. El propietario no
 * ve las actividades marcadas como internas (`visibleToOwner = false`) ni las
 * notas del entrenador.
 */
export function buildFeed(
  sources: { activities: ActivityInput[]; trainings: TrainingInput[]; health: HealthInput[] },
  { viewer }: { viewer: FeedViewer },
): FeedItem[] {
  const owner = viewer === "OWNER";
  const items: FeedItem[] = [
    ...sources.activities
      .filter((a) => !owner || a.visibleToOwner)
      .map((a): FeedItem => ({
        id: a.id,
        source: "activity",
        kind: a.kind,
        at: a.at,
        durationMin: a.durationMin,
        title: null,
        note: a.note,
        authorMembershipId: a.authorMembershipId,
      })),
    ...sources.trainings.map((t): FeedItem => ({
      id: t.id,
      source: "training",
      kind: trainingKind(t.type),
      at: t.date,
      durationMin: t.minutes,
      title: t.type,
      note: owner ? null : t.notes,
      authorMembershipId: null,
    })),
    ...sources.health.map((h): FeedItem => ({
      id: h.id,
      source: "health",
      kind: healthKind(h.type),
      at: h.date,
      durationMin: null,
      title: h.name,
      note: null,
      authorMembershipId: h.authorMembershipId ?? null,
    })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
}

/**
 * Registro en lote desde el kiosko: el mozo elige los caballos y marca
 * "paddock". Todas las entradas con la misma hora; un caballo repetido no se
 * duplica.
 */
export function batchActivities(o: {
  horseIds: string[];
  kind: ActivityKind;
  at: Date;
  authorMembershipId: string;
  durationMin?: number | null;
}): Omit<ActivityInput, "id">[] {
  return [...new Set(o.horseIds)].map((horseId) => ({
    horseId,
    kind: o.kind,
    at: o.at,
    durationMin: o.durationMin ?? null,
    note: null,
    authorMembershipId: o.authorMembershipId,
    visibleToOwner: true,
  }));
}

/** Día de calendario `YYYY-MM-DD` en Madrid ("sv-SE" formatea así). */
function madridDay(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE }).format(date);
}

/** `YYYY-MM-DD` desplazado `offset` días de calendario (sin horas: el cambio de hora no afecta). */
function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

/**
 * Los últimos `days` días, de hoy hacia atrás, en hora de Madrid. Un día sin
 * entradas lleva `emptyLabel`: el feed no rellena con nada inventado.
 */
export function feedByDay(
  items: FeedItem[],
  { now, days }: { now: Date; days: number },
): { day: string; items: FeedItem[]; emptyLabel: string | null }[] {
  const today = madridDay(now);
  const buckets = new Map<string, FeedItem[]>();
  for (let i = 0; i < days; i++) buckets.set(shiftDay(today, -i), []);
  for (const item of items) buckets.get(madridDay(item.at))?.push(item);
  return [...buckets.entries()].map(([day, dayItems]) => ({
    day,
    items: dayItems,
    emptyLabel: dayItems.length ? null : NO_ACTIVITY_LABEL,
  }));
}
