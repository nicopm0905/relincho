import { test } from "node:test";
import assert from "node:assert/strict";

import { fitWithin, MAX_PHOTO_SIDE } from "@/lib/compress-image";

test("una foto del móvil se reduce a 1600 px de lado conservando la proporción, y una pequeña no se agranda", () => {
  assert.equal(MAX_PHOTO_SIDE, 1600);
  assert.deepEqual(fitWithin(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3000, 4000), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
});
