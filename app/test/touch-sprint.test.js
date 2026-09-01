import test from "node:test";
import assert from "node:assert/strict";

import { TouchSource } from "../src/game/controls/touch.js";

function makeElement() {
  const listeners = new Map();
  const classes = new Set();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    emit(type, pointerId = 1) {
      listeners.get(type)?.({ pointerId, preventDefault() {} });
    },
    setPointerCapture() {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
  };
}

test("touch RUN is a held sprint modifier and never fires a discrete action", () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const sprint = makeElement();
  const a = makeElement();
  const b = makeElement();
  const actions = [];
  globalThis.window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.document = {
    getElementById(id) {
      return { "touch-sprint": sprint, "touch-a": a, "touch-b": b }[id] ?? null;
    },
  };
  try {
    const source = new TouchSource({ getVelocityLimits: () => [0.25, -0.2, 1.0] });
    source.onAction = (action) => actions.push(action);
    source.init();

    sprint.emit("pointerdown", 7);
    assert.equal(source.pressed.sprint, true);
    assert.equal(sprint.classList.contains("down"), true);
    assert.deepEqual(actions, []);

    sprint.emit("pointerup", 7);
    assert.equal(source.pressed.sprint, false);
    assert.equal(sprint.classList.contains("down"), false);
    source.dispose();
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});
