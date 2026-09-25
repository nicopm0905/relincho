/**
 * Estadisticas reproductivas de una temporada. La temporada de una cubricion
 * es el año de su fecha; los partos de esas cubriciones caen al año siguiente.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Cubriciones de una yegua separadas menos de esto son del mismo celo. */
const SAME_CYCLE_DAYS = 10;

const PREGNANT = new Set(["POSITIVE", "TWINS"]);
const LOSS = new Set(["REABSORBED", "ABORTION"]);

export type StatsCovering = {
  mareId: string;
  date: Date | string;
  method: string;
  stallionKey: string;
  stallionName: string;
  dosesUsed?: number | null;
  pregnancyChecks: { date: Date | string; result: string }[];
  foaling?: { alive?: boolean | null } | null;
};

export type RateRow = {
  key: string;
  label: string;
  mares: number;
  cycles: number;
  pregnantCycles: number;
  /** Preñez por ciclo cubierto (0-1). */
  perCycleRate: number | null;
};

export type SeasonStats = {
  season: number;
  maresBred: number;
  cyclesBred: number;
  pregnantCycles: number;
  maresPregnant: number;
  /** Preñez por ciclo (0-1). */
  perCycleRate: number | null;
  /** Yeguas preñadas / yeguas cubiertas (0-1). */
  seasonRate: number | null;
  cyclesPerPregnancy: number | null;
  twins: number;
  /** Gestaciones perdidas (reabsorcion o aborto) tras una eco positiva. */
  losses: number;
  lossRate: number | null;
  liveFoals: number;
  /** Potros vivos / yeguas cubiertas (0-1). */
  liveFoalRate: number | null;
  /** Dosis gastadas por gestacion (solo cubriciones con dosis registradas). */
  dosesPerPregnancy: number | null;
  byStallion: RateRow[];
  byMethod: RateRow[];
};

type Cycle = { mareId: string; coverings: StatsCovering[]; pregnant: boolean };

const rate = (num: number, den: number) => (den > 0 ? num / den : null);

function groupCycles(coverings: StatsCovering[]): Cycle[] {
  const byMare = new Map<string, StatsCovering[]>();
  for (const c of coverings) byMare.set(c.mareId, [...(byMare.get(c.mareId) ?? []), c]);
  const cycles: Cycle[] = [];
  for (const [mareId, list] of byMare) {
    const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let current: Cycle | null = null;
    let start = 0;
    for (const c of sorted) {
      const t = new Date(c.date).getTime();
      if (!current || t - start > SAME_CYCLE_DAYS * DAY_MS) {
        current = { mareId, coverings: [], pregnant: false };
        start = t;
        cycles.push(current);
      }
      current.coverings.push(c);
      if (c.pregnancyChecks.some((k) => PREGNANT.has(k.result)) || c.foaling) current.pregnant = true;
    }
  }
  return cycles;
}

function breakdown(cycles: Cycle[], keyOf: (c: StatsCovering) => [string, string]): RateRow[] {
  const rows = new Map<string, { label: string; mares: Set<string>; cycles: number; pregnant: number }>();
  for (const cycle of cycles) {
    // El celo se atribuye a su ultima cubricion (la que suele dejarla preñada).
    const last = cycle.coverings[cycle.coverings.length - 1];
    const [key, label] = keyOf(last);
    const row = rows.get(key) ?? { label, mares: new Set<string>(), cycles: 0, pregnant: 0 };
    row.mares.add(cycle.mareId);
    row.cycles++;
    if (cycle.pregnant) row.pregnant++;
    rows.set(key, row);
  }
  return [...rows.entries()]
    .map(([key, r]) => ({
      key,
      label: r.label,
      mares: r.mares.size,
      cycles: r.cycles,
      pregnantCycles: r.pregnant,
      perCycleRate: rate(r.pregnant, r.cycles),
    }))
    .sort((a, b) => b.cycles - a.cycles || a.label.localeCompare(b.label));
}

export function seasonStats(
  all: StatsCovering[],
  season: number,
  methodLabel: (method: string) => string = (m) => m,
): SeasonStats {
  const coverings = all.filter((c) => new Date(c.date).getFullYear() === season);
  const cycles = groupCycles(coverings);
  const pregnantCycles = cycles.filter((c) => c.pregnant);
  const mares = new Set(coverings.map((c) => c.mareId));
  const maresPregnant = new Set(pregnantCycles.map((c) => c.mareId));

  let twins = 0;
  let losses = 0;
  let liveFoals = 0;
  for (const c of coverings) {
    const checks = [...c.pregnancyChecks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (checks.some((k) => k.result === "TWINS")) twins++;
    const firstPositive = checks.findIndex((k) => PREGNANT.has(k.result));
    if (firstPositive >= 0 && checks.slice(firstPositive + 1).some((k) => LOSS.has(k.result))) losses++;
    else if (c.foaling && c.foaling.alive === false) losses++;
    if (c.foaling && c.foaling.alive !== false) liveFoals++;
  }

  const withDoses = pregnantCycles.flatMap((c) => c.coverings).filter((c) => typeof c.dosesUsed === "number");
  const pregnantWithDoses = pregnantCycles.filter((c) => c.coverings.some((k) => typeof k.dosesUsed === "number")).length;

  return {
    season,
    maresBred: mares.size,
    cyclesBred: cycles.length,
    pregnantCycles: pregnantCycles.length,
    maresPregnant: maresPregnant.size,
    perCycleRate: rate(pregnantCycles.length, cycles.length),
    seasonRate: rate(maresPregnant.size, mares.size),
    cyclesPerPregnancy: pregnantCycles.length ? cycles.length / pregnantCycles.length : null,
    twins,
    losses,
    lossRate: rate(losses, pregnantCycles.length),
    liveFoals,
    liveFoalRate: rate(liveFoals, mares.size),
    dosesPerPregnancy: pregnantWithDoses
      ? withDoses.reduce((n, c) => n + (c.dosesUsed ?? 0), 0) / pregnantWithDoses
      : null,
    byStallion: breakdown(cycles, (c) => [c.stallionKey, c.stallionName]),
    byMethod: breakdown(cycles, (c) => [c.method, methodLabel(c.method)]),
  };
}
