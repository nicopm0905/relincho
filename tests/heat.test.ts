import { test } from "node:test";
import assert from "node:assert/strict";

import { analyzeHeatDay, heatLevelFor, usefIndex, wbgtApprox, type HourWeather } from "@/lib/heat";
import {
  findMunicipality,
  localDayKey,
  mergeForecast,
  parseMetNo,
  pointsByLocalDay,
  provinceCode,
  timeZoneFor,
  truncateCoord,
  type Municipality,
} from "@/lib/forecast";
import { assessReadiness } from "@/lib/readiness";
import { computeDailyPrescription } from "@/server/services/nutrition/engine";
import { fallbackBaseline } from "@/server/services/nutrition/context";

test("índices: WBGT estimado y USEF", () => {
  assert.equal(usefIndex(30, 50), 136); // 86 °F + 50
  assert.equal(wbgtApprox(40, 20), 32.4);
  assert.equal(wbgtApprox(20, 50), 19.9);
});

test("nivel de calor: calor seco, día húmedo y aire caliente", () => {
  // 40 °C con 20 %: la USEF diría "seguro" (124); el WBGT dice peligro.
  assert.equal(heatLevelFor(40, 20), "PELIGRO");
  assert.equal(heatLevelFor(35, 30), "PRECAUCION");
  // Mañana húmeda: el sudor no evapora.
  assert.equal(heatLevelFor(25, 75), "VIGILAR");
  // Desde 32 °C, al menos vigilar aunque el aire sea seco.
  assert.equal(heatLevelFor(33, 25), "VIGILAR");
  assert.equal(heatLevelFor(30, 30), "NORMAL");
  assert.equal(heatLevelFor(20, 50), "NORMAL");
});

const hours = (rows: [number, number, number][]): HourWeather[] =>
  rows.map(([hour, tempC, rh]) => ({ hour, tempC, rh }));

// Un día de julio en Jerez con poniente por la mañana.
const july = hours([
  [6, 20, 78], [7, 21, 72], [8, 23, 65], [9, 26, 55], [10, 29, 45], [11, 32, 38],
  [12, 34, 32], [13, 36, 28], [14, 37, 26], [15, 38, 25], [16, 38, 24], [17, 37, 25],
  [18, 35, 28], [19, 32, 33], [20, 29, 40], [21, 26, 50], [22, 24, 60],
]);

test("día de julio: trabajar temprano o al caer la tarde", () => {
  const day = analyzeHeatDay(july);
  assert.equal(day.level, "PELIGRO");
  assert.equal(day.workBefore, 13);
  assert.equal(day.workFrom, 18);
  assert.equal(day.headline, "Trabaja antes de las 13:00 o a partir de las 18:00.");
  assert.equal(day.maxTempC, 38);
  assert.equal(day.peak?.hour, 15);
  assert.equal(day.heatStress, true);
  assert.equal(day.allDayDanger, false);
  // Solo horas de trabajo: de 7 a 20.
  assert.deepEqual([day.hours[0].hour, day.hours.at(-1)!.hour], [7, 20]);
  assert.ok(day.tips.some((t) => t.includes("veterinario")));
});

test("día templado: sin restricciones y sin electrolitos por calor", () => {
  const day = analyzeHeatDay(hours([[7, 14, 80], [12, 22, 50], [16, 24, 45], [20, 19, 60]]));
  assert.equal(day.level, "NORMAL");
  assert.equal(day.headline, "Sin restricciones por calor.");
  assert.equal(day.heatStress, false);
  assert.deepEqual(day.tips, []);
});

test("ola de calor: ninguna hora buena", () => {
  const day = analyzeHeatDay(
    hours(Array.from({ length: 14 }, (_, i) => [7 + i, 36 + (i > 4 ? 6 : 0), 35] as [number, number, number])),
  );
  assert.equal(day.allDayDanger, true);
  assert.match(day.headline, /todo el día/);
});

test("semáforo: el calor cambia la hora; el color, solo si no hay hora buena", () => {
  const clear = { date: new Date(), heatLegs: [], swellingLegs: [], painLegs: [], lameness: "NO" as const };
  const day = analyzeHeatDay(july);
  const ok = assessReadiness({ today: clear, heat: day });
  assert.equal(ok.level, "VERDE");
  assert.deepEqual(ok.notes, ["Calor: Trabaja antes de las 13:00 o a partir de las 18:00."]);

  const wave = assessReadiness({
    today: clear,
    heat: { level: "PELIGRO", headline: "Calor peligroso todo el día: nada de trabajo intenso.", allDayDanger: true },
  });
  assert.equal(wave.level, "AMBAR");
  assert.match(wave.reasons[0], /Calor peligroso todo el día/);
});

test("ración: con estrés por calor y trabajo se ponen electrolitos aunque no pase de 30 °C", () => {
  const vet = { baseWeightKg: 500, reproductiveStatus: "NA" as const };
  const baseline = fallbackBaseline(500);
  const humid = computeDailyPrescription({
    vet,
    baseline,
    training: { internalLoadUa: 300, ambientTempC: 27, heatStress: true },
  });
  const mild = computeDailyPrescription({
    vet,
    baseline,
    training: { internalLoadUa: 300, ambientTempC: 27, heatStress: false },
  });
  assert.ok(humid.electrolytesGrams > 0);
  assert.equal(mild.electrolytesGrams, 0);
  // Descansando no hay sudor que reponer.
  const rest = computeDailyPrescription({
    vet,
    baseline,
    training: { internalLoadUa: 0, ambientTempC: 38, heatStress: true },
  });
  assert.equal(rest.electrolytesGrams, 0);
});

