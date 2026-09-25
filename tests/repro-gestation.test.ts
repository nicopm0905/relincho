import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessFoalingWatch,
  assessNeonatal,
  gestationMilestones,
  milestoneTaskKey,
} from "../src/lib/repro-gestation";
import { mareInsight } from "../src/lib/repro-engine";
import { seasonStats, type StatsCovering } from "../src/lib/repro-stats";
import { DEFAULT_REPRO_SETTINGS as S } from "../src/lib/repro-settings";

const d = (iso: string) => new Date(iso);

test("hitos: EHV-1 cuenta desde la cubrición y los preparto desde el parto previsto", () => {
  const covered = d("2026-03-01T00:00:00Z");
  const expected = d("2027-02-04T00:00:00Z");
  const m = gestationMilestones(covered, expected, S);
  const ehv5 = m.find((x) => x.key === "ehv-5")!;
  assert.equal(ehv5.due.toISOString(), "2026-07-29T00:00:00.000Z"); // +150 d
  const boosters = m.find((x) => x.key === "boosters")!;
  assert.equal(boosters.due.toISOString(), "2026-12-31T00:00:00.000Z"); // -35 d
  // En orden de fecha.
  for (let i = 1; i < m.length; i++) assert.ok(m[i].due >= m[i - 1].due);
  assert.equal(milestoneTaskKey("cov1", "ehv-5"), "repro:cov1:ehv-5");
});

test("vigilancia: calcio ≥ 200 ppm o cera anuncian parto; lecturas viejas no cuentan", () => {
  const now = d("2027-02-01T12:00:00Z");
  const ca = assessFoalingWatch([{ date: "2027-02-01T08:00:00Z", milkCalciumPpm: 250 }], S, now)!;
  assert.equal(ca.imminent, true);
  assert.equal(ca.level, "danger");
  const wax = assessFoalingWatch([{ date: "2027-02-01T08:00:00Z", wax: true }], S, now)!;
  assert.equal(wax.imminent, true);
  const low = assessFoalingWatch([{ date: "2027-02-01T08:00:00Z", milkCalciumPpm: 120 }], S, now)!;
  assert.equal(low.imminent, false);
  assert.equal(assessFoalingWatch([{ date: "2027-01-25T08:00:00Z", wax: true }], S, now), null);
});

test("neonato: regla 1-2-3 e IgG", () => {
  const ok = assessNeonatal(
    { alive: true, foalStoodMinutes: 45, foalSuckledMinutes: 90, placentaMinutes: 60, foalIggMgDl: 1000 },
    S,
  );
  assert.equal(ok.length, 0);
  const bad = assessNeonatal(
    { alive: true, foalStoodMinutes: 80, foalSuckledMinutes: 200, placentaMinutes: 240, foalIggMgDl: 300 },
    S,
  );
  assert.deepEqual(bad.map((a) => a.key).sort(), ["igg", "placenta", "stand", "suckle"]);
  const partial = assessNeonatal({ alive: true, foalIggMgDl: 600 }, S);
  assert.equal(partial[0].level, "warning");
});

test("el motor avisa del calcio alto y lista los hitos de una gestante a término", () => {
  const coverings = [
    {
      id: "c1",
      date: "2026-03-01T00:00:00Z",
      method: "NATURAL",
      pregnancyChecks: [{ date: "2026-03-16", result: "POSITIVE" }],
      foalingWatch: [{ date: "2027-01-20T08:00:00Z", milkCalciumPpm: 300 }],
    },
  ];
  const i = mareInsight({ exams: [], coverings }, S, d("2027-01-20T12:00:00Z"));
  assert.equal(i.phase, "FOALING_SOON");
  assert.equal(i.watch?.imminent, true);
  assert.ok(i.alerts.some((a) => a.key === "foaling_watch"));
  assert.equal(i.milestones.length, S.gestationMilestones.length);
  // Refuerzos (-35 d del parto previsto, 4 feb) caen hacia el 31 dic: ya pasados de largo, no son accion.
  assert.ok(!i.actions.some((a) => a.kind === "milestone" && a.label.startsWith("Refuerzos")));
  // Vigilancia (-20 d) cae el 15 ene: dentro de la semana de margen.
  assert.ok(i.actions.some((a) => a.kind === "milestone" && a.label.startsWith("Empezar vigilancia")));
});

test("el motor avisa de problemas del potro en el postparto", () => {
  const coverings = [
    {
      date: "2025-05-01T00:00:00Z",
      method: "NATURAL",
      pregnancyChecks: [{ date: "2025-05-16", result: "POSITIVE" }],
      foaling: { date: "2026-04-05T00:00:00Z", alive: true, foalIggMgDl: 250 },
    },
  ];
  const i = mareInsight({ exams: [], coverings }, S, d("2026-04-07T00:00:00Z"));
  assert.ok(i.alerts.some((a) => a.key === "neonatal_igg" && a.level === "danger"));
});

const cov = (over: Partial<StatsCovering>): StatsCovering => ({
  mareId: "m1",
  date: "2026-04-01",
  method: "NATURAL",
  stallionKey: "s1",
  stallionName: "Semental 1",
  pregnancyChecks: [],
  ...over,
});

test("estadísticas: preñez por ciclo, por temporada, pérdidas y por semental", () => {
  const data: StatsCovering[] = [
    // Yegua 1: dos cubriciones en el mismo celo, preñada al 1.er ciclo, luego parto vivo.
    cov({ mareId: "m1", date: "2026-04-01", pregnancyChecks: [] }),
    cov({ mareId: "m1", date: "2026-04-03", pregnancyChecks: [{ date: "2026-04-18", result: "POSITIVE" }], foaling: { alive: true } }),
    // Yegua 2: vacía en el 1.er ciclo, preñada en el 2.º y la pierde.
    cov({ mareId: "m2", date: "2026-04-05", stallionKey: "s2", stallionName: "Semental 2", pregnancyChecks: [{ date: "2026-04-20", result: "NEGATIVE" }] }),
    cov({
      mareId: "m2",
      date: "2026-04-27",
      stallionKey: "s2",
      stallionName: "Semental 2",
      method: "AI_FROZEN",
      dosesUsed: 2,
      pregnancyChecks: [
        { date: "2026-05-12", result: "POSITIVE" },
        { date: "2026-06-20", result: "REABSORBED" },
      ],
    }),
    // Yegua 3: cubierta, vacia.
    cov({ mareId: "m3", date: "2026-05-01", pregnancyChecks: [{ date: "2026-05-16", result: "NEGATIVE" }] }),
    // Otra temporada: no cuenta.
    cov({ mareId: "m4", date: "2025-05-01", pregnancyChecks: [{ date: "2025-05-16", result: "POSITIVE" }] }),
  ];
  const s = seasonStats(data, 2026);
  assert.equal(s.maresBred, 3);
  assert.equal(s.cyclesBred, 4);
  assert.equal(s.pregnantCycles, 2);
  assert.equal(s.perCycleRate, 0.5);
  assert.equal(s.maresPregnant, 2);
  assert.equal(s.cyclesPerPregnancy, 2);
  assert.equal(s.losses, 1);
  assert.equal(s.liveFoals, 1);
  assert.equal(s.dosesPerPregnancy, 2);
  const s1 = s.byStallion.find((r) => r.key === "s1")!;
  assert.equal(s1.cycles, 2);
  assert.equal(s1.pregnantCycles, 1);
  const frozen = s.byMethod.find((r) => r.key === "AI_FROZEN")!;
  assert.equal(frozen.perCycleRate, 1);
  assert.equal(seasonStats([], 2026).perCycleRate, null);
});
