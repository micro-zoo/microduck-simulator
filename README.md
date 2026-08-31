---
title: Microduck Sandbox
emoji: 🐤
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 8080
pinned: false
---

# Microduck RL playground

Real trained RL policies for the Microduck robot, running fully in the
browser: MuJoCo compiled to WebAssembly steps the physics, onnxruntime-web
runs the policy network at 50 Hz. No server, no backend.

Two locomotion variants of the same robot are included: **legs** (walking,
the default) and **rollers** (the wheeled skating variant). Press `M` (or
hold D-pad up ~1 s on a gamepad) to switch; the roller model, meshes and
policies are lazy-loaded on the first switch.

The feet model also has a **WBC** control stack. Select `WBC` in the HUD,
then choose one of the 35 reference motions. The browser runs the tracking
policy closed-loop at 50 Hz; this is not prerecorded pose playback. The WBC
policy, motion index and selected reference stream are lazy-loaded on first use.

## Policies

| Mode | Checkpoint | What it does |
|--------|-----------|--------------|
| Run (legs) | `BEST_alpha_walking.onnx` | Velocity-tracking locomotion (arrows / WASD to steer) |
| Sit | `BEST_alpha_sitstand.onnx` | Sits down on its hull, stands back up |
| Roll | `roulade.onnx` | Rolls over and recovers |
| Kick | `ball_kick_left.onnx` / `ball_kick_right.onnx` | Blind one-shot kick (0.5 s window, zeroed commands), left or right leg |
| Drive (rollers) | `BEST_roller.onnx` | Velocity-tracking skating on 4 passive wheels (higher top speed: 0.6 m/s) |
| Crouch (rollers) | `BEST_roller_crouch.onnx` | One-shot crouch-glide: sinks low over ~3.5 s and stands back up (phase-encoded command) |
| WBC (legs) | `wbc/microduck-wbc/policy.onnx` | Tracks the selected whole-body reference with policy-predicted joint residuals |

Policies and MJCF model from
[pollen-robotics/microduck](https://github.com/pollen-robotics/microduck)
and [pollen-robotics/microduck_rl](https://github.com/pollen-robotics/microduck_rl).
The WBC policy and 35-motion `teacher_train` reference library come from
[micro-zoo/wbc-mjlab](https://github.com/micro-zoo/wbc-mjlab).

## Controls

- Arrows or WASD (ZQSD): forward / back + turn
- M: switch legs <-> rollers
- Q / E (A / E on AZERTY): kick left / right (legs only)
- R: roll (legs) / crouch-glide (rollers)
- C: toggle the chase camera (on by default; dragging detaches it)
- Space: reset
- Drag to orbit, scroll to zoom
- Colour dots: repaint the duck (it quacks)
- Control panel: switch between operator-driven Skills and WBC motion tracking
- WBC Motion: select the reference clip; changing clips restarts from frame 0

In roller mode the legs-only actions (kicks, sit) are disabled and their
hints fade out; play the ball by driving into it.

WBC is feet-only. Selecting WBC while rollers are active switches back to
feet; selecting rollers while WBC is active returns to the Skills stack.
Normal locomotion, sit, roll, kick and head-mode inputs do not alter the robot
while the WBC tracker owns control. Reset restarts the selected motion.

### URL parameters

- `?boot=1`: skip the welcome modal and land straight on the BIOS console,
  which then shows the real loading progress live (honest loader) before
  the normal entrance plays. Boot failures (missing asset, policy fetch
  error...) freeze the console on a `SYSTEM HALTED` screen with the error
  detail - handy for debugging.

The ball is local-only: it lives in your tab's physics and is not shared
with the multiplayer ghosts. A square arena (3 x 3 m) fences the play
area so neither the ball nor the duck can wander off.

### Gamepad

Plug in a controller and the same mapping as the real robot runtime applies:

- Left stick: forward / back + turn
- Right stick: orbit the camera (detaches the chase cam)
- R3 (right stick click): toggle the chase cam back on
- X: roll (legs) / crouch-glide (rollers)
- RB / LB: right / left kick (legs only)
- D-pad down: sit / stand toggle (legs only)
- D-pad up: hold ~1 s to switch legs <-> rollers (the real robot uses a 3 s hold)
- Right trigger: mouth (analog) + quack

## Multiplayer ghosts

Other people visiting the Space at the same time show up as translucent
ducks, live. Peer-to-peer WebRTC via [Trystero](https://github.com/dmotz/trystero)
(serverless signaling over public Nostr relays), so it works from a static
Space with no backend. Each tab broadcasts its duck's pose (trunk + 14
joints + jaw + colour + locomotion variant) at 10 Hz; up to 3 ghosts are
rendered, extra peers stay connected but invisible. The camcorder-style OSD
in the top-right corner shows "N ONLINE" when peers are around.

Ghost limitations in v1: a peer in roller mode renders with the roller rig
only if your tab has already loaded it (otherwise it falls back to the leg
rig), and ghost wheels don't spin (passive wheel joints aren't broadcast).
Old clients simply ignore the new variant flag.

## How it works

The app is a Vite + React + MUI shell around an imperative game core:
React/MUI renders the UI chrome (title menu, BIOS console, HUD, touch
overlay), react-three-fiber owns the canvas/lights/environment, and the
physics/policy/rig loop lives in framework-agnostic modules under
`app/src/game/`. A zustand store bridges the two (game state out,
UI intents in).

- `app/src/game/game.js` fetches the MJCF (`robot_allcollisions.xml`, or
  `robot_allcollisions_rollers.xml` for the roller variant), strips the
  visual geoms, injects a floor, arena walls, a ball, a collision box for
  the arcade cabinet row and a STAND keyframe, and compiles it with the
  official `@mujoco/mujoco` WASM bindings.
- The regular Skills stack on both variants shares the exact same policy interface: 61D observation
  (gyro, projected gravity, 14 joint pos/vel, last action, 13D command)
  and 14 position-targets, matching [`microduck_rl/scripts/infer_policy.py`](https://github.com/pollen-robotics/microduck_rl/blob/main/scripts/infer_policy.py).
  The roller variant adds 4 passive wheel hinges that appear in `qpos`
  (zeroed in the keyframe) but not in the observation.
- WBC uses its exported 72D actor observation: a 24D reference command
  (base height, body-frame linear/angular velocity, gravity and 14 reference
  joint positions), followed by gyro, projected gravity, 14 relative joint
  positions, 14 joint velocities and the previous 14D residual action. Its
  control target is `reference_joint_position + residual_action`, matching
  the policy's `reference_residual` training contract.
- Rendering is a three.js rig built from `kinematics.json` /
  `kinematics_rollers.json` + decimated STL meshes, driven directly from
  MuJoCo `qpos` (including the passive wheel spin).
- Switching variants swaps the compiled model + data + rig + ONNX sessions
  wholesale; both stay resident after the first load so toggling back and
  forth is instant.

## Development

```bash
cd app
npm install
npm run dev     # dev server on http://localhost:5173
npm run build   # production bundle in app/dist/
```

The Space builds with the included `Dockerfile` (Vite build, served by
nginx-unprivileged on port 8080). Static assets (meshes, policies, audio,
images) live in `app/public/` and keep their historical URLs.
