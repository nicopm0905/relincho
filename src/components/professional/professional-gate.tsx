"use client";

import { redirect, usePathname } from "next/navigation";

/**
 * Igual que `OwnerExternalGate`, para el profesional externo (E1a): si abre
 * cualquier ruta del tenant que no sea /[tenantSlug]/profesional, lo manda
 * allí. El panel del centro está cerrado para él también en la API.
 */
export function ProfessionalGate({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();
  const base = `/${tenantSlug}/profesional`;

  if (pathname !== base && !pathname.startsWith(`${base}/`)) {
    redirect(base);
  }

  return null;
}
