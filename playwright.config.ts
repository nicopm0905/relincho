import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { parse } from "dotenv";

import {
  E2E_AUTH_SECRET,
  E2E_BASE_URL,
  E2E_CRON_SECRET,
  E2E_DATABASE_URL,
  E2E_PORT,
  assertLocalDatabase,
} from "./tests/e2e/env";

/**
 * E2E con Playwright: el bucle del piloto en un móvil (roadmap §1.3 nivel 3).
 * Corre en el CI de cada PR (job "E2E (Playwright)") y en local con
 * `npm run test:e2e`; no va en el pre-push porque es lento.
 */
assertLocalDatabase(E2E_DATABASE_URL);

/**
 * Next carga solo los `.env*` del repo, pero nunca pisa una variable que ya
 * exista, aunque esté vacía. Se vacían todas las que aparecen en esos ficheros
 * (en local, `.env.production.local` lleva las credenciales de producción) y
 * después se ponen las de test: la app del E2E no ve ni la BD real, ni Resend,
 * ni Stripe, ni Google.
 */
const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.development",
  ".env.development.local",
];
const blankedEnv = Object.fromEntries(
  ENV_FILES.filter((f) => existsSync(f))
    .flatMap((f) => Object.keys(parse(readFileSync(f))))
    .map((key) => [key, ""]),
);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  // Una sola app y una sola BD: en serie, sin reintentos que escondan un flaky.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "movil-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: devices["Pixel 7"].userAgent,
      },
    },
  ],
  webServer: {
    // `next build` + `next start` y no `next dev`: es el servidor que se
    // despliega (sin overlay ni indicador de dev, sin compilar cada ruta al
    // primer acceso, que da timeouts falsos) y en CI es más estable. Es lo
    // mismo que `npm run build`, pero migrando la BD del E2E desde cero.
    command: `npm run db:e2e:reset && npx prisma generate && npx next build && npx next start -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    // Nunca reutilizar otro servidor: podría ser un `next dev` con la BD de
    // desarrollo y las claves de Resend del `.env`.
    reuseExistingServer: false,
    timeout: 6 * 60_000,
    stdout: "pipe",
    env: {
      ...blankedEnv,
      DATABASE_URL: E2E_DATABASE_URL,
      DIRECT_URL: E2E_DATABASE_URL,
      E2E_DATABASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
      NEXTAUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_URL: E2E_BASE_URL,
      NEXTAUTH_URL: E2E_BASE_URL,
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
      CRON_SECRET: E2E_CRON_SECRET,
      // Sin enlace mágico ni Resend: los avisos salen como SKIPPED.
      EMAIL_LOGIN_ENABLED: "",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
