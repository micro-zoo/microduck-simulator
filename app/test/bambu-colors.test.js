import assert from "node:assert/strict";
import test from "node:test";
import { BAMBU_PLA_BASIC, closestBambuColor, exactBambuColor } from "../src/customizer/bambu-colors.js";

test("Bambu PLA Basic catalogue exposes unique hex colours", () => {
  assert.equal(BAMBU_PLA_BASIC.length, 30);
  assert.equal(new Set(BAMBU_PLA_BASIC.map((color) => color.hex)).size, BAMBU_PLA_BASIC.length);
  assert.equal(exactBambuColor("#ff6a13")?.name, "Orange");
});

test("custom colours resolve to the nearest Bambu filament", () => {
  const match = closestBambuColor("#FE6B18");
  assert.equal(match.name, "Orange");
  assert.equal(match.exact, false);
});
