import { test } from "node:test";
import assert from "node:assert/strict";
import { breakdownByRate, classifyInvoice, computeTotals, SIMPLIFIED_LIMIT } from "../src/lib/invoice-rules";

test("totales: IVA por linea redondeado, sin error de coma flotante", () => {
  const t = computeTotals([
    { quantity: 3, unitPrice: 0.1, vatRate: 21 },
    { quantity: 1, unitPrice: 450, vatRate: 10 },
  ]);
  assert.deepEqual(t, { subtotal: 450.3, vatTotal: 45.06, total: 495.36 });
});

test("totales con lineas en negativo (rectificativa por diferencias)", () => {
  const t = computeTotals([{ quantity: 1, unitPrice: -100, vatRate: 21 }]);
  assert.deepEqual(t, { subtotal: -100, vatTotal: -21, total: -121 });
});

test("el desglose agrupa por tipo y suma lo mismo que los totales", () => {
  const lines = [
    { quantity: 1, unitPrice: 300, vatRate: 21 },
    { quantity: 2, unitPrice: 50, vatRate: 21 },
    { quantity: 1, unitPrice: 80, vatRate: 10 },
    { quantity: 1, unitPrice: 20, vatRate: 0 },
  ];
  const breakdown = breakdownByRate(lines);
  assert.equal(breakdown.length, 3);
  assert.deepEqual(breakdown.find((b) => b.vatRate === 21), { vatRate: 21, base: 400, vat: 84 });
  const t = computeTotals(lines);
  assert.equal(breakdown.reduce((s, b) => s + b.base, 0), t.subtotal);
  assert.equal(breakdown.reduce((s, b) => s + b.vat, 0), t.vatTotal);
});

test("clasificacion: con NIF F1, sin NIF F2 hasta el limite, y error por encima", () => {
  const base = { isRectification: false, storedType: null };
  assert.deepEqual(classifyInvoice({ ...base, hasClientNif: true, total: 5000 }), { type: "F1" });
  assert.deepEqual(classifyInvoice({ ...base, hasClientNif: false, total: SIMPLIFIED_LIMIT }), { type: "F2" });
  const over = classifyInvoice({ ...base, hasClientNif: false, total: SIMPLIFIED_LIMIT + 0.01 });
  assert.ok("error" in over);
});

test("rectificativa conserva su clave R1-R4 y cae a R4 si no es valida", () => {
  const base = { isRectification: true, hasClientNif: false, total: -10 };
  assert.deepEqual(classifyInvoice({ ...base, storedType: "R1" }), { type: "R1" });
  assert.deepEqual(classifyInvoice({ ...base, storedType: "F1" }), { type: "R4" });
  assert.deepEqual(classifyInvoice({ ...base, storedType: null }), { type: "R4" });
});
