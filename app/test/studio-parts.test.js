import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { materialHookForMap, materialMapForHexOverrides } from "../src/game/variants.js";
import { meshInstanceKey, meshNameFromSelector } from "../src/game/mesh-selector.js";
import {
  colorOverridesForParts,
  DEFAULT_COLORS,
  PARTS,
  partForMeshInstance,
  PRINT_MESH_ORDER,
} from "../src/customizer/studio-parts.js";

test("every Color Studio print target exists once in the walking model", async () => {
  const source = new URL("../public/robot/mjlab/kinematics.json", import.meta.url);
  const kinematics = JSON.parse(await readFile(source, "utf8"));
  const available = new Map();
  const seenGeoms = new Set();
  const occurrences = new Map();
  for (const body of kinematics.bodies) {
    for (const geom of body.geoms ?? []) {
      if (!geom.mesh) continue;
      const duplicateKey = `${body.name}|${geom.mesh}|${geom.pos}|${geom.quat}`;
      if (seenGeoms.has(duplicateKey)) continue;
      seenGeoms.add(duplicateKey);
      const occurrenceKey = `${body.name}|${geom.mesh}`;
      const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
      occurrences.set(occurrenceKey, occurrence);
      const selector = meshInstanceKey(geom.mesh, body.name, occurrence);
      available.set(selector, (available.get(selector) ?? 0) + 1);
    }
  }

  assert.equal(new Set(PRINT_MESH_ORDER).size, PRINT_MESH_ORDER.length);
  assert.equal(PARTS.length, 36);
  for (const selector of PRINT_MESH_ORDER) {
    assert.equal(available.get(selector), 1, `${selector} must resolve to exactly one model mesh`);
  }

  const expectedPrintMeshes = [
    "ankle_left.stl", "ankle_right.stl", "bottom_head_shell.stl", "face_part.stl",
    "banana_pcb_locker.stl", "bearing_roll.stl", "foot_left.stl", "foot_right.stl",
    "hip_l.stl", "jaw.stl", "jaw_soft.stl", "left_shell.stl", "upper_leg_left.stl",
    "leg.stl", "m12_lens_holder.stl", "motor_support.stl",
    "neck.stl", "neck_pitch.stl", "noenoeil.stl", "power_support.stl",
    "right_shell.stl", "upper_leg_right.stl", "soft_mouth_top.stl", "sole_left.stl",
    "sole_right.stl", "top_head_shell.stl", "trunk_base.stl",
    "upper_leg_rigidity_plate.stl", "yaw2roll.stl", "yaw_roll_motion.stl",
  ];
  const printableMeshes = new Set(PRINT_MESH_ORDER.map(meshNameFromSelector));
  assert.deepEqual([...printableMeshes].sort(), expectedPrintMeshes.sort());
  const expectedPrintSelectors = [...available.keys()]
    .filter((selector) => printableMeshes.has(meshNameFromSelector(selector)))
    .sort();
  assert.deepEqual([...PRINT_MESH_ORDER].sort(), expectedPrintSelectors);

  const purchased = [
    "xl330.stl", "seeed_bearing__configuration__22x16x4.stl",
    "seeed_bearing__configuration_default.stl", "np_f970.stl", "lens.stl",
    "elec_rpi_robot_hat_pcb.stl", "pcb__raspberry_pi_zero_2_w.stl", "speaker.stl",
  ];
  for (const mesh of purchased) assert.equal(printableMeshes.has(mesh), false, `${mesh} must stay out of the print list`);
});

test("mirrored print parts select and colour independently", () => {
  assert.equal(partForMeshInstance("hip_l.stl", "hip_l", 1).id, "leftHip");
  assert.equal(partForMeshInstance("hip_l.stl", "hip_l_2", 1).id, "rightHip");
  assert.equal(partForMeshInstance("upper_leg_rigidity_plate.stl", "upper_leg_left", 1).id, "leftRigidity");
  assert.equal(partForMeshInstance("upper_leg_rigidity_plate.stl", "upper_leg_right", 1).id, "rightRigidity");
  assert.equal(partForMeshInstance("leg.stl", "leg", 1).id, "leftShin");
  assert.equal(partForMeshInstance("leg.stl", "leg_2", 1).id, "rightShin");
  assert.equal(partForMeshInstance("neck.stl", "neck", 1).id, "neckFront");
  assert.equal(partForMeshInstance("neck.stl", "neck", 2).id, "neckRear");
  assert.equal(partForMeshInstance("bearing_roll.stl", "yaw2roll", 1).id, "leftBearingRetainer");
  assert.equal(partForMeshInstance("bearing_roll.stl", "bearing_roll", 1).id, "rightBearingRetainer");

  const overrides = colorOverridesForParts({
    ...DEFAULT_COLORS,
    leftRigidity: "#FF0000",
    rightRigidity: "#0000FF",
  });
  const map = materialMapForHexOverrides(overrides);
  const materialForMesh = materialHookForMap(map);
  assert.deepEqual(materialForMesh("upper_leg_rigidity_plate.stl", "upper_leg_left", null, 1).color, [1, 0, 0]);
  assert.deepEqual(materialForMesh("upper_leg_rigidity_plate.stl", "upper_leg_right", null, 1).color, [0, 0, 1]);
});
