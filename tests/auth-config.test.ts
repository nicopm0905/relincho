import { test } from "node:test";
import assert from "node:assert/strict";

import { MAGIC_LINK_MAX_AGE_SECONDS } from "@/server/auth/config";

test("el enlace de acceso por email caduca a los 3 días, no a las 24 horas", () => {
  assert.equal(MAGIC_LINK_MAX_AGE_SECONDS, 3 * 24 * 60 * 60);
});
