#!/usr/bin/env node
/**
 * Comprobación HTTP antes de desplegar.
 *
 * No usa navegador ni base de datos: lanza peticiones contra un servidor ya
 * levantado y verifica las cosas que rompen la venta si fallan —que el panel
 * demo se abra sin cuenta, que en la demo no se pueda escribir, que un
 * visitante sin sesión no lea datos de ninguna yeguada, y que las páginas del
 * escaparate respondan.
 *
 *   npm run check:http                        # contra localhost:3000
 *   npm run check:http -- https://relincho.vercel.app
 */
const BASE = (process.argv[2] ?? process.env.CHECK_BASE_URL ?? "http://localhost:3000")
  .replace(/\/$/, "");
const DEMO = process.env.DEMO_TENANT_SLUG ?? "yeguada-demo-andalucia";

const results = [];
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    results.push(`  ok    ${name}`);
  } catch (error) {
    failed++;
    results.push(`  FALLA ${name}\n        ${error.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, init = {}) {
  return fetch(`${BASE}${path}`, { redirect: "manual", ...init });
}

async function body(res) {
  return res.text();
}

/** Mutación: tRPC solo acepta POST para escrituras. */
async function trpcMutation(path, { tenant, payload = {} } = {}) {
  return fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      ...(tenant ? { "x-tenant-slug": tenant } : {}),
    },
    body: JSON.stringify({ json: payload }),
  });
}

/** Consulta: las lecturas van por GET con el input codificado. */
async function trpcQuery(path, { tenant, payload = {} } = {}) {
  const input = encodeURIComponent(JSON.stringify({ json: payload }));
  return fetch(`${BASE}/api/trpc/${path}?input=${input}`, {
    method: "GET",
    redirect: "manual",
    headers: tenant ? { "x-tenant-slug": tenant } : {},
  });
}

console.log(`\nComprobando ${BASE}\n`);

await check("el escaparate responde y habla de rendimiento", async () => {
  const res = await get("/");
  expect(res.status === 200, `esperaba 200, llegó ${res.status}`);
  const html = await body(res);
  expect(html.includes("Rendimiento"), "la portada ya no menciona Rendimiento");
});

await check("/demo y /fundadores responden", async () => {
  for (const path of ["/demo", "/fundadores", "/contacto"]) {
    const res = await get(path);
    expect(res.status === 200, `${path} devolvió ${res.status}`);
  }
});

await check("el panel de la demo se abre sin cuenta", async () => {
  const res = await get(`/${DEMO}/inicio`);
  expect(res.status === 200, `esperaba 200 sin cookies, llegó ${res.status}`);
  const html = await body(res);
  expect(html.includes("solo lectura"), "falta el aviso de solo lectura");
});

await check("la demo se puede leer por la API sin sesión", async () => {
  const res = await trpcQuery("documents.list", { tenant: DEMO, payload: {} });
  expect(res.status === 200, `esperaba 200, llegó ${res.status}`);
});

await check("en la demo no se puede escribir", async () => {
  const res = await trpcMutation("documents.create", {
    tenant: DEMO,
    payload: { name: "prueba", kind: "OTHER" },
  });
  expect(res.status === 403, `esperaba 403, llegó ${res.status}`);
  const text = await body(res);
  expect(text.includes("FORBIDDEN"), "no llegó un FORBIDDEN");
});

await check("sin cabecera de yeguada no se lee nada", async () => {
  const res = await trpcQuery("documents.list", { payload: {} });
  expect(
    res.status === 401 || res.status === 403,
    `esperaba 401/403, llegó ${res.status}`,
  );
});

await check("un panel ajeno sigue pidiendo sesión", async () => {
  const res = await get("/dashboard");
  expect(
    res.status === 307 || res.status === 302 || res.status === 303,
    `esperaba una redirección, llegó ${res.status}`,
  );
  expect(
    (res.headers.get("location") ?? "").includes("/login"),
    "no redirige al acceso",
  );
});

await check("el acceso ofrece una vía que puede funcionar", async () => {
  const res = await get("/login");
  expect(res.status === 200, `esperaba 200, llegó ${res.status}`);
  const html = await body(res);
  const offersSomething =
    html.includes("Continuar con Google") || html.includes("Enviar enlace mágico");
  const saysSo = html.includes("Acceso no disponible");
  expect(
    offersSomething || saysSo,
    "la pantalla de acceso ni ofrece entrada ni avisa de que no está configurada",
  );
});

await check("los crons exigen su secreto", async () => {
  for (const path of ["/api/cron/reminders", "/api/cron/weekly-digest"]) {
    const res = await get(path);
    expect(res.status === 401, `${path} devolvió ${res.status} sin secreto`);
  }
});

await check("la subida local no acepta escrituras anónimas", async () => {
  const res = await fetch(`${BASE}/api/upload?key=${DEMO}/documents/x.pdf`, {
    method: "PUT",
    body: "x",
  });
  expect(res.status !== 200, "el endpoint local aceptó una subida anónima");
});

await check("el aviso de fallos del navegador valida lo que recibe", async () => {
  const empty = await fetch(`${BASE}/api/report-error`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(empty.status === 400, `esperaba 400 sin mensaje, llegó ${empty.status}`);

  const withMessage = await fetch(`${BASE}/api/report-error`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "check-http", name: "Error" }),
  });
  expect(withMessage.status === 200, `esperaba 200, llegó ${withMessage.status}`);
});

console.log(results.join("\n"));
console.log(
  failed === 0
    ? `\nTodo correcto (${results.length} comprobaciones).\n`
    : `\n${failed} de ${results.length} comprobaciones han fallado.\n`,
);
process.exit(failed === 0 ? 0 : 1);
