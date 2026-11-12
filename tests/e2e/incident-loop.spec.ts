import { expect, test } from "@playwright/test";

import { db, loginAs, seedPilotCenter } from "./support";

/**
 * Bucle de incidencias (roadmap §4 E5) en un navegador real con el viewport
 * de un móvil: el mozo avisa, la propietaria confirma desde su teléfono y el
 * centro ve la confirmación. Siembra su propio centro, como el resto.
 */
test.afterAll(async () => {
  await db.$disconnect();
});

test("el mozo crea una incidencia, el propietario la confirma desde el móvil y el centro la ve confirmada", async ({
  page,
  context,
  browser,
}) => {
  const c = await seedPilotCenter();
  const user = await db.user.create({ data: { email: `mozo-${c.tenant.slug}@relincho.test`, name: "Pepe Mozo" } });
  await db.membership.create({ data: { userId: user.id, tenantId: c.tenant.id, role: "GROOM" } });
  const mozo = { id: user.id, email: user.email, name: "Pepe Mozo" };

  // 1. El mozo: caballo, qué pasa y enviar.
  await loginAs(context, mozo);
  await page.goto(`/${c.tenant.slug}/incidencias`);
  await page.getByLabel("Caballo", { exact: true }).selectOption({ label: "Lucero" });
  await page.getByRole("button", { name: "Cojera" }).click();
  await expect(page.getByRole("button", { name: "Moderada" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Avisar al propietario" }).click();
  await expect(page.getByText("Incidencia enviada al propietario")).toBeVisible();

  // 2. La propietaria, en su teléfono: la incidencia es lo primero de su portada.
  const phone = await browser.newContext();
  await loginAs(phone, c.propietaria);
  const portal = await phone.newPage();
  await portal.goto(`/${c.tenant.slug}/portal`);
  const attention = portal.getByRole("region", { name: "Requiere tu atención" });
  await attention.getByRole("link", { name: /Incidencia en Lucero/ }).click();
  await expect(portal.getByRole("heading", { name: "Cojera · Lucero", level: 1 })).toBeVisible();
  await portal.getByRole("button", { name: "Confirmo que lo he leído" }).click();
  await expect(portal.getByText(/^Confirmada /)).toBeVisible();
  await portal.goto(`/${c.tenant.slug}/portal`);
  await expect(portal.getByRole("main")).not.toContainText("Incidencia en Lucero");
  await phone.close();

  // 3. El centro la ve confirmada por su única propietaria con cuenta.
  await page.reload();
  const item = page.getByRole("listitem").filter({ hasText: "Cojera · Lucero" });
  await expect(item).toContainText("Confirmada");
  await expect(item).toContainText("1 de 1 propietarios la han confirmado");
});

test("si el refresco de la página se pierde tras confirmar, la propietaria ve igualmente la incidencia confirmada", async ({
  page,
  context,
}) => {
  const c = await seedPilotCenter();
  const incident = await db.incident.create({
    data: {
      tenantId: c.tenant.id,
      horseId: c.lucero.id,
      category: "LAMENESS",
      severity: "MEDIUM",
      description: "Cojea de la mano izquierda",
      occurredAt: new Date(),
      receipts: { create: { membershipId: c.propietaria.membershipId, notifiedAt: new Date() } },
    },
  });

  await loginAs(context, c.propietaria);
  await page.goto(`/${c.tenant.slug}/portal/incidencias/${incident.id}`);
  await expect(page.getByRole("heading", { name: "Cojera · Lucero", level: 1 })).toBeVisible();

  // A veces el router de Next no aplica el `router.refresh()` posterior a la
  // mutación (#78). Aquí se fuerza: el refresco de la página se queda colgado.
  // Abortarlo no sirve: Next recarga la página entera y trae el dato bueno.
  await page.route("**/portal/incidencias/**", (route) =>
    route.request().headers()["rsc"] ? new Promise<void>(() => {}) : route.continue(),
  );
  await page.getByRole("button", { name: "Confirmo que lo he leído" }).click();
  await expect(page.getByText(/^Confirmada /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmo que lo he leído" })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
