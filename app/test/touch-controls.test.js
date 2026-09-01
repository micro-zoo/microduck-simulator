import test from "node:test";
import assert from "node:assert/strict";

import { TouchSource, mapTouchControlMode } from "../src/game/controls/touch.js";

function makeElement() {
  const listeners = new Map();
  const classes = new Set();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    emit(type, pointerId = 1) { listeners.get(type)?.({ pointerId, preventDefault() {} }); },
    setPointerCapture() {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
  };
}

test("touch Head and Pose map exactly onto padd's two-stick command contract", () => {
  assert.deepEqual(mapTouchControlMode("head", [0.4, 0.5], [0.6, 0.7]), {
    head: { neckPitch: 0.7, pitch: 0.5, yaw: -0.4, roll: -0.6 },
    body: { z: 0, roll: 0, pitch: 0 },
  });
  assert.deepEqual(mapTouchControlMode("pose", [0.4, -0.5], [0.6, 0.7]), {
    head: { neckPitch: 0, pitch: 0, yaw: 0, roll: 0 },
    body: { z: -0.5, roll: 0.6, pitch: 0.7 },
  });
});

test("touch mouth is a held level while quack fires only on its press edge", () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const mouth = makeElement();
  const quack = makeElement();
  const wawa = makeElement();
  const actions = [];
  globalThis.window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.document = {
    getElementById(id) {
      return { "touch-mouth": mouth, "touch-quack": quack, "touch-wawa": wawa }[id] ?? null;
    },
  };
  try {
    const source = new TouchSource({ getVelocityLimits: () => [0.25, -0.2, 1.0] });
    source.onAction = (action) => actions.push(action);
    source.init();

    mouth.emit("pointerdown", 7);
    source.poll();
    assert.equal(source.axes.jaw, 1);
    assert.equal(mouth.classList.contains("down"), true);
    mouth.emit("pointerup", 7);
    source.poll();
    assert.equal(source.axes.jaw, 0);

    quack.emit("pointerdown", 8);
    wawa.emit("pointerdown", 9);
    assert.deepEqual(actions, ["quack", "wawa"]);
    source.dispose();
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});
