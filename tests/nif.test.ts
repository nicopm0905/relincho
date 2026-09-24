import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidNif, normalizeNif } from "../src/lib/nif";

test("acepta DNI, NIE y CIF con su control correcto", () => {
  assert.equal(isValidNif("12345678Z"), true); // DNI
  assert.equal(isValidNif("X1234567L"), true); // NIE
  assert.equal(isValidNif("B12345674"), true); // CIF sociedad limitada (control numerico)
  assert.equal(isValidNif("Q2826000H"), true); // CIF organismo (control letra)
});

test("rechaza controles erroneos y formatos que no son NIF", () => {
  assert.equal(isValidNif("12345678A"), false);
  assert.equal(isValidNif("X1234567A"), false);
  assert.equal(isValidNif("B12345675"), false);
  assert.equal(isValidNif("1234"), false);
  assert.equal(isValidNif(""), false);
});

test("tolera espacios, guiones y minusculas al teclear", () => {
  assert.equal(normalizeNif(" 12.345.678-z "), "12345678Z");
  assert.equal(isValidNif("12345678-z"), true);
});
