import { test } from "node:test";
import assert from "node:assert/strict";
import { formatIban, isValidIban, normalizeIban } from "../src/lib/iban";

test("IBAN espanol valido (ejemplo de la documentacion) con o sin espacios", () => {
  assert.equal(isValidIban("ES9121000418450200051332"), true);
  assert.equal(isValidIban("es91 2100 0418 4502 0005 1332"), true);
});

test("IBAN con el digito de control roto o de otro pais no vale", () => {
  assert.equal(isValidIban("ES9221000418450200051332"), false);
  assert.equal(isValidIban("GB29NWBK60161331926819"), false);
  assert.equal(isValidIban("ES91210004184502000513"), false);
});

test("formato agrupado de cuatro en cuatro", () => {
  assert.equal(normalizeIban(" es91 2100 "), "ES912100");
  assert.equal(formatIban("ES9121000418450200051332"), "ES91 2100 0418 4502 0005 1332");
});