test("MET Norway: lectura, hora local de la finca y Canarias", () => {
  const points = parseMetNo({
    properties: {
      timeseries: [
        { time: "2026-07-14T21:00:00Z", data: { instant: { details: { air_temperature: 27.1, relative_humidity: 40 } } } },
        { time: "2026-07-14T22:00:00Z", data: { instant: { details: { air_temperature: 25.4, relative_humidity: 48 } } } },
        { time: "2026-07-14T23:00:00Z", data: { instant: { details: { air_temperature: null } } } },
      ],
    },
  });
  assert.equal(points.length, 2);
  // En verano la península va dos horas por delante de UTC: las 22:00 UTC
  // son las 00:00 del día siguiente en Jerez.
  const byDay = pointsByLocalDay(points, "Europe/Madrid");
  assert.deepEqual(byDay.get("2026-07-14"), [{ hour: 23, tempC: 27.1, rh: 40 }]);
  assert.deepEqual(byDay.get("2026-07-15"), [{ hour: 0, tempC: 25.4, rh: 48 }]);
  // En Canarias, una hora menos.
  assert.deepEqual(pointsByLocalDay(points, "Atlantic/Canary").get("2026-07-14")?.map((h) => h.hour), [22, 23]);
  assert.equal(timeZoneFor(28.1, -15.4), "Atlantic/Canary");
  assert.equal(timeZoneFor(36.68, -6.13), "Europe/Madrid");
  assert.equal(localDayKey(new Date("2026-07-14T22:30:00Z"), "Europe/Madrid"), "2026-07-15");
  assert.equal(truncateCoord(36.686459), 36.6864);
});

test("previsión guardada: la nueva manda y se conservan las horas pasadas", () => {
  const p = (time: string, tempC: number) => ({ time, tempC, rh: 50 });
  const stored = [p("2026-07-13T08:00:00.000Z", 20), p("2026-07-14T08:00:00.000Z", 22), p("2026-07-14T12:00:00.000Z", 30)];
  const fresh = [p("2026-07-14T12:00:00.000Z", 31), p("2026-07-14T13:00:00.000Z", 33)];
  const merged = mergeForecast(stored, fresh, new Date("2026-07-14T00:00:00Z"));
  assert.deepEqual(
    merged.map((x) => [x.time.slice(5, 13), x.tempC]),
    [["07-14T08", 22], ["07-14T12", 31], ["07-14T13", 33]],
  );
  // Si MET no trae nada, se queda lo guardado (sin lo demasiado viejo).
  assert.equal(mergeForecast(stored, [], new Date("2026-07-14T00:00:00Z")).length, 2);
});

const MUNICIPIOS: Municipality[] = [
  { name: "Jerez de los Caballeros", ineCode: "06070", province: "Badajoz", latitude: 38.33, longitude: -6.8 },
  { name: "Jerez de la Frontera", ineCode: "11020", province: "Cádiz", latitude: 36.68, longitude: -5.97 },
  { name: "Puerto de Santa María, El", ineCode: "11027", province: "Cádiz", latitude: 36.6, longitude: -6.22 },
  { name: "Villanueva de la Serena", ineCode: "06153", province: "Badajoz", latitude: 38.97, longitude: -5.8 },
  { name: "Villanueva del Arzobispo", ineCode: "23097", province: "Jaén", latitude: 38.17, longitude: -3.0 },
];
const CP = { "11020": ["11401", "11406"], "11027": ["11500"], "06070": ["06380"] };

test("municipio de la finca sin llamar a nadie: provincia, código postal y nombre", () => {
  assert.equal(provinceCode("Cádiz"), "11");
  assert.equal(provinceCode("Provincia de Cadiz"), "11");
  assert.equal(provinceCode("La Coruña"), "15");
  assert.equal(provinceCode("Vizcaya"), "48");
  assert.equal(provinceCode("Baleares"), "07");
  assert.equal(provinceCode("Narnia"), null);

  const find = (hints: Parameters<typeof findMunicipality>[2]) => findMunicipality(MUNICIPIOS, CP, hints)?.ineCode;
  assert.equal(find({ name: "Jerez de la Frontera", province: "Cádiz" }), "11020");
  assert.equal(find({ name: "Jerez", province: "Badajoz" }), "06070");
  assert.equal(find({ name: "Jerez", postalCode: "11406" }), "11020");
  assert.equal(find({ name: "El Puerto de Santa María", province: "Cádiz" }), "11027");
  assert.equal(find({ name: "Jerez de la Frontera (Cádiz)" }), "11020");
  assert.equal(find({ name: "Villanueva", province: "Jaén" }), "23097");
  // Sin nombre, por el código postal.
  assert.equal(find({ postalCode: "11500" }), "11027");
  assert.equal(find({ name: "Narnia", province: "Cádiz" }), undefined);
});
