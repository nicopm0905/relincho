import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aeatAmount,
  aeatDate,
  aeatTimestamp,
  altaHash,
  anulacionHash,
  buildAltaXml,
  invoiceNumSerie,
  qrUrl,
} from "../src/lib/verifactu";

/**
 * Vectores de la especificacion tecnica de la AEAT para la huella: si estos
 * tres casos dejan de coincidir, el calculo no es el oficial.
 */
const JAN_1_2024 = new Date("2024-01-01T12:00:00+01:00");
const FIRST = "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60";
const SECOND = "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97";

test("huella del primer registro de alta (ejemplo oficial AEAT)", () => {
  const hash = altaHash({
    issuerNif: "89890001K",
    numSerie: "12345678/G33",
    issueDate: JAN_1_2024,
    invoiceType: "F1",
    vatTotal: 12.35,
    total: 123.45,
    prevHash: null,
    generatedAt: "2024-01-01T19:20:30+01:00",
  });
  assert.equal(hash, FIRST);
});

test("huella encadenada del segundo registro (ejemplo oficial AEAT)", () => {
  const hash = altaHash({
    issuerNif: "89890001K",
    numSerie: "12345679/G34",
    issueDate: JAN_1_2024,
    invoiceType: "F1",
    vatTotal: 12.35,
    total: 123.45,
    prevHash: FIRST,
    generatedAt: "2024-01-01T19:20:35+01:00",
  });
  assert.equal(hash, SECOND);
});

test("huella de un registro de anulación (ejemplo oficial AEAT)", () => {
  const hash = anulacionHash({
    issuerNif: "89890001K",
    numSerie: "12345679/G34",
    issueDate: JAN_1_2024,
    prevHash: SECOND,
    generatedAt: "2024-01-01T19:20:40+01:00",
  });
  assert.equal(hash, "177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68");
});

test("fechas en hora de España, con el huso correcto en invierno y verano", () => {
  assert.equal(aeatTimestamp(new Date("2024-01-01T18:20:30Z")), "2024-01-01T19:20:30+01:00");
  assert.equal(aeatTimestamp(new Date("2026-07-15T08:00:00Z")), "2026-07-15T10:00:00+02:00");
  // 23:30 UTC del 31 de diciembre ya es 1 de enero en Madrid.
  assert.equal(aeatDate(new Date("2025-12-31T23:30:00Z")), "01-01-2026");
});

test("importes con dos decimales y número de factura con ceros", () => {
  assert.equal(aeatAmount(121), "121.00");
  assert.equal(aeatAmount(0.1 + 0.2), "0.30");
  assert.equal(invoiceNumSerie("2026", 7), "2026-0007");
});

test("QR oficial: parámetros codificados y entorno de pruebas por defecto", () => {
  const url = new URL(
    qrUrl({ issuerNif: "B12345674", numSerie: "R2026-0001", issueDate: JAN_1_2024, total: 241.4 }),
  );
  assert.equal(url.origin + url.pathname, "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR");
  assert.equal(url.searchParams.get("fecha"), "01-01-2024");
  assert.equal(url.searchParams.get("importe"), "241.40");
  assert.ok(
    qrUrl({ issuerNif: "B12345674", numSerie: "A&B", issueDate: JAN_1_2024, total: 1, env: "prod" })
      .includes("numserie=A%26B"),
  );
});

test("el XML lleva la huella, el encadenamiento y escapa los textos", () => {
  const xml = buildAltaXml({
    issuerNif: "B12345674",
    issuerName: "Yeguada <Los Álamos> & Hijos",
    numSerie: "2026-0002",
    issueDate: JAN_1_2024,
    invoiceType: "F1",
    vatTotal: 21,
    total: 121,
    prevHash: FIRST,
    generatedAt: "2024-01-01T19:20:35+01:00",
    hash: SECOND,
    description: "Pupilaje",
    recipient: { name: "Cliente", nif: "12345678Z" },
    breakdown: [{ vatRate: 21, base: 100, vat: 21 }],
    prev: { issuerNif: "B12345674", numSerie: "2026-0001", issueDate: JAN_1_2024, hash: FIRST },
    software: {
      producerName: "Relincho",
      producerNif: "B12345674",
      systemName: "Relincho",
      systemId: "RL",
      version: "1.0",
      installation: "1",
    },
  });
  assert.ok(xml.includes(`<sum1:Huella>${SECOND}</sum1:Huella>`));
  assert.ok(xml.includes(`<sum1:RegistroAnterior>`));
  assert.ok(xml.includes("Yeguada &lt;Los Álamos&gt; &amp; Hijos"));
  assert.ok(!xml.includes("<Los"));
});
