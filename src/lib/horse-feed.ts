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

export interface TrainingInput {
  id: string;
  horseId: string;
  date: Date;
  minutes: number;
  type: string | null;
  notes: string | null;
}

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

export const NO_ACTIVITY_LABEL = "";

export function buildFeed(
  _sources: { activities: ActivityInput[]; trainings: TrainingInput[]; health: HealthInput[] },
  _opts: { viewer: "STAFF" | "OWNER" },
): FeedItem[] {
  throw new Error("no implementado");
}

export function batchActivities(_o: {
  horseIds: string[];
  kind: ActivityKind;
  at: Date;
  authorMembershipId: string;
  durationMin?: number | null;
}): Omit<ActivityInput, "id">[] {
  throw new Error("no implementado");
}

export function feedByDay(
  _items: FeedItem[],
  _opts: { now: Date; days: number },
): { day: string; items: FeedItem[]; emptyLabel: string | null }[] {
  throw new Error("no implementado");
}
