// Deterministic transition between the regular walk command and the local
// sprint policy. Keep this independent of input/physics so the switching
// guarantee is directly unit-testable.
import {
  CTRL_DT, RUN_ACCEL_MPS2, RUN_DECEL_MPS2, RUN_VEL_FWD, VEL_FWD,
} from "./constants.js";

export function advanceRunRamp({ speed, policyActive, forwardEligible, shiftHeld }) {
  // Letting go of forward is a stop request, not a policy hand-off: normal
  // command arbitration should take over immediately in that case.
  if (!forwardEligible) return { speed: VEL_FWD, policyActive: false };

  if (shiftHeld) {
    return {
      speed: Math.min(RUN_VEL_FWD, speed + RUN_ACCEL_MPS2 * CTRL_DT),
      policyActive: true,
    };
  }

  // Shift was released while moving: retain the sprint model until its
  // command reaches the regular walk speed, then hand control to walk.
  if (!policyActive) return { speed: VEL_FWD, policyActive: false };
  const nextSpeed = Math.max(VEL_FWD, speed - RUN_DECEL_MPS2 * CTRL_DT);
  return { speed: nextSpeed, policyActive: nextSpeed > VEL_FWD };
}
