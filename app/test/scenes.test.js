import test from "node:test";
import assert from "node:assert/strict";

import {
  APARTMENT_ASSET,
  BACKROOMS_ASSET,
  DEFAULT_SCENE,
  DINING_ROOM_ASSET,
  LOFT_ASSET,
  SCENES,
  SCENE_IDS,
  VINTAGE_ROOM_ASSET,
} from "../src/game/scenes.js";

test("publishes every runtime-selectable scene contract", () => {
  assert.equal(DEFAULT_SCENE, "arcade");
  assert.deepEqual(SCENE_IDS, ["arcade", "dining", "apartment", "loft", "vintage", "backrooms"]);
  assert.ok(Math.abs(SCENES.arcade.spawn[0] - (-0.6)) < 1e-12);
  assert.equal(SCENES.arcade.spawn[1], 0);
  assert.equal(SCENES.arcade.arenaHalf, 1.5);
  assert.deepEqual(SCENES.dining.spawn, [0, 0]);
  assert.equal(SCENES.dining.arenaHalf, 5.2);
  assert.deepEqual(SCENES.apartment.spawn, [-0.24, -2.28]);
  assert.equal(SCENES.apartment.heading, Math.PI);
  assert.equal(SCENES.apartment.cameraDistance, 1.5);
  assert.equal(SCENES.apartment.arenaHalf, 5.8);
  assert.deepEqual(SCENES.loft.spawn, [4.2, 0.2]);
  assert.equal(SCENES.loft.heading, Math.PI);
  assert.equal(SCENES.loft.cameraDistance, 1.25);
  assert.equal(SCENES.loft.arenaHalf, 4.8);
  assert.deepEqual(SCENES.vintage.spawn, [-2.6, 0]);
  assert.equal(SCENES.vintage.heading, -Math.PI / 2);
  assert.equal(SCENES.vintage.cameraDistance, 1.25);
  assert.equal(SCENES.vintage.arenaHalf, 4.3);
  assert.deepEqual(SCENES.backrooms.spawn, [3.8, 0]);
  assert.equal(SCENES.backrooms.arenaHalf, 14.5);
});

test("every imported room has a cache-busted GLB asset", () => {
  for (const asset of [
    DINING_ROOM_ASSET,
    APARTMENT_ASSET,
    LOFT_ASSET,
    VINTAGE_ROOM_ASSET,
    BACKROOMS_ASSET,
  ]) {
    assert.match(asset, /^\.\/assets\/rooms\/.+\.glb\?v=\d+$/);
  }
});
