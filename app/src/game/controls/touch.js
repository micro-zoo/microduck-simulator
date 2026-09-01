// Touch input source (see controller.js for the source interface contract).
// Drive has one floating movement stick plus a right action deck. Head and
// body-pose mirror the deployed padd client: a mode button parks velocity
// and exposes a second floating stick, so both thumbs map continuously.
//
//   Left thumb   FLOATING analog stick: the lower-left quadrant of the
//                screen (#touch-zone) is the grab area, and the stick base
//                (#touch-stick) re-anchors under the finger wherever it
//                lands - so the thumb never has to find a fixed circle -
//                then snaps back to its resting spot on release. Vertical
//                = vx (asymmetric fwd/back limits), horizontal = turn. The
//                nub tracks the finger clamped to the base circle; the
//                command is EMA-smoothed like the gamepad's so releases
//                don't snap.
//   Head mode   left stick = head pitch/yaw; right stick = neck pitch/roll.
//   Pose mode   left stick y = body z; right stick = pitch/roll. This is the
//               deployed padd mapping, including its modal velocity stop.
//   Right deck  kick, roll, pick, mouth, quack, wawa, sit and the Head/Pose mode
//               buttons. Mouth is a level; quack is a press edge + level.
//
// The overlay DOM lives in index.html (#touch-ui); this module only wires
// pointer events to it. `connected` (mirrored onto body.touch-mode by
// rl.js, which is what actually shows the overlay) arms two ways:
//   - (pointer: coarse) matches: phones/tablets, before any touch;
//   - OR the first real touch anywhere: catches DevTools device modes and
//     hybrid laptops the media query misses. Latching, like a gamepad.

const TOUCH_ALPHA = 0.18; // EMA smoothing toward the stick target
const TOUCH_DEADZONE = 0.12; // normalized deflection ignored around center

// Exact deployed padd stick routing, expressed as normalized deflections.
// game.js applies max_head and the asymmetric body-z range at the policy
// boundary, keeping this input source independent of trained-value details.
export function mapTouchControlMode(mode, left, right) {
  if (mode === "head") {
    return {
      head: {
        neckPitch: right[1],
        pitch: left[1],
        yaw: -left[0],
        roll: -right[0],
      },
      body: { z: 0, roll: 0, pitch: 0 },
    };
  }
  if (mode === "pose") {
    return {
      head: { neckPitch: 0, pitch: 0, yaw: 0, roll: 0 },
      body: { z: left[1], roll: right[0], pitch: right[1] },
    };
  }
  return {
    head: { neckPitch: 0, pitch: 0, yaw: 0, roll: 0 },
    body: { z: 0, roll: 0, pitch: 0 },
  };
}

export class TouchSource {
  id = "touch";
  connected = false;
  command = new Float32Array(3); // [vx, 0, wz], EMA-smoothed
  axes = { jaw: 0, orbitX: 0, orbitY: 0 };
  pressed = {
    stick: false, auxStick: false, kick: false, roll: false, pick: false,
    mouth: false, quack: false, wawa: false, sit: false, head: false, pose: false,
  };
  // Owned by game.js, modelled after padd's Drive / Head / BodyPose enum.
  inputMode = "drive";
  head = { neckPitch: 0, pitch: 0, yaw: 0, roll: 0 };
  body = { z: 0, roll: 0, pitch: 0 };
  onAction = () => {}; // assigned by the Controller at registration

  #getVelocityLimits;
  #active = false; // owns twist authority (stick engaged, until EMA settles)
  #target = [0, 0]; // normalized deflection [x, right+] [y, up+]
  #auxTarget = [0, 0]; // right-stick equivalent, same coordinate contract
  #mq = null;
  #onMq = null;
  #disposers = [];

  constructor({ getVelocityLimits }) {
    this.#getVelocityLimits = getVelocityLimits;
  }

  init() {
    this.#mq = window.matchMedia("(pointer: coarse)");
    // Latching: once a device has proven it can touch, keep the thumbs.
    // __microduckTouched carries a touch seen by the title page before
    // this module booted.
    if (window.__microduckTouched) this.connected = true;
    this.#onMq = () => { this.connected = this.connected || this.#mq.matches; };
    this.#mq.addEventListener("change", this.#onMq);
    this.#onMq();
    const armTouch = () => { this.connected = true; };
    window.addEventListener("touchstart", armTouch, { once: true, passive: true });
    this.#disposers.push(() => window.removeEventListener("touchstart", armTouch));

    const zone = document.getElementById("touch-zone");
    const stick = document.getElementById("touch-stick");
    const nub = stick?.querySelector(".nub");
    if (zone && stick && nub) this.#bindStick(zone, stick, nub, this.#target, "stick");
    const auxZone = document.getElementById("touch-aux-zone");
    const auxStick = document.getElementById("touch-aux-stick");
    const auxNub = auxStick?.querySelector(".nub");
    if (auxZone && auxStick && auxNub) {
      this.#bindStick(auxZone, auxStick, auxNub, this.#auxTarget, "auxStick");
    }

    this.#bindButton("touch-kick", "kick", () => this.onAction("alternateKick"));
    this.#bindButton("touch-roll", "roll", () => this.onAction("roll"));
    this.#bindButton("touch-pick", "pick", () => this.onAction("groundPick"));
    this.#bindButton("touch-mouth", "mouth", () => {});
    this.#bindButton("touch-quack", "quack", () => this.onAction("quack"));
    this.#bindButton("touch-wawa", "wawa", () => this.onAction("wawa"));
    this.#bindButton("touch-sit", "sit", () => this.onAction("sitToggle"));
    this.#bindButton("touch-head", "head", () => this.onAction("touchHeadToggle"));
    this.#bindButton("touch-pose", "pose", () => this.onAction("touchPoseToggle"));
  }

