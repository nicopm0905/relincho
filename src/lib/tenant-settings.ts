/**
 * Datos fiscales del centro en la página de ajustes: razón social, NIF,
 * dirección, IBAN de cobro… Solo los recibe quien puede editarlos
 * (`settings.manage`, como `tenant.update`). La página es un componente de
 * servidor: lo que se le pasa al formulario viaja al navegador aunque el rol
 * no deba verlo, así que se filtra aquí y no en la interfaz.
 *
 * Módulo puro: sin Prisma ni red.
 */
import { can, type PermissionRole } from "@/lib/permissions";

export interface TenantSettings {
  id: string;
  name: string;
  fiscalName: string | null;
  nif: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  iban: string | null;
  paymentTerms: string | null;
  regaCode: string | null;
}

/** Los campos del formulario para ese rol, o `null` si no puede gestionarlos. */
export function tenantSettingsFor(
  role: PermissionRole,
  tenant: TenantSettings,
): TenantSettings | null {
  if (!can({ role }, "settings.manage")) return null;
  return {
    id: tenant.id,
    name: tenant.name,
    fiscalName: tenant.fiscalName,
    nif: tenant.nif,
    address: tenant.address,
    postalCode: tenant.postalCode,
    city: tenant.city,
    province: tenant.province,
    iban: tenant.iban,
    paymentTerms: tenant.paymentTerms,
    regaCode: tenant.regaCode,
  };
}
