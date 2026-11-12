import { test } from "node:test";
import assert from "node:assert/strict";

import { imageRemotePatterns } from "@/lib/image-hosts";

test("las fotos servidas desde R2_PUBLIC_URL están permitidas para next/image", () => {
  const hosts = imageRemotePatterns("https://pub-1234abcd.r2.dev").map((p) => p.hostname);
  assert.ok(hosts.includes("pub-1234abcd.r2.dev"));
  assert.ok(imageRemotePatterns("https://fotos.ejemplo.test/").some((p) => p.hostname === "fotos.ejemplo.test" && p.protocol === "https"));
});

test("sin R2_PUBLIC_URL, o con una que no es https, solo queda el dominio de R2", () => {
  for (const value of [undefined, "", "no-es-una-url", "http://inseguro.test"]) {
    assert.deepEqual(imageRemotePatterns(value).map((p) => p.hostname), ["*.r2.cloudflarestorage.com"], String(value));
  }
});
