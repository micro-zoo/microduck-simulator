import test from "node:test";
import assert from "node:assert/strict";

import { KeyboardSource } from "../src/game/controls/keyboard.js";

function makeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    emit(type, code) {
      let prevented = false;
      listeners.get(type)?.({ code, repeat: false, preventDefault: () => { prevented = true; } });
      return prevented;
    },
  };
}

test("Shift is a forward-sprint modifier without becoming a movement source", () => {
  const oldWindow = globalThis.window;
  const fakeWindow = makeWindow();
  globalThis.window = fakeWindow;
  try {
    const source = new KeyboardSource({ getVelocityLimits: () => [0.25, -0.2, 1.0] });
    source.init();

    fakeWindow.emit("keydown", "ShiftLeft");
    assert.equal(source.isSprinting(), true);
    assert.equal(source.isActive(), false);
    assert.equal(source.pressed.sprint, true);

    assert.equal(fakeWindow.emit("keydown", "KeyW"), true);
    assert.equal(source.isActive(), true);
    assert.equal(source.pressed.fwd, true);
    assert.equal(source.command[0], 0.25);

    fakeWindow.emit("keyup", "ShiftLeft");
    assert.equal(source.isSprinting(), false);
    assert.equal(source.pressed.sprint, false);
    assert.equal(source.command[0], 0.25);

    fakeWindow.emit("blur");
    assert.equal(source.isActive(), false);
    assert.equal(source.command[0], 0);
    source.dispose();
  } finally {
    globalThis.window = oldWindow;
  }
});

test("IJKL retain auxiliary modal input without taking drive authority", () => {
  const oldWindow = globalThis.window;
  const fakeWindow = makeWindow();
  globalThis.window = fakeWindow;
  try {
    const source = new KeyboardSource({ getVelocityLimits: () => [0.25, -0.2, 1.0] });
    source.init();

    assert.equal(fakeWindow.emit("keydown", "KeyI"), true);
    assert.equal(source.pressed.auxUp, true);
    assert.equal(source.isActive(), false);
    assert.equal(source.command[0], 0);
    fakeWindow.emit("keyup", "KeyI");
    assert.equal(source.pressed.auxUp, false);
    source.dispose();
  } finally {
    globalThis.window = oldWindow;
  }
});
