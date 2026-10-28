import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyRunLabel, groupEmptyDays, healthDueDetail, portalSection, relativeDue } from "../src/lib/portal-view";

test("la navegación del portal marca la sección activa por la ruta", () => {
  assert.equal(portalSection("/hipica-sur/portal", "hipica-sur"), "home");
  assert.equal(portalSection("/hipica-sur/portal/", "hipica-sur"), "home");
  // La ficha de un caballo cuelga de "Mi caballo".
  assert.equal(portalSection("/hipica-sur/portal/caballos/abc", "hipica-sur"), "home");
  assert.equal(portalSection("/hipica-sur/portal/facturas", "hipica-sur"), "invoices");
  assert.equal(portalSection("/hipica-sur/portal/documentos", "hipica-sur"), "documents");
  // Un prefijo parecido no es la misma sección, ni otro centro tampoco.
  assert.equal(portalSection("/hipica-sur/portal/facturas-viejas", "hipica-sur"), null);
  assert.equal(portalSection("/otro-centro/portal/facturas", "hipica-sur"), null);
  assert.equal(portalSection("/hipica-sur/inicio", "hipica-sur"), null);
});

test("los vencimientos se cuentan en días: vence en 3 días o venció hace 2", () => {
  assert.deepEqual(relativeDue(3), { key: "inDays", days: 3 });
  assert.deepEqual(relativeDue(1), { key: "tomorrow", days: 1 });
  assert.deepEqual(relativeDue(0), { key: "today", days: 0 });
  assert.deepEqual(relativeDue(-1), { key: "overdue", days: 1 });
  assert.deepEqual(relativeDue(-2), { key: "overdue", days: 2 });
});

const TODAY = "2026-10-24";
/** Siete días de hoy hacia atrás, como `feedByDay`; `busy` son los que tienen actividad. */
const week = (busy: string[]) =>
  ["2026-10-24", "2026-10-23", "2026-10-22", "2026-10-21", "2026-10-20", "2026-10-19", "2026-10-18"].map((day) => ({
    day,
    items: busy.includes(day) ? [{ id: `a-${day}` }] : [],
  }));

test("agrupa los días vacíos seguidos en un solo tramo y deja sueltos los días con actividad", () => {
  // Un solo día vacío (hoy) entre días con actividad.
  const unoSolo = groupEmptyDays(week(["2026-10-23", "2026-10-22", "2026-10-21", "2026-10-20", "2026-10-19", "2026-10-18"]));
  assert.deepEqual(unoSolo[0], { kind: "empty", from: "2026-10-24", to: "2026-10-24" });
  assert.equal(unoSolo.length, 7);

  // Varios seguidos y vacíos separados por un día con actividad.
  const separados = groupEmptyDays(week(["2026-10-21"]));
  assert.deepEqual(
    separados.map((b) => (b.kind === "empty" ? `vacío ${b.from}..${b.to}` : `día ${b.day}`)),
    ["vacío 2026-10-22..2026-10-24", "día 2026-10-21", "vacío 2026-10-18..2026-10-20"],
  );
  assert.deepEqual(separados[1], { kind: "day", day: "2026-10-21", items: [{ id: "a-2026-10-21" }] });

  // Los siete vacíos: una sola línea.
  assert.deepEqual(groupEmptyDays(week([])), [{ kind: "empty", from: "2026-10-18", to: "2026-10-24" }]);
  assert.deepEqual(groupEmptyDays([]), []);
});

test("el tramo vacío se lee natural: hoy, ayer, un día o del 22 al 24", () => {
  assert.deepEqual(emptyRunLabel({ from: TODAY, to: TODAY }, TODAY), { key: "today" });
  assert.deepEqual(emptyRunLabel({ from: "2026-10-23", to: "2026-10-23" }, TODAY), { key: "yesterday" });
  assert.deepEqual(emptyRunLabel({ from: "2026-10-20", to: "2026-10-20" }, TODAY), { key: "day", date: "2026-10-20" });
  assert.deepEqual(emptyRunLabel({ from: "2026-10-22", to: "2026-10-24" }, TODAY), {
    key: "range",
    from: "2026-10-22",
    to: "2026-10-24",
    sameMonth: true,
  });
  assert.deepEqual(emptyRunLabel({ from: "2026-09-29", to: "2026-10-02" }, "2026-10-05"), {
    key: "range",
    from: "2026-09-29",
    to: "2026-10-02",
    sameMonth: false,
  });
});

test("un vencimiento no repite el tipo cuando el nombre del acto ya lo dice", () => {
  assert.equal(healthDueDetail("Lucero", "Desparasitación", "Desparasitación", "25 oct 2026"), "Lucero · 25 oct 2026");
  // Sin distinguir mayúsculas, acentos ni espacios sobrantes.
  assert.equal(healthDueDetail("Lucero", " desparasitacion ", "Desparasitación", "25 oct 2026"), "Lucero · 25 oct 2026");
  assert.equal(healthDueDetail("Lucero", "Gripe equina", "Vacuna", "25 oct 2026"), "Lucero · Vacuna · 25 oct 2026");
});
