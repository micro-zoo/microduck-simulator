// Browser-side implementation of the XL330 BAM m6 actuator used to train the
// leg policies.  MuJoCo's stock <position> actuator is deliberately not used:
// it cannot model the firmware PWM loop, current limit, back-EMF, dynamic
// friction, or bus delay that the trained policies see.

export const BAM_M6 = Object.freeze({
  kt: 0.36601349688984386,
  resistance: 2.8113923539223227,
  armature: 0.0018077432831600838,
  firmwareKp: 200,
  maxCurrent: 1.75,
  // Deployment uses the centre of the training startup distribution.  The
  // subsequent load sag is still evaluated at every 5 ms physics step.
  supplyVoltage: 7.35,
  voltageDropGain: 0.1,
  minVoltage: 6.0,
  minDelaySteps: 3,
  maxDelaySteps: 6,
  frictionBase: 0.004771183165566,
  frictionStribeck: 0.004676345799486616,
  loadFrictionMotor: 0.2667860954283698,
  loadFrictionExternal: 8.515871897059342e-6,
  loadFrictionMotorStribeck: 1.0722918395099123e-5,
  loadFrictionExternalStribeck: 0.08077928978935671,
  loadFrictionMotorQuad: 0.009972471242139415,
  loadFrictionExternalQuad: 0.004902565732332559,
  stribeckVelocity: 2.890372094130307,
  stribeckAlpha: 8.683259907618984,
  viscousFriction: 0.005359668274599504,
});

// XL330's encoder/PWM conversion used by BAM's VoltageControlledActuator.
const FIRMWARE_ERROR_GAIN = 4096 / (2 * Math.PI * 256 * 885);
const MAX_MOTOR_TORQUE = 8.2 * BAM_M6.kt / BAM_M6.resistance;

export function computeBamTorque({ target, position, velocity, voltage }) {
  const { kt, resistance, firmwareKp, maxCurrent } = BAM_M6;
  let duty = (target - position) * firmwareKp * FIRMWARE_ERROR_GAIN;
  const backEmfDuty = kt * velocity / voltage;
  const currentDutySpan = resistance * maxCurrent / voltage;
  duty = Math.max(backEmfDuty - currentDutySpan, Math.min(backEmfDuty + currentDutySpan, duty));
  duty = Math.max(-1, Math.min(1, duty));
  const torque = kt * voltage * duty / resistance - (kt * kt) * velocity / resistance;
  return Math.max(-MAX_MOTOR_TORQUE, Math.min(MAX_MOTOR_TORQUE, torque));
}

export function computeBamFriction({ motorTorque, externalTorque, velocity }) {
  const p = BAM_M6;
  const stribeck = Math.exp(-((Math.abs(velocity) / p.stribeckVelocity) ** p.stribeckAlpha));
  const gearboxTorque = Math.abs(
    externalTorque * p.loadFrictionExternal - motorTorque * p.loadFrictionMotor,
  );
  const gearboxTorqueStribeck = Math.abs(
    externalTorque * p.loadFrictionExternalStribeck - motorTorque * p.loadFrictionMotorStribeck,
  );
  const motorDrives = Math.abs(motorTorque) > Math.abs(externalTorque);
  const quadratic = motorDrives
    ? p.loadFrictionExternalQuad * externalTorque ** 2
    : p.loadFrictionMotorQuad * motorTorque ** 2;
  return p.frictionBase + stribeck * p.frictionStribeck + gearboxTorque
    + stribeck * gearboxTorqueStribeck + stribeck * quadratic;
}

// One compact deterministic PRNG gives every reset a representative sequence
// of the training-time 3–6 physics-step bus delays without making replay flaky.
function nextRandom(state) {
  let x = state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export class BamM6Actuator {
  constructor({ qposAdr, dofAdr, ctrlAdr, seed = 0x4d445543 }) {
    this.qposAdr = qposAdr;
    this.dofAdr = dofAdr;
    this.ctrlAdr = ctrlAdr;
    this.targets = Array.from(
      { length: BAM_M6.maxDelaySteps + 1 },
      () => new Float64Array(qposAdr.length),
    );
    this.pendingTarget = new Float64Array(qposAdr.length);
    this.previousTorque = new Float64Array(qposAdr.length);
    this.frictionConstraint = new Float64Array(qposAdr.length);
    this.bufferIndex = 0;
    this.seed = seed;
  }

  reset(data) {
    for (let j = 0; j < this.qposAdr.length; j++) {
      const q = data.qpos[this.qposAdr[j]];
      this.pendingTarget[j] = q;
      this.previousTorque[j] = 0;
      for (const target of this.targets) target[j] = q;
    }
    this.bufferIndex = 0;
    this.seed = 0x4d445543;
  }

  setTarget(target) {
    this.pendingTarget.set(target);
  }

  _nextDelay() {
    this.seed = nextRandom(this.seed);
    const count = BAM_M6.maxDelaySteps - BAM_M6.minDelaySteps + 1;
    return BAM_M6.minDelaySteps + (this.seed % count);
  }

  _frictionConstraintForces(data) {
    this.frictionConstraint.fill(0);
    // MuJoCo reports prior-solve DOF-friction rows in efc.  BAM removes only
    // those rows from qfrc_constraint before estimating the gearbox load.
    if (!data.efc_type || !data.efc_id || !data.efc_force) return;
    const nefc = Number(data.nefc) || 0;
    for (let i = 0; i < nefc; i++) {
      // mjCNSTR_FRICTION_DOF is 1 in MuJoCo's public enum.
      if (data.efc_type[i] !== 1) continue;
      const dof = data.efc_id[i];
      for (let j = 0; j < this.dofAdr.length; j++) {
        if (this.dofAdr[j] === dof) this.frictionConstraint[j] += data.efc_force[i];
      }
    }
  }

  apply(model, data) {
    this.targets[this.bufferIndex].set(this.pendingTarget);
    const delay = this._nextDelay();
    const readIndex = (this.bufferIndex - delay + this.targets.length) % this.targets.length;
    const target = this.targets[readIndex];
    this.bufferIndex = (this.bufferIndex + 1) % this.targets.length;

    let load = 0;
    for (const torque of this.previousTorque) load += Math.abs(torque);
    const voltage = Math.max(BAM_M6.minVoltage, BAM_M6.supplyVoltage - BAM_M6.voltageDropGain * load);
    this._frictionConstraintForces(data);

    for (let j = 0; j < this.dofAdr.length; j++) {
      const dof = this.dofAdr[j];
      const torque = computeBamTorque({
        target: target[j], position: data.qpos[this.qposAdr[j]],
        velocity: data.qvel[dof], voltage,
      });
      // qfrc_actuator comes from the previous solve, matching BAM's load
      // calculation.  It differs subtly from the new ctrl value at saturation.
      const externalTorque = -data.qfrc_bias[dof] + data.qfrc_constraint[dof]
        - this.frictionConstraint[j];
      model.dof_frictionloss[dof] = computeBamFriction({
        motorTorque: data.qfrc_actuator[dof], externalTorque, velocity: data.qvel[dof],
      });
      model.dof_damping[dof] = BAM_M6.viscousFriction;
      data.ctrl[this.ctrlAdr[j]] = torque;
      this.previousTorque[j] = torque;
    }
  }
}
