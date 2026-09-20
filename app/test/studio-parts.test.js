import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { materialHookForMap, materialMapForHexOverrides } from "../src/game/variants.js";
import { meshInstanceKey } from "../src/game/mesh-selector.js";
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
  for (const body of kinematics.bodies) {
    for (const geom of body.geoms ?? []) {
      if (!geom.mesh) continue;
      const selector = meshInstanceKey(geom.mesh, body.name);
      available.set(selector, (available.get(selector) ?? 0) + 1);
    }
  }

  assert.equal(new Set(PRINT_MESH_ORDER).size, PRINT_MESH_ORDER.length);
  assert.equal(PARTS.length, 24);
  for (const selector of PRINT_MESH_ORDER) {
    assert.equal(available.get(selector), 1, `${selector} must resolve to exactly one model mesh`);
  }
});

test("mirrored print parts select and colour independently", () => {
  assert.equal(partForMeshInstance("hip_l.stl", "hip_l").id, "leftHip");
  assert.equal(partForMeshInstance("hip_l.stl", "hip_l_2").id, "rightHip");
  assert.equal(partForMeshInstance("upper_leg_rigidity_plate.stl", "upper_leg_left").id, "leftRigidity");
  assert.equal(partForMeshInstance("upper_leg_rigidity_plate.stl", "upper_leg_right").id, "rightRigidity");
  assert.equal(partForMeshInstance("leg.stl", "leg").id, "leftShin");
  assert.equal(partForMeshInstance("leg.stl", "leg_2").id, "rightShin");

  const overrides = colorOverridesForParts({
    ...DEFAULT_COLORS,
    leftRigidity: "#FF0000",
    rightRigidity: "#0000FF",
  });
  const map = materialMapForHexOverrides(overrides);
  const materialForMesh = materialHookForMap(map);
  assert.deepEqual(materialForMesh("upper_leg_rigidity_plate.stl", "upper_leg_left").color, [1, 0, 0]);
  assert.deepEqual(materialForMesh("upper_leg_rigidity_plate.stl", "upper_leg_right").color, [0, 0, 1]);
});