  dispose() {
    this.#mq?.removeEventListener("change", this.#onMq);
    for (const off of this.#disposers) off();
    this.#disposers = [];
  }

  isActive() {
    return this.#active;
  }

  poll() {
    const [x, y] = this.#target;
    const [limF, limB, limA] = this.#getVelocityLimits();
    const driving = this.inputMode === "drive";
    const tvx = driving ? (y >= 0 ? y * limF : y * -limB) : 0;
    const twz = driving ? -x * limA : 0;
    this.command[0] += TOUCH_ALPHA * (tvx - this.command[0]);
    this.command[2] += TOUCH_ALPHA * (twz - this.command[2]);
    // Same authority rule as the gamepad sticks: grab on input, release
    // once the smoothed command has settled back to ~zero.
    if (driving && this.pressed.stick) this.#active = true;
    else if (this.#active && Math.abs(this.command[0]) + Math.abs(this.command[2]) < 0.01) {
      this.#active = false;
      this.command.fill(0);
    }
    const mapped = mapTouchControlMode(this.inputMode, this.#target, this.#auxTarget);
    Object.assign(this.head, mapped.head);
    Object.assign(this.body, mapped.body);
    // Deployment RT opens the mouth and quacks on its rising edge; the web
    // exposes the two gestures separately but preserves their overlap.
    this.axes.jaw = this.pressed.mouth || this.pressed.quack ? 1 : 0;
  }

  #on(el, type, fn) {
    el.addEventListener(type, fn);
    this.#disposers.push(() => el.removeEventListener(type, fn));
  }

  #bindStick(zone, stick, nub, target, pressedKey) {
    let pointerId = null;
    let center = null; // stick center while grabbed, zone-local px
    const setFrom = (e) => {
      const zr = zone.getBoundingClientRect();
      const R = stick.offsetWidth / 2;
      const travel = R * 0.62; // max nub travel inside the base circle
      let dx = e.clientX - zr.left - center.x;
      let dy = e.clientY - zr.top - center.y;
      const d = Math.hypot(dx, dy);
      if (d > travel) { dx *= travel / d; dy *= travel / d; }
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / travel, ny = -dy / travel; // up is +y
      const mag = Math.hypot(nx, ny);
      const live = mag >= TOUCH_DEADZONE;
      target[0] = live ? nx : 0;
      target[1] = live ? ny : 0;
    };
    const release = () => {
      pointerId = null;
      center = null;
      this.pressed[pressedKey] = false;
      stick.classList.remove("live");
      nub.style.transform = "";
      // Back to the CSS resting spot until the next grab.
      stick.style.left = "";
      stick.style.right = "";
      stick.style.top = "";
      stick.style.bottom = "";
      target[0] = 0;
      target[1] = 0;
    };
    this.#on(zone, "pointerdown", (e) => {
      e.preventDefault();
      pointerId = e.pointerId;
      // Anchor the base exactly under the finger - a clamped anchor would
      // start the stick with a phantom deflection near the zone edges. The
      // circle clipping off-screen there is the standard floating-stick
      // look, and it takes no pointer events anyway.
      const zr = zone.getBoundingClientRect();
      const R = stick.offsetWidth / 2;
      center = { x: e.clientX - zr.left, y: e.clientY - zr.top };
      stick.style.left = `${center.x - R}px`;
      stick.style.right = "auto";
      stick.style.top = `${center.y - R}px`;
      stick.style.bottom = "auto";
      this.pressed[pressedKey] = true;
      stick.classList.add("live");
      setFrom(e); // zero deflection at grab
      // Last: capture can throw on exotic pointers and must not eat the
      // press state above.
      try { zone.setPointerCapture(e.pointerId); } catch {}
    });
    this.#on(zone, "pointermove", (e) => {
      if (e.pointerId === pointerId) setFrom(e);
    });
    this.#on(zone, "pointerup", (e) => {
      if (e.pointerId === pointerId) release();
    });
    this.#on(zone, "pointercancel", (e) => {
      if (e.pointerId === pointerId) release();
    });
  }

  #bindButton(elId, key, fire) {
    const el = document.getElementById(elId);
    if (!el) return;
    this.#on(el, "pointerdown", (e) => {
      e.preventDefault();
      this.pressed[key] = true;
      el.classList.add("down");
      fire(); // on the press edge, not the release: arcade latency
      try { el.setPointerCapture(e.pointerId); } catch {}
    });
    const release = () => {
      this.pressed[key] = false;
      el.classList.remove("down");
    };
    this.#on(el, "pointerup", release);
    this.#on(el, "pointercancel", release);
  }
}
