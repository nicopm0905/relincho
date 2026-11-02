import { test } from "node:test";
import assert from "node:assert/strict";

import { pushSupport, vapidKeyToBytes } from "@/lib/push-support";

const base = { hasServiceWorker: true, hasPushManager: true, isIOS: false, isStandalone: false, permission: "default" as const, hasVapidKey: true };

test("en un iPhone sin instalar la app no hay push: hay que añadirla a la pantalla de inicio", () => {
  assert.equal(pushSupport({ ...base, isIOS: true, hasPushManager: false }), "IOS_NEEDS_INSTALL");
  assert.equal(pushSupport({ ...base, isIOS: true, isStandalone: true }), "READY");
});

test("con el permiso denegado no se vuelve a pedir: se explica cómo activarlo en el navegador", () => {
  assert.equal(pushSupport({ ...base, permission: "denied" }), "DENIED");
  assert.equal(pushSupport({ ...base, permission: "granted" }), "READY");
});

test("un navegador sin push, o la app sin claves VAPID, no ofrece activar avisos", () => {
  assert.equal(pushSupport({ ...base, hasServiceWorker: false }), "UNSUPPORTED");
  assert.equal(pushSupport({ ...base, hasPushManager: false }), "UNSUPPORTED");
  assert.equal(pushSupport({ ...base, hasVapidKey: false }), "NOT_CONFIGURED");
});

test("la clave pública VAPID en base64url se convierte a los bytes que pide pushManager.subscribe", () => {
  assert.deepEqual([...vapidKeyToBytes("AQID_-8")], [1, 2, 3, 255, 239]);
});
