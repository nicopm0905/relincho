import { expect, test } from "@playwright/test";

import { db, loginAs, seedPilotCenter } from "./support";

/**
 * Activar avisos push (roadmap §4 E4). Chromium sin interfaz no admite la
 * Push API (va como incógnito: crbug.com/41124656), así que aquí se simula
 * solo `pushManager.subscribe`, que es lo que habla con Google o Apple. El
 * resto es real: el permiso, el registro de /sw.js, la pantalla y lo que se
 * guarda en la BD. La entrega real se prueba en un móvil (aceptación de E4).
 */
test.afterAll(async () => {
  await db.$disconnect();
});

test("con permiso concedido, activar avisos guarda la suscripción", async ({ page, context, baseURL }) => {
  const c = await seedPilotCenter();
  const endpoint = `https://push.example/e2e-${c.tenant.slug}`;
  await context.grantPermissions(["notifications"], { origin: baseURL });
  await context.addInitScript((endpoint) => {
    const fake = {
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: "BPe2e-p256dh-inventada", auth: "e2e-auth-inventada" } }),
      unsubscribe: async () => true,
    };
    PushManager.prototype.subscribe = async () => fake as unknown as PushSubscription;
    PushManager.prototype.getSubscription = async () => null;
  }, endpoint);

  await loginAs(context, c.propietaria);
  await page.goto(`/${c.tenant.slug}/portal/avisos`);
  await page.getByRole("button", { name: "Activar avisos en este dispositivo" }).click();
  await expect(page.getByText("Este dispositivo recibe avisos.")).toBeVisible();

  const saved = await db.pushSubscription.findUnique({ where: { endpoint } });
  expect(saved?.userId).toBe(c.propietaria.id);
  expect(saved?.p256dh).toBe("BPe2e-p256dh-inventada");
});
