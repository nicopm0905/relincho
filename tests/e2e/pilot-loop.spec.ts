import { expect, test } from "@playwright/test";

import { E2E_CRON_SECRET } from "./env";
import { db, loginAs, seedPilotCenter } from "./support";

/**
 * Smoke del bucle del piloto (roadmap §1.3 nivel 3, hito H1): lo que se vende
 * a los primeros centros, en un navegador real y con el viewport de un móvil.
 * Cada test siembra su propio centro, así que no dependen del orden.
 */
test.afterAll(async () => {
  await db.$disconnect();
});

test("el herrador registra un herraje y la propietaria lo ve en su portada del móvil", async ({ page, context, browser }) => {
  const c = await seedPilotCenter();

  // 1. El herrador, en su área: Lucero es su único caballo y el herraje su único acto.
  await loginAs(context, c.herrador);
  await page.goto(`/${c.tenant.slug}/profesional`);
  await expect(page.getByRole("heading", { name: "Registrar visita" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lucero", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Acto" })).toContainText("Herraje");
  await expect(page.getByLabel("Fecha de la visita")).not.toHaveValue("");
  await page.getByRole("button", { name: "Registrar visita" }).click();
  await expect(page.getByText("Visita registrada en 1 caballo")).toBeVisible();

  // 2. La propietaria, en su móvil: otro contexto (otro teléfono), con las
  // mismas opciones del proyecto. En el mismo contexto, el refresco que lanza
  // el formulario podía devolver la cookie del herrador a mitad del cambio.
  const phone = await browser.newContext();
  await loginAs(phone, c.propietaria);
  const portal = await phone.newPage();
  expect(portal.viewportSize()).toEqual({ width: 390, height: 844 });
  await portal.goto(`/${c.tenant.slug}/portal`);
  await expect(portal.getByRole("heading", { name: "Inicio", level: 1 })).toBeVisible();
  await expect(portal.getByRole("navigation", { name: "Navegación del portal" }).getByRole("link", { name: "Inicio" })).toBeVisible();

  const lastFarrier = portal.getByRole("region", { name: "Último herraje" });
  await expect(lastFarrier.getByRole("link", { name: /Lucero/ })).toContainText("Hoy");

  const today = portal
    .getByRole("region", { name: "Actividad reciente" })
    .getByRole("listitem")
    .filter({ has: portal.getByRole("heading", { name: "Hoy" }) });
  await expect(today.getByRole("link", { name: /Herrador · Herraje/ })).toContainText("Lucero");

  // Solo sus caballos: el de otro cliente del centro no aparece en ninguna parte.
  await expect(portal.getByRole("main")).not.toContainText("Tormenta");
  await phone.close();
});

test("el cron de avisos crea las notificaciones del centro, la propietaria y el veterinario, y rechaza sin secreto", async ({ request }) => {
  const c = await seedPilotCenter();
  const cron = (authorization?: string) =>
    request.get("/api/cron/reminders", authorization ? { headers: { authorization } } : {});

  expect((await cron()).status()).toBe(401);
  expect((await cron("Bearer otro-secreto")).status()).toBe(401);

  const first = await cron(`Bearer ${E2E_CRON_SECRET}`);
  expect(first.status()).toBe(200);
  // La app de test arranca sin Resend: el aviso se guarda y el envío se omite.
  expect(await first.json()).toMatchObject({ emailConfigured: false });

  const notifications = () =>
    db.notification.findMany({
      where: { tenantId: c.tenant.id },
      select: { userId: true, kind: true, title: true, deliveries: { select: { status: true } } },
    });
  const created = await notifications();
  expect(created.map((n) => n.userId).sort()).toEqual(
    [c.owner.id, c.propietaria.id, c.veterinaria.id].sort(),
  );
  for (const n of created) {
    expect(n.kind).toBe("HEALTH_DUE");
    expect(n.title).toBe("Gripe equina de Lucero en 7 días");
    expect(n.deliveries).toEqual([{ status: "SKIPPED" }]);
  }

  // Relanzar el cron el mismo día no duplica avisos ni envíos.
  expect((await cron(`Bearer ${E2E_CRON_SECRET}`)).status()).toBe(200);
  const again = await notifications();
  expect(again).toHaveLength(created.length);
  expect(again.flatMap((n) => n.deliveries)).toHaveLength(created.length);
});
