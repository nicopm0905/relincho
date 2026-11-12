import { test } from "node:test";
import assert from "node:assert/strict";

import {
  INLINE_PHOTO_ATTEMPTS,
  INLINE_PHOTO_MAX_CHARS,
  isInlinePhoto,
  isValidStoredPhotoUrl,
} from "@/lib/inline-photo";
import { fitWithin } from "@/lib/compress-image";

const jpeg = (chars: number) => "data:image/jpeg;base64," + "A".repeat(chars);

test("una foto en línea es un JPEG en base64 y no pasa del tamaño máximo", () => {
  assert.equal(isInlinePhoto(jpeg(1000)), true);
  assert.equal(isInlinePhoto(jpeg(INLINE_PHOTO_MAX_CHARS)), false, "demasiado grande");
  assert.equal(isInlinePhoto("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), false, "SVG");
  assert.equal(isInlinePhoto("data:image/png;base64,AAAA"), false, "solo JPEG: es lo que genera la compresión");
  assert.equal(isInlinePhoto("data:image/jpeg;base64,AA AA<script>"), false, "caracteres que no son base64");
  assert.equal(isInlinePhoto("data:image/jpeg;base64,"), false, "vacía");
  assert.equal(isInlinePhoto("https://fotos.ejemplo.test/a.jpg"), false);
});

test("al guardar un caballo, la foto es una URL https, una ruta de la app o una foto en línea válida", () => {
  assert.equal(isValidStoredPhotoUrl("https://pub-1234.r2.dev/t/horses/a.jpg"), true);
  assert.equal(isValidStoredPhotoUrl("/uploads/t/horses/a.jpg"), true);
  assert.equal(isValidStoredPhotoUrl(jpeg(500)), true);
  // Un data: que no es una foto válida no entra en la base de datos.
  assert.equal(isValidStoredPhotoUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), false);
  assert.equal(isValidStoredPhotoUrl(jpeg(INLINE_PHOTO_MAX_CHARS + 1)), false);
  assert.equal(isValidStoredPhotoUrl("javascript:alert(1)"), false);
  assert.equal(isValidStoredPhotoUrl("http://inseguro.test/a.jpg"), false);
});

test("la foto en línea se reduce a 480 px y, si aún pesa mucho, se prueba más pequeña", () => {
  assert.deepEqual(INLINE_PHOTO_ATTEMPTS[0], { maxSide: 480, quality: 0.7 });
  // Cada intento es más pequeño y de menos calidad que el anterior.
  for (let i = 1; i < INLINE_PHOTO_ATTEMPTS.length; i++) {
    assert.ok(INLINE_PHOTO_ATTEMPTS[i].maxSide < INLINE_PHOTO_ATTEMPTS[i - 1].maxSide);
    assert.ok(INLINE_PHOTO_ATTEMPTS[i].quality < INLINE_PHOTO_ATTEMPTS[i - 1].quality);
  }
  assert.deepEqual(fitWithin(4000, 3000, 480), { width: 480, height: 360 });
});
