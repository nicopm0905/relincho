import { test } from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "@/lib/permissions";
import { tenantSettingsFor } from "@/lib/tenant-settings";

const tenant = {
  id: "t-1",
  name: "Centro Hípico Inventado",
  fiscalName: "Inventado SL",
  nif: "B12345674",
  address: "Camino de prueba 1",
  postalCode: "41000",
  city: "Sevilla",
  province: "Sevilla",
  iban: "ES9121000418450200051332",
  paymentTerms: "30 días",
  regaCode: "ES410000000000",
  plan: "cuadra",
  stripeCustomerId: "cus_inventado",
};

test("solo quien gestiona la configuración recibe los datos fiscales del centro", () => {
  const withData = ROLES.filter((role) => tenantSettingsFor(role, tenant) !== null);
  assert.deepEqual(withData, ["OWNER", "MANAGER"]);
});

test("los datos fiscales llevan solo los campos del formulario de ajustes", () => {
  assert.deepEqual(tenantSettingsFor("OWNER", tenant), {
    id: "t-1",
    name: "Centro Hípico Inventado",
    fiscalName: "Inventado SL",
    nif: "B12345674",
    address: "Camino de prueba 1",
    postalCode: "41000",
    city: "Sevilla",
    province: "Sevilla",
    iban: "ES9121000418450200051332",
    paymentTerms: "30 días",
    regaCode: "ES410000000000",
  });
});
