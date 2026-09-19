import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeSource, referrerHost } from "@/lib/attribution";

test("el canal se limpia y se puede leer en una consulta", () => {
  assert.equal(normalizeSource("Carta Jerez!!"), "carta-jerez");
  assert.equal(normalizeSource("  FLYER-2026  "), "flyer-2026");
  assert.equal(normalizeSource("carta___jerez"), "carta-jerez");
});

test("un canal vacío o basura no se guarda", () => {
  assert.equal(normalizeSource(null), null);
  assert.equal(normalizeSource(""), null);
  assert.equal(normalizeSource("!!!"), null);
  assert.equal(normalizeSource("a"), null, "un carácter no identifica un canal");
});

test("un canal larguísimo se corta en el servidor", () => {
  const long = "x".repeat(200);
  assert.equal(normalizeSource(long)?.length, 40);
});

test("del referrer solo interesa el dominio", () => {
  assert.equal(referrerHost("https://www.google.com/search?q=relincho"), "google.com");
  assert.equal(referrerHost("http://facebook.com/groups/123"), "facebook.com");
  assert.equal(referrerHost("whatsapp.com"), "whatsapp.com");
  assert.equal(referrerHost("no es una url"), null);
  assert.equal(referrerHost(null), null);
});
