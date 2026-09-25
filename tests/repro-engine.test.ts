import { test } from "node:test";
import assert from "node:assert/strict";
import {
  learnMareParams,
  mareInsight,
  nutritionReproStatus,
  predictNextEstrus,
  predictOvulation,
  seasonCategory,
  type ExamInput,
} from "../src/lib/repro-engine";
import { DEFAULT_REPRO_SETTINGS as S, parseReproSettings } from "../src/lib/repro-settings";

const d = (iso: string) => new Date(iso);
const ovulated = (iso: string): ExamInput => ({ date: iso, ovulated: true });

test("los parámetros por defecto son los de la literatura", () => {
  assert.equal(S.cycleLengthDays, 21);
  assert.equal(S.gestationDays, 340);
  assert.equal(S.gestationMinDays, 320);
  assert.equal(S.gestationMaxDays, 365);
  assert.equal(S.preovulatoryFollicleMm, 35);
  assert.deepEqual(S.breedingWindows.AI_FROZEN, { fromHours: -12, toHours: 6 });
});

test("un JSON de ajustes corrupto conserva los campos válidos y rellena el resto", () => {
  const s = parseReproSettings({ cycleLengthDays: 22, gestationDays: "mucho", unknown: 1 });
  assert.equal(s.cycleLengthDays, 22);
  assert.equal(s.gestationDays, 340);
  assert.equal(parseReproSettings(null).cycleLengthDays, 21);
});

test("aprende la duración del ciclo de la yegua con dos intervalos o más", () => {
  const exams = [ovulated("2026-03-01"), ovulated("2026-03-24"), ovulated("2026-04-16")];
  const p = learnMareParams({ exams, coverings: [] }, S);
  assert.equal(p.cycleLengthDays, 23);
  assert.equal(p.cycleSource, "learned");
  // Con uno solo, se queda el de la yeguada.
  const one = learnMareParams({ exams: exams.slice(0, 2), coverings: [] }, S);
  assert.equal(one.cycleSource, "default");
});

test("un intervalo acortado con PGF no cuenta para aprender el ciclo", () => {
  const exams: ExamInput[] = [
    ovulated("2026-03-01"),
    { date: "2026-03-08", treatments: ["PGF2A"] },
    ovulated("2026-03-17"),
    ovulated("2026-04-08"),
    ovulated("2026-04-30"),
  ];
  const p = learnMareParams({ exams, coverings: [] }, S);
  assert.equal(p.cycleSamples, 2);
  assert.equal(p.cycleLengthDays, 22);
});

test("la corrección manual manda sobre lo aprendido", () => {
  const exams = [ovulated("2026-03-01"), ovulated("2026-03-24"), ovulated("2026-04-16")];
  const p = learnMareParams({ exams, coverings: [], profile: { cycleLengthDays: 20 } }, S);
  assert.equal(p.cycleLengthDays, 20);
  assert.equal(p.cycleSource, "manual");
});

test("aprende la gestación de sus partos anteriores", () => {
  const coverings = [
    { date: "2024-04-01", method: "NATURAL", foaling: { date: "2025-03-13", alive: true } },
    { date: "2025-04-20", method: "NATURAL", foaling: { date: "2026-04-02", alive: true } },
  ];
  const p = learnMareParams({ exams: [], coverings }, S);
  assert.equal(p.gestationSource, "learned");
  assert.ok(p.gestationDays >= 346 && p.gestationDays <= 347);
});

test("la inducción con hCG predice la ovulación a ~40 h con confianza alta", () => {
  const exams: ExamInput[] = [
    { date: "2026-04-10T09:00:00Z", rightFollicleMm: 37, uterineEdema: 2, treatments: ["HCG"] },
  ];
  const p = predictOvulation({ exams, coverings: [] }, S, { preovulatoryFollicleMm: 35 }, d("2026-04-10T10:00:00Z"))!;
  assert.equal(p.basis, "induction");
  assert.equal(p.confidence, "alta");
  assert.equal(p.expected.toISOString(), "2026-04-12T01:00:00.000Z");
});

test("sin inducción, proyecta con el crecimiento observado del folículo", () => {
  const exams: ExamInput[] = [
    { date: "2026-04-08T09:00:00Z", leftFollicleMm: 27, teasingScore: 2 },
    { date: "2026-04-10T09:00:00Z", leftFollicleMm: 31, teasingScore: 3, uterineEdema: 2 },
  ];
  const p = predictOvulation({ exams, coverings: [] }, S, { preovulatoryFollicleMm: 35 }, d("2026-04-10T12:00:00Z"))!;
  assert.equal(p.basis, "follicle");
  assert.equal(p.growthMmPerDay, 2);
  assert.equal(p.confidence, "media");
  // (35 - 31) / 2 + 1 = 3 dias despues de la ultima exploracion
  assert.equal(p.expected.toISOString(), "2026-04-13T09:00:00.000Z");
});

test("tras registrar la ovulación ya no hay predicción de ovulación pendiente", () => {
  const exams: ExamInput[] = [
    { date: "2026-04-10T09:00:00Z", leftFollicleMm: 38, treatments: ["HCG"] },
    { date: "2026-04-12T09:00:00Z", ovulated: true },
  ];
  assert.equal(
    predictOvulation({ exams, coverings: [] }, S, { preovulatoryFollicleMm: 35 }, d("2026-04-12T10:00:00Z")),
    null,
  );
});

