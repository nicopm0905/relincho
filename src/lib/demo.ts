/**
 * Tenant de demostracion publica.
 *
 * Quien escanea el QR del flyer no tiene cuenta y no deberia encontrarse un
 * muro de login: se le sirve esta yeguada en **solo lectura** (las mutaciones se
 * bloquean en `src/server/trpc/init.ts`). Es un slug y no un flag publico para
 * que la URL siga siendo la misma que la de una cuenta normal.
 */
export const DEMO_TENANT_SLUG =
  process.env.DEMO_TENANT_SLUG?.trim() || "yeguada-demo-andalucia";

/** Identificador sintetico del visitante anonimo en modo demo. */
export const DEMO_VIEWER_ID = "demo-readonly-viewer";

export function isDemoTenant(slug?: string | null): boolean {
  return Boolean(slug) && slug === DEMO_TENANT_SLUG;
}

/** Primer segmento de una ruta: `/yeguada-demo-andalucia/inicio` -> el slug. */
export function tenantSlugFromPath(path?: string | null): string | null {
  if (!path) return null;
  const [first] = path.split("?")[0]!.split("/").filter(Boolean);
  return first ?? null;
}
