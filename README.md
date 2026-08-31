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
then choose one of four deployment-compatible CSV references. The browser runs the tracking
policy closed-loop at 50 Hz; this is not prerecorded pose playback. The WBC
policy, motion index and selected reference stream are lazy-loaded on first use.

The HUD can also switch between the compact **Arcade** and a full-size
**Dining Room**. The room asset is loaded only on first use; both scene
collision sets are already resident, so later switches are immediate. Scene
switching preserves the selected Skills/WBC control stack and respawns the
robot at a safe scene-specific start point.

## Policies

The complete default policy set is taken from `microduck/robotd-params` and
the simulator copies are byte-for-byte identical to the deployment assets.
Idle legs use the standing network at the deployed 0.05 twist threshold;
roller mode keeps sit, kicks and roulade while its ground-pick slot becomes
the crouch policy.

| Mode | Checkpoint | What it does |
|--------|-----------|--------------|
| Run (legs) | `BEST_alpha_walking.onnx` | Velocity-tracking locomotion (arrows / WASD to steer) |
| Stand / recover (legs) | `BEST_alpha_stand.onnx` | Holds at idle and owns automatic fall recovery |
| Sit / rise (shared) | `BEST_alpha_sitstand.onnx` | Sits down on its hull, stands back up |
| Ground pick (legs) | `alpha_ground_pick.onnx` | Phase-driven beak-to-ground motion |
| Roll (shared) | `roulade.onnx` | Forward roulade; hold gamepad X to chain |
| Kick | `ball_kick_left.onnx` / `ball_kick_right.onnx` | Blind one-shot kick (0.5 s window, zeroed commands), left or right leg |
| Drive (rollers) | `BEST_roller.onnx` | Velocity-tracking skating on 4 passive wheels (higher top speed: 0.6 m/s) |
| Crouch (rollers) | `BEST_roller_crouch.onnx` | Ground-pick slot: phase-driven crouch-glide over ~2.1 s |
| WBC (legs) | `wbc/microduck-wbc/policy.onnx` | Tracks the selected whole-body reference with policy-predicted joint residuals |

Policies and MJCF model from
[micro-zoo/microduck](https://github.com/micro-zoo/microduck)
and [micro-zoo/microduck_rl](https://github.com/micro-zoo/microduck_rl).
The WBC policy and four 50 Hz references come from
[micro-zoo/wbc-mjlab](https://github.com/micro-zoo/wbc-mjlab). The default
`wbc_happy.csv` is byte-for-byte the file currently shipped by `microduck`;
the other three use the same headerless 24-column deployment contract.

## Controls

- Arrows or WASD (ZQSD): forward / back + turn
- M: switch legs <-> rollers
- X: forward roll (both locomotion modes)
- G: ground pick (legs) / crouch-glide (rollers)
- Q / E (A / E on AZERTY): kick left / right
- R: sit / stand
- C: toggle the chase camera (on by default; dragging detaches it)
- Space: reset
- Drag to orbit, scroll to zoom
- Colour dots: repaint the duck (it quacks)
- Scene panel: switch between Arcade and Dining Room
- Control panel: switch between operator-driven Skills and WBC motion tracking
- WBC Motion: switching CSV starts the new motion at frame 0 without resetting
  physics or previous-action history

WBC is feet-only. Selecting WBC while rollers are active switches back to
feet; selecting rollers while WBC is active returns to the Skills stack.
Normal locomotion, sit, roll, kick and head-mode inputs do not alter the robot
while the WBC tracker owns control. Reset restarts the selected motion. Each
CSV runs once and returns to Skills after its final row, matching deployment.

### URL parameters

- `?boot=1`: skip the welcome modal and land straight on the BIOS console,
  which then shows the real loading progress live (honest loader) before
  the normal entrance plays. Boot failures (missing asset, policy fetch
  error...) freeze the console on a `SYSTEM HALTED` screen with the error
  detail - handy for debugging.

The ball is local-only: it lives in your tab's physics and is not shared
with the multiplayer ghosts. Arcade uses a 3 x 3 m safety arena; Dining Room
uses the 10.4 x 10.4 m boundary and furniture collision proxies from the
referenced room setup.

Dining Room uses [Dining room | Kichen baked](https://sketchfab.com/3d-models/dining-room-kichen-baked-4831c2ce6a0044d9bee9eacefcc0f2bd)
by [ChristyHsu](https://sketchfab.com/ida61xq), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its placement and
collision proxies follow the read-only
[microduck-racer reference](https://huggingface.co/spaces/Nirav-Madhani/microduck-racer).

### Gamepad

Plug in a controller and the same mapping as the real robot runtime applies:

- Left stick: forward / back + turn
- Right stick: orbit the camera (detaches the chase cam)
- R3 (right stick click): toggle the chase cam back on
- X: forward roll; hold to chain another
- A: ground pick (legs) / crouch-glide (rollers)
- RB / LB: right / left kick
- D-pad down: sit / stand toggle
- D-pad up: hold ~1 s to switch legs <-> rollers (the real robot uses a 3 s hold)
- D-pad right: hold ~1 s to toggle WBC (the real robot uses a 2 s hold)
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
