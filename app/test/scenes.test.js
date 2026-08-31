import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SCENE,
  DINING_ROOM_ATTRIBUTION,
  SCENES,
  SCENE_IDS,
  diningRoomColliders,
} from "../src/game/scenes.js";

test("publishes the compact arcade and full-size dining room scene contracts", () => {
  assert.equal(DEFAULT_SCENE, "arcade");
  assert.deepEqual(SCENE_IDS, ["arcade", "dining"]);
  assert.ok(Math.abs(SCENES.arcade.spawn[0] - (-0.6)) < 1e-12);
  assert.equal(SCENES.arcade.spawn[1], 0);
  assert.equal(SCENES.arcade.arenaHalf, 1.5);
  assert.deepEqual(SCENES.dining.spawn, [-4.18, 3.25]);
  assert.equal(SCENES.dining.arenaHalf, 5.2);
});

test("dining room collision proxies are unique defensive copies", () => {
  const first = diningRoomColliders();
  const second = diningRoomColliders();
  assert.equal(first.length, 11);
  assert.equal(new Set(first.map((collider) => collider.name)).size, first.length);
  assert.ok(first.some((collider) => collider.name === "room_dining_table"));

  first[0].pos[0] = 123;
  first[0].size[0] = 456;
  assert.notEqual(second[0].pos[0], 123);
  assert.notEqual(second[0].size[0], 456);
});

test("dining room keeps visible source and license attribution", () => {
  assert.equal(DINING_ROOM_ATTRIBUTION.creator, "ChristyHsu");
  assert.equal(DINING_ROOM_ATTRIBUTION.license, "CC BY 4.0");
  assert.match(DINING_ROOM_ATTRIBUTION.sourceUrl, /^https:\/\/sketchfab\.com\//);
  assert.match(DINING_ROOM_ATTRIBUTION.licenseUrl, /^https:\/\/creativecommons\.org\//);
});
