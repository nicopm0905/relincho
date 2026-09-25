import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceBalance, round2 } from "../src/lib/invoice-balance";

test("sin rectificativas: total menos cobros", () => {
  const b = invoiceBalance({ total: "121.00", payments: [{ amount: "21.00" }] });
  assert.deepEqual(b, { effectiveTotal: 121, paid: 21, pending: 100, rectified: false, voided: false });
});

test("rectificativa por diferencias que anula todo deja la original a cero", () => {
  const b = invoiceBalance({
    total: 242,
    payments: [],
    rectifiers: [{ status: "ISSUED", total: -242, rectificationKind: "I" }],
  });
  assert.equal(b.pending, 0);
  assert.equal(b.voided, true);
});

test("por sustitucion reemplaza el total, no lo suma", () => {
  const b = invoiceBalance({
    total: 200,
    payments: [{ amount: 200 }],
    rectifiers: [{ status: "PAID", total: 150, rectificationKind: "S" }],
  });
  assert.equal(b.effectiveTotal, 150);
  assert.equal(b.pending, -50); // hay que devolver 50
  assert.equal(b.voided, false);
});

test("un borrador o una anulada no cuentan", () => {
  const b = invoiceBalance({
    total: 100,
    payments: [],
    rectifiers: [
      { status: "DRAFT", total: -100, rectificationKind: "I" },
      { status: "CANCELLED", total: -100, rectificationKind: "I" },
    ],
  });
  assert.equal(b.pending, 100);
  assert.equal(b.rectified, false);
});

test("varias por diferencias se acumulan sin error de coma flotante", () => {
  const b = invoiceBalance({
    total: 0.3,
    payments: [],
    rectifiers: [
      { status: "ISSUED", total: -0.1, rectificationKind: "I" },
      { status: "ISSUED", total: -0.2, rectificationKind: "I" },
    ],
  });
  assert.equal(b.effectiveTotal, 0);
  assert.equal(round2(0.1 + 0.2), 0.3);
});
