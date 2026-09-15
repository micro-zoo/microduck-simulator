import test from "node:test";
import assert from "node:assert/strict";
import { BAM_M6, computeBamFriction, computeBamTorque } from "../src/game/bam-actuator.js";

test("BAM XL330 torque includes firmware current limiting and back-EMF", () => {
  const stalled = computeBamTorque({ target: 10, position: 0, velocity: 0, voltage: 7.35 });
  const moving = computeBamTorque({ target: 10, position: 0, velocity: 12, voltage: 7.35 });
  assert.ok(stalled <= BAM_M6.kt * BAM_M6.maxCurrent + 1e-12);
  assert.ok(moving < stalled, "back-EMF must reduce drive torque at speed");
});

test("BAM m6 friction grows with gearbox load and falls off away from zero speed", () => {
  const stationary = computeBamFriction({ motorTorque: 0.4, externalTorque: 0.1, velocity: 0 });
  const fast = computeBamFriction({ motorTorque: 0.4, externalTorque: 0.1, velocity: 20 });
  const unloaded = computeBamFriction({ motorTorque: 0, externalTorque: 0, velocity: 0 });
  assert.ok(stationary > fast);
  assert.ok(stationary > unloaded);
  assert.ok(unloaded >= BAM_M6.frictionBase);
});
