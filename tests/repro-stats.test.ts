import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonStats, type StatsCovering } from "../src/lib/repro-stats";

const cover = (mareId: string, date: string, opts: Partial<StatsCovering> & { result?: string } = {}): StatsCovering => ({
  mareId,
  date,
  method: opts.method ?? "AI_FROZEN",
  stallionKey: "ext:Emperador",
  stallionName: "Emperador",
  dosesUsed: opts.dosesUsed ?? null,
  semenCost: opts.semenCost ?? null,
  pregnancyChecks: opts.result ? [{ date, result: opts.result }] : [],
});

test("coste de semen por gestación cuenta también los celos que no quedaron", () => {
  const stats = seasonStats(
    [
      cover("a", "2026-04-01", { dosesUsed: 2, semenCost: 900, result: "POSITIVE" }),
      cover("b", "2026-04-10", { dosesUsed: 2, semenCost: 900, result: "NEGATIVE" }),
      cover("b", "2026-05-02", { dosesUsed: 1, semenCost: 450, result: "POSITIVE" }),
      // Monta natural sin coste: no entra en el coste ni en el denominador.
      cover("c", "2026-04-20", { method: "NATURAL", result: "POSITIVE" }),
    ],
    2026,
  );
  assert.equal(stats.semenCostTotal, 2250);
  assert.equal(stats.semenCostPerPregnancy, 1125);
});

test("sin semen con coste, el coste por gestación es desconocido", () => {
  const stats = seasonStats([cover("a", "2026-04-01", { method: "NATURAL", result: "POSITIVE" })], 2026);
  assert.equal(stats.semenCostTotal, 0);
  assert.equal(stats.semenCostPerPregnancy, null);
});
