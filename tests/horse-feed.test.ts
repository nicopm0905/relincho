import { test } from "node:test";
import assert from "node:assert/strict";

import {
  batchActivities,
  buildFeed,
  feedByDay,
  type ActivityInput,
} from "@/lib/horse-feed";

const H = "horse-lucero";
const at = (iso: string) => new Date(iso);

const activity = (o: Partial<ActivityInput> & Pick<ActivityInput, "id" | "kind" | "at">): ActivityInput => ({
  horseId: H,
  durationMin: null,
  note: null,
  authorMembershipId: "m-mozo",
  visibleToOwner: true,
  ...o,
});

test("el feed mezcla actividades, entrenamientos y actos sanitarios del más reciente al más antiguo", () => {
  const feed = buildFeed(
    {
      activities: [activity({ id: "a1", kind: "PADDOCK", at: at("2026-11-02T09:00:00Z"), durationMin: 120 })],
      trainings: [{ id: "t1", horseId: H, date: at("2026-11-02T16:00:00Z"), minutes: 40, type: "Doma", notes: null }],
      health: [{ id: "h1", horseId: H, type: "VACCINE", name: "Gripe y tétanos", date: at("2026-11-01T10:00:00Z") }],
    },
    { viewer: "STAFF" },
  );
  assert.deepEqual(
    feed.map((f) => [f.source, f.id, f.kind]),
    [
      ["training", "t1", "RIDDEN"],
      ["activity", "a1", "PADDOCK"],
      ["health", "h1", "HEALTH"],
    ],
  );
  assert.equal(feed[0]?.durationMin, 40);
});

test("el propietario no ve entradas no visibles ni notas internas", () => {
  const sources = {
    activities: [
      activity({ id: "visible", kind: "GROOMED", at: at("2026-11-02T08:00:00Z"), note: "Cepillado y cascos limpios" }),
      activity({ id: "oculta", kind: "NOTE", at: at("2026-11-02T09:00:00Z"), note: "El cliente debe 2 meses", visibleToOwner: false }),
    ],
    trainings: [{ id: "t1", horseId: H, date: at("2026-11-02T10:00:00Z"), minutes: 30, type: null, notes: "Rígido a la mano izquierda" }],
    health: [],
  };
  const owner = buildFeed(sources, { viewer: "OWNER" });
  assert.deepEqual(owner.map((f) => f.id), ["t1", "visible"]);
  assert.equal(owner.find((f) => f.id === "t1")?.note, null, "las notas del entrenador son internas");
  assert.equal(owner.find((f) => f.id === "visible")?.note, "Cepillado y cascos limpios");
  const staff = buildFeed(sources, { viewer: "STAFF" });
  assert.equal(staff.length, 3);
  assert.equal(staff.find((f) => f.id === "t1")?.note, "Rígido a la mano izquierda");
});

test("un registro en lote de 8 caballos crea 8 entradas con la misma hora", () => {
  const horses = ["h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8"];
  const when = at("2026-11-02T08:30:00Z");
  const batch = batchActivities({
    horseIds: [...horses, "h3"],
    kind: "PADDOCK",
    at: when,
    authorMembershipId: "m-mozo",
  });
  assert.equal(batch.length, 8, "un caballo repetido no duplica la entrada");
  assert.deepEqual(batch.map((b) => b.horseId), horses);
  assert.ok(batch.every((b) => b.at.getTime() === when.getTime() && b.kind === "PADDOCK" && b.visibleToOwner));
});

test("los días se agrupan en hora de Madrid: una salida a las 00:30 cuenta en su día", () => {
  // 3 nov 00:30 en Madrid (CET, UTC+1) = 2 nov 23:30 UTC.
  const feed = buildFeed(
    { activities: [activity({ id: "noche", kind: "PADDOCK", at: at("2026-11-02T23:30:00Z") })], trainings: [], health: [] },
    { viewer: "OWNER" },
  );
  const days = feedByDay(feed, { now: at("2026-11-03T10:00:00Z"), days: 2 });
  assert.deepEqual(days.map((d) => [d.day, d.items.map((i) => i.id)]), [
    ["2026-11-03", ["noche"]],
    ["2026-11-02", []],
  ]);
});

test("un herraje registrado por el herrador aparece como FARRIER con su autor", () => {
  const feed = buildFeed(
    {
      activities: [],
      trainings: [],
      health: [
        { id: "h1", horseId: H, type: "FARRIER", name: "Herraje completo", date: at("2026-11-02T11:00:00Z"), authorMembershipId: "m-herrador" },
      ],
    },
    { viewer: "OWNER" },
  );
  assert.equal(feed[0]?.kind, "FARRIER");
  assert.equal(feed[0]?.authorMembershipId, "m-herrador");
  assert.equal(feed[0]?.title, "Herraje completo");
});

test("un día sin registros dice 'sin actividad registrada' y no inventa nada", () => {
  const days = feedByDay([], { now: at("2026-11-03T10:00:00Z"), days: 3 });
  assert.deepEqual(days.map((d) => d.day), ["2026-11-03", "2026-11-02", "2026-11-01"]);
  for (const d of days) {
    assert.deepEqual(d.items, []);
    // El motor marca el día vacío; el texto lo pone la UI desde messages.
    assert.equal(d.empty, true);
    assert.ok(!("emptyLabel" in d), "el motor no lleva textos en castellano");
  }
  const conAlgo = feedByDay(
    buildFeed({ activities: [activity({ id: "a1", kind: "PADDOCK", at: at("2026-11-03T08:00:00Z") })], trainings: [], health: [] }, { viewer: "OWNER" }),
    { now: at("2026-11-03T10:00:00Z"), days: 1 },
  );
  assert.equal(conAlgo[0]?.empty, false);
});

test("un acto sanitario lleva su tipo real y no sale como veterinario si lo hizo el dentista o el fisio", () => {
  const feed = buildFeed(
    {
      activities: [],
      trainings: [],
      health: [
        { id: "dental", horseId: H, type: "DENTAL", name: "Limado de dientes", date: at("2026-11-02T12:00:00Z") },
        { id: "trat", horseId: H, type: "TREATMENT", name: "Antiinflamatorio", date: at("2026-11-02T11:00:00Z") },
        { id: "vacuna", horseId: H, type: "VACCINE", name: "Gripe", date: at("2026-11-02T10:00:00Z") },
        { id: "herraje", horseId: H, type: "FARRIER", name: "Herraje", date: at("2026-11-02T09:00:00Z") },
      ],
    },
    { viewer: "OWNER" },
  );
  assert.deepEqual(
    feed.map((f) => [f.id, f.kind, f.healthType]),
    [
      ["dental", "HEALTH", "DENTAL"],
      ["trat", "HEALTH", "TREATMENT"],
      ["vacuna", "HEALTH", "VACCINE"],
      ["herraje", "FARRIER", "FARRIER"],
    ],
  );
  assert.ok(feed.every((f) => f.kind !== "VET"), "VET queda para las actividades que registre un veterinario");
  const training = buildFeed({ activities: [], trainings: [{ id: "t1", horseId: H, date: at("2026-11-02T10:00:00Z"), minutes: 30, type: null, notes: null }], health: [] }, { viewer: "OWNER" });
  assert.equal(training[0]?.healthType, null);
});
