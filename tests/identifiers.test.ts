import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidMicrochip, isValidRega, isValidUeln, normalizeCode } from "../src/lib/identifiers";

test("UELN: 15 caracteres, tolera separadores", () => {
  assert.equal(isValidUeln("724015240123456"), true);
  assert.equal(isValidUeln("724-015-240123456"), true);
  assert.equal(isValidUeln("72401524012345"), false);
});

test("microchip: 15 dígitos exactos", () => {
  assert.equal(isValidMicrochip("941 000 012 345 678"), true);
  assert.equal(isValidMicrochip("94100001234567A"), false);
});

test("REGA: ES y 12 dígitos", () => {
  assert.equal(isValidRega("es110200000123"), true);
  assert.equal(isValidRega("ES11020000012"), false);
  assert.equal(normalizeCode(" es-1102 0000 0123 "), "ES110200000123");
});
