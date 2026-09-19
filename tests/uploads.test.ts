import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extensionForMime,
  humanSize,
  isAllowedUpload,
  maxBytesFor,
  safeKeySegment,
} from "@/lib/uploads";

test("la extensión sale del MIME, nunca del nombre del fichero", () => {
  assert.equal(extensionForMime("image", "image/jpeg"), "jpg");
  assert.equal(extensionForMime("document", "application/pdf"), "pdf");
  // Un fichero llamado "factura.pdf" que dice ser HTML no pasa por PDF.
  assert.equal(extensionForMime("document", "text/html"), null);
});

test("los tipos que el navegador ejecutaría quedan fuera", () => {
  // Son los dos formatos con los que se puede colar un XSS almacenado.
  for (const mime of ["text/html", "image/svg+xml", "application/javascript", ""]) {
    assert.equal(
      isAllowedUpload("document", mime, 100).ok,
      false,
      `${mime} no debería estar permitido`,
    );
  }
});

test("se rechaza por tamaño antes de firmar la subida", () => {
  const limit = maxBytesFor("image");
  assert.equal(isAllowedUpload("image", "image/png", limit).ok, true);
  const tooBig = isAllowedUpload("image", "image/png", limit + 1);
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.ok === false && tooBig.reason, "size");
});

test("un documento admite más formatos que una foto", () => {
  assert.equal(isAllowedUpload("image", "application/pdf", 10).ok, false);
  assert.equal(isAllowedUpload("document", "application/pdf", 10).ok, true);
  assert.ok(maxBytesFor("document") > maxBytesFor("image"));
});

test("el tipo llega con mayúsculas o espacios y da igual", () => {
  assert.equal(extensionForMime("document", "  APPLICATION/PDF "), "pdf");
});

test("safeKeySegment no deja barras ni puntos dobles", () => {
  assert.equal(safeKeySegment("../../etc/passwd"), "etc-passwd");
  assert.equal(safeKeySegment("Radiografía Tórax"), "Radiografia-Torax");
  assert.ok(!safeKeySegment("a/../../b").includes("/"));
  assert.ok(!safeKeySegment("..").includes(".."));
});

test("humanSize es legible para un dueño de yeguada", () => {
  assert.equal(humanSize(512), "512 B");
  assert.equal(humanSize(2048), "2 KB");
  assert.equal(humanSize(5 * 1024 * 1024), "5.0 MB");
});
