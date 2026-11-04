import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPushPayload, MAX_PUSH_BYTES } from "@/lib/push-payload";

test("el payload push no lleva datos clínicos: solo un título genérico y la URL", () => {
  const payload = buildPushPayload({
    kind: "INCIDENT",
    // Lo que lleva la Notification: no debe viajar al servicio push del navegador.
    title: "Signos de cólico de Lucero",
    body: "Se tumba y se mira el flanco",
    url: "/centro/portal/incidencias/abc",
  });
  const json = JSON.parse(payload) as Record<string, unknown>;
  assert.deepEqual(Object.keys(json).sort(), ["title", "url"]);
  assert.equal(json.url, "/centro/portal/incidencias/abc");
  assert.ok(!payload.includes("cólico") && !payload.includes("Lucero") && !payload.includes("flanco"), payload);
  assert.equal(typeof json.title, "string");
});

test("el payload no supera 4 KB", () => {
  assert.equal(MAX_PUSH_BYTES, 4096);
  const long = buildPushPayload({ kind: "HEALTH_DUE", title: "x", body: "y", url: `/centro/${"a".repeat(10_000)}` });
  assert.ok(Buffer.byteLength(long, "utf8") <= MAX_PUSH_BYTES, String(Buffer.byteLength(long, "utf8")));
  // Una URL que no es de la app tampoco viaja: se cambia por la portada.
  const external = JSON.parse(buildPushPayload({ kind: "HEALTH_DUE", title: "x", body: "y", url: "https://otro.example/x" }));
  assert.equal(external.url, "/");
});
