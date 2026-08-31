import test from "node:test";
import assert from "node:assert/strict";

import { advanceRunRamp } from "../src/game/run-ramp.js";
import {
  CTRL_DT, RUN_ACCEL_MPS2, RUN_DECEL_MPS2, RUN_VEL_FWD, VEL_FWD,
} from "../src/game/constants.js";

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${actual} should equal ${expected}`);

test("Shift ramps the run command up, then keeps run selected until walk speed", () => {
  let state = { speed: VEL_FWD, policyActive: false };
  const accelerating = [];
  while (state.speed < RUN_VEL_FWD) {
    const previous = state.speed;
    state = advanceRunRamp({ ...state, forwardEligible: true, shiftHeld: true });
    accelerating.push(state.speed - previous);
    assert.equal(state.policyActive, true);
  }
  closeTo(state.speed, RUN_VEL_FWD);
  const accelerationStep = RUN_ACCEL_MPS2 * CTRL_DT;
  assert.ok(accelerating.every((delta, index) => index === accelerating.length - 1 || Math.abs(delta - accelerationStep) < 1e-7));

  const decelerating = [];
  while (state.policyActive) {
    const previous = state.speed;
    state = advanceRunRamp({ ...state, forwardEligible: true, shiftHeld: false });
    decelerating.push(previous - state.speed);
  }
  closeTo(state.speed, VEL_FWD);
  const decelerationStep = RUN_DECEL_MPS2 * CTRL_DT;
  assert.ok(decelerating.every((delta, index) => index === decelerating.length - 1 || Math.abs(delta - decelerationStep) < 1e-7));

  const stopped = advanceRunRamp({ ...state, forwardEligible: false, shiftHeld: true });
  assert.deepEqual(stopped, { speed: VEL_FWD, policyActive: false });
});
