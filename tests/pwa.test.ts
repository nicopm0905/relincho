import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import sharp from "sharp";

import manifest from "@/app/manifest";

test("el manifest hace la app instalable: nombre, standalone, inicio y iconos de 192 y 512", async () => {
  const m = manifest();
  assert.equal(m.name, "Relincho");
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "/");
  for (const size of [192, 512]) {
    const icon = m.icons?.find((i) => i.sizes === `${size}x${size}` && i.purpose !== "maskable");
    assert.ok(icon, `falta el icono de ${size}`);
    const meta = await sharp(`public${icon.src}`).metadata();
    assert.deepEqual([meta.width, meta.height], [size, size]);
  }
  assert.ok(m.icons?.some((i) => i.purpose === "maskable"), "falta el icono maskable de Android");
});

/** Ejecuta public/sw.js con un `self` falso y devuelve sus manejadores. */
function loadServiceWorker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const shown: { title: string; options: { data?: { url?: string } } }[] = [];
  const opened: string[] = [];
  const self = {
    location: { origin: "https://app.relincho.test" },
    addEventListener: (type: string, fn: (event: unknown) => void) => (handlers[type] = fn),
    registration: { showNotification: async (title: string, options: { data?: { url?: string } }) => shown.push({ title, options }) },
  };
  const clients = { matchAll: async () => [], openWindow: async (url: string) => opened.push(url) };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, clients, URL });
  return { handlers, shown, opened };
}

test("el service worker enseña el aviso push con su título y al tocarlo abre solo rutas de la app", async () => {
  const { handlers, shown, opened } = loadServiceWorker();
  const waits: Promise<unknown>[] = [];
  const event = (data: unknown) => ({ data: { json: () => data }, waitUntil: (p: Promise<unknown>) => waits.push(p) });

  handlers.push(event({ title: "Hay una incidencia con tu caballo", url: "/centro/portal/incidencias/abc" }));
  await Promise.all(waits);
  assert.equal(shown[0].title, "Hay una incidencia con tu caballo");

  const click = (url: string) => ({
    notification: { data: { url }, close: () => {} },
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  handlers.notificationclick(click("/centro/portal/incidencias/abc"));
  handlers.notificationclick(click("https://malicioso.example/robar"));
  handlers.notificationclick(click("//malicioso.example"));
  await Promise.all(waits);
  assert.deepEqual(opened, [
    "https://app.relincho.test/centro/portal/incidencias/abc",
    "https://app.relincho.test/",
    "https://app.relincho.test/",
  ]);
});
