import { test } from "node:test";
import assert from "node:assert/strict";
import { portalSection, relativeDue } from "../src/lib/portal-view";

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