test("el siguiente celo se cuenta desde la última ovulación y se proyecta si pasa sin datos", () => {
  const history = { exams: [ovulated("2026-04-01T00:00:00Z")], coverings: [] };
  const params = { cycleLengthDays: 21, estrusLengthDays: 6 };
  const e = predictNextEstrus(history, S, params, d("2026-04-05T00:00:00Z"))!;
  assert.equal(e.ovulation.toISOString(), "2026-04-22T00:00:00.000Z");
  assert.equal(e.estrusFrom.toISOString(), "2026-04-17T00:00:00.000Z");
  assert.equal(e.extrapolated, false);
  const later = predictNextEstrus(history, S, params, d("2026-05-01T00:00:00Z"))!;
  assert.equal(later.ovulation.toISOString(), "2026-05-13T00:00:00.000Z");
  assert.equal(later.extrapolated, true);
});

test("la PGF con cuerpo lúteo maduro adelanta el celo", () => {
  const history = {
    exams: [ovulated("2026-04-01T00:00:00Z"), { date: "2026-04-08T00:00:00Z", treatments: ["PGF2A"] }],
    coverings: [],
  };
  const e = predictNextEstrus(history, S, { cycleLengthDays: 21, estrusLengthDays: 6 }, d("2026-04-09T00:00:00Z"))!;
  assert.equal(e.basis, "pgf");
  assert.equal(e.estrusFrom.toISOString(), "2026-04-12T00:00:00.000Z");
});

test("fase: en celo con ventana de cubrición según el método por defecto", () => {
  const exams: ExamInput[] = [
    { date: "2026-04-10T09:00:00Z", rightFollicleMm: 36, teasingScore: 4, uterineEdema: 3 },
  ];
  const i = mareInsight({ exams, coverings: [] }, S, d("2026-04-10T12:00:00Z"));
  assert.equal(i.phase, "IN_HEAT");
  assert.ok(i.breeding);
  assert.ok(i.actions.some((a) => a.kind === "breed"));
});

test("fase: cubierta pide confirmar ovulación y luego la eco de detección", () => {
  const coverings = [{ date: "2026-04-11T10:00:00Z", method: "NATURAL", pregnancyChecks: [] }];
  const i = mareInsight({ exams: [], coverings }, S, d("2026-04-12T10:00:00Z"));
  assert.equal(i.phase, "COVERED");
  assert.ok(i.actions.some((a) => a.kind === "confirm_ovulation"));
  assert.equal(i.nextCheck?.key, "detection");
});

test("fase: gestante pasa a parto próximo al acercarse la ventana", () => {
  const coverings = [
    {
      date: "2025-05-01T00:00:00Z",
      method: "NATURAL",
      pregnancyChecks: [{ date: "2025-05-16", result: "POSITIVE" }],
    },
  ];
  assert.equal(mareInsight({ exams: [], coverings }, S, d("2025-12-01T00:00:00Z")).phase, "PREGNANT");
  assert.equal(mareInsight({ exams: [], coverings }, S, d("2026-03-20T00:00:00Z")).phase, "FOALING_SOON");
  const late = mareInsight({ exams: [], coverings }, S, d("2026-05-10T00:00:00Z"));
  assert.ok(late.alerts.some((a) => a.key === "prolonged"));
});

test("fase: tras el parto espera el celo del potro y cuenta como lactante", () => {
  const coverings = [
    {
      date: "2025-05-01T00:00:00Z",
      method: "NATURAL",
      pregnancyChecks: [{ date: "2025-05-16", result: "POSITIVE" }],
      foaling: { date: "2026-04-05T00:00:00Z", alive: true },
    },
  ];
  const i = mareInsight({ exams: [], coverings }, S, d("2026-04-08T00:00:00Z"));
  assert.equal(i.phase, "POSTPARTUM");
  assert.equal(i.foalHeat?.from.toISOString(), "2026-04-12T00:00:00.000Z");
  assert.equal(i.lactating, true);
  assert.equal(nutritionReproStatus(i).status, "LACTANDO");
});

test("fase: sin datos en invierno es anestro", () => {
  assert.equal(mareInsight({ exams: [], coverings: [] }, S, d("2026-12-10T00:00:00Z")).phase, "ANESTRUS");
  assert.equal(mareInsight({ exams: [], coverings: [] }, S, d("2026-05-10T00:00:00Z")).phase, "UNTRACKED");
});

test("gestante da estado nutricional con mes de gestación", () => {
  const coverings = [
    {
      date: "2026-01-01T00:00:00Z",
      method: "NATURAL",
      pregnancyChecks: [{ date: "2026-01-15", result: "POSITIVE" }],
    },
  ];
  const n = nutritionReproStatus(mareInsight({ exams: [], coverings }, S, d("2026-09-01T00:00:00Z")));
  assert.equal(n.status, "GESTANTE");
  assert.equal(n.gestationMonth, 8);
});

test("categoría de temporada: doncella, parida, vacía, pérdida y descansada", () => {
  assert.equal(seasonCategory([], 2026), "MAIDEN");
  const pos = [
    { date: "2025-04-01", method: "NATURAL", pregnancyChecks: [{ date: "2025-04-15", result: "POSITIVE" }] },
  ];
  assert.equal(seasonCategory(pos, 2026), "FOALING");
  const neg = [
    { date: "2025-04-01", method: "NATURAL", pregnancyChecks: [{ date: "2025-04-15", result: "NEGATIVE" }] },
  ];
  assert.equal(seasonCategory(neg, 2026), "BARREN");
  const lost = [
    { date: "2025-04-01", method: "NATURAL", pregnancyChecks: [{ date: "2025-06-15", result: "ABORTION" }] },
  ];
  assert.equal(seasonCategory(lost, 2026), "SLIPPED");
  assert.equal(seasonCategory(neg, 2027), "RESTED");
});
