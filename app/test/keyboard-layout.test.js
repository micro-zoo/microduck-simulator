import test from "node:test";
import assert from "node:assert/strict";

import { readLayoutMap, resolveKeycaps } from "../src/ui/keyboard-layout.js";

const AZERTY = new Map(
  Object.entries({ KeyW: "z", KeyA: "q", KeyS: "s", KeyD: "d", KeyQ: "a", KeyE: "e" }),
);
const QWERTY = new Map(
  Object.entries({ KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", KeyQ: "q", KeyE: "e" }),
);
const DVORAK = new Map(
  Object.entries({ KeyW: ",", KeyA: "a", KeyS: "o", KeyD: "e", KeyQ: "'", KeyE: "." }),
);

const CODES = ["KeyQ", "KeyE"];

test("resolves caps and the movement hint from the active layout", () => {
  assert.deepEqual(resolveKeycaps(CODES, QWERTY), {
    labels: { KeyW: "W", KeyA: "A", KeyS: "S", KeyD: "D", KeyQ: "Q", KeyE: "E" },
    moveHint: "arrows or WASD",
  });
  const azerty = resolveKeycaps(CODES, AZERTY);
  assert.deepEqual(azerty.labels, {
    KeyW: "Z", KeyA: "Q", KeyS: "S", KeyD: "D", KeyQ: "A", KeyE: "E",
  });
  assert.equal(azerty.moveHint, "arrows or ZQSD");

  const dvorak = resolveKeycaps(CODES, DVORAK);
  assert.equal(dvorak.labels.KeyQ, "'");
  assert.equal(dvorak.moveHint, "arrows or ,AOE");
});

test("falls back to labels naming both layouts without a map", () => {
  assert.deepEqual(resolveKeycaps(CODES, null), {
    labels: { KeyW: "W/Z", KeyA: "A/Q", KeyS: "S", KeyD: "D", KeyQ: "Q/A", KeyE: "E" },
    moveHint: "arrows or WASD / ZQSD",
  });
  assert.equal(resolveKeycaps(["KeyX"], null).labels.KeyX, "X");
});

test("keeps the inclusive hint when the map misses a movement key", () => {
  const partial = new Map([["KeyW", "z"], ["KeyA", "q"], ["KeyS", "s"]]);
  const { labels, moveHint } = resolveKeycaps(CODES, partial);
  assert.equal(labels.KeyW, "Z");
  assert.equal(labels.KeyD, "D");
  assert.equal(moveHint, "arrows or WASD / ZQSD");
});

test("rejects layout values that cannot sit on a keycap", () => {
  const junk = new Map(
    Object.entries({ KeyQ: "", KeyE: "  ", KeyW: "Dead", KeyA: "́", KeyS: 7 }),
  );
  const { labels } = resolveKeycaps(CODES, junk);
  assert.deepEqual(labels, {
    KeyW: "W/Z", KeyA: "A/Q", KeyS: "S", KeyD: "D", KeyQ: "Q/A", KeyE: "E",
  });
});

test("a throwing map cannot break the menu", () => {
  const hostile = { get: () => { throw new Error("nope"); } };
  assert.equal(resolveKeycaps(CODES, hostile).labels.KeyQ, "Q/A");
});

test("readLayoutMap yields null when the API is absent or refuses", async () => {
  assert.equal(await readLayoutMap({}), null);
  assert.equal(await readLayoutMap({ keyboard: {} }), null);
  const rejects = { keyboard: { getLayoutMap: () => Promise.reject(new Error("blocked")) } };
  assert.equal(await readLayoutMap(rejects), null);
  const throws = { keyboard: { getLayoutMap: () => { throw new Error("framed"); } } };
  assert.equal(await readLayoutMap(throws), null);
});

test("readLayoutMap returns the map where the API is supported", async () => {
  const nav = { keyboard: { getLayoutMap: async () => AZERTY } };
  assert.equal(await readLayoutMap(nav), AZERTY);
});
