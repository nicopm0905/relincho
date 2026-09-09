"use client";

import { redirect, usePathname } from "next/navigation";

/**
 * Un layout de servidor no puede leer el pathname, así que la redirección de
 * entrada del portal se hace aquí: si un usuario cuyo único rol es
 * OWNER_EXTERNAL abre cualquier ruta del tenant que no sea /[tenantSlug]/portal,
 * lo mandamos al portal. No renderiza nada.
 */
export function OwnerExternalGate({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();
  const portalBase = `/${tenantSlug}/portal`;

  if (pathname !== portalBase && !pathname.startsWith(`${portalBase}/`)) {
    redirect(portalBase);
  }

  return null;
}
