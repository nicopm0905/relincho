import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DOCUMENT_KIND,
  DOCUMENT_KINDS,
  normalizeDocumentKind,
  ownsDocumentKey,
} from "@/lib/documents";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

test("una clave solo vale dentro de la carpeta de su propia yeguada", () => {
  const mine = `${TENANT_A}/documents/abc.pdf`;
  assert.equal(ownsDocumentKey(TENANT_A, mine), true);
  // El caso que cierra el agujero: adjuntar el fichero de otra yeguada.
  assert.equal(ownsDocumentKey(TENANT_B, mine), false);
});

test("una clave no puede salirse de su carpeta con ..", () => {
  assert.equal(ownsDocumentKey(TENANT_A, `${TENANT_A}/documents/../secret`), false);
  assert.equal(ownsDocumentKey(TENANT_A, `${TENANT_A}/horses/foto.jpg`), false);
  assert.equal(ownsDocumentKey(TENANT_A, "documents/suelto.pdf"), false);
});

test("un tipo desconocido cae en OTHER en vez de romper el alta", () => {
  assert.equal(normalizeDocumentKind("radiografia"), DEFAULT_DOCUMENT_KIND);
  assert.equal(normalizeDocumentKind(""), DEFAULT_DOCUMENT_KIND);
  assert.equal(normalizeDocumentKind("XRAY"), "XRAY");
  assert.equal(normalizeDocumentKind("xray"), "XRAY");
});

test("los tipos del portal del propietario siguen en la lista", () => {
  // El portal ya clasificaba PHOTO y VIDEO antes de este módulo: si
  // desaparecieran, dejarían de agruparse bien.
  assert.ok(DOCUMENT_KINDS.includes("PHOTO"));
  assert.ok(DOCUMENT_KINDS.includes("VIDEO"));
  assert.ok(DOCUMENT_KINDS.includes("PASSPORT"));
});
