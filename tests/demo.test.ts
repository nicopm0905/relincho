import { test } from "node:test";
import assert from "node:assert/strict";

import { DEMO_TENANT_SLUG, isDemoTenant, tenantSlugFromPath } from "@/lib/demo";

test("solo el slug de la demo abre el panel sin cuenta", () => {
  assert.equal(isDemoTenant(DEMO_TENANT_SLUG), true);
  assert.equal(isDemoTenant("yeguada-real"), false);
  assert.equal(isDemoTenant(undefined), false);
  assert.equal(isDemoTenant(""), false);
  assert.equal(isDemoTenant(null), false);
});

test("el slug sale del primer segmento de la ruta", () => {
  assert.equal(tenantSlugFromPath(`/${DEMO_TENANT_SLUG}/inicio`), DEMO_TENANT_SLUG);
  assert.equal(tenantSlugFromPath(`/${DEMO_TENANT_SLUG}`), DEMO_TENANT_SLUG);
  assert.equal(tenantSlugFromPath("/dashboard"), "dashboard");
  assert.equal(tenantSlugFromPath("/"), null);
  assert.equal(tenantSlugFromPath(""), null);
  assert.equal(tenantSlugFromPath(null), null);
});

test("una ruta con query no confunde al resolvedor", () => {
  assert.equal(
    tenantSlugFromPath(`/${DEMO_TENANT_SLUG}/inicio?tab=diario`),
    DEMO_TENANT_SLUG,
  );
  assert.equal(isDemoTenant(tenantSlugFromPath("/otra/inicio?x=1")), false);
});
