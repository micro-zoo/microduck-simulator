import { meshInstanceKey } from "../game/mesh-selector.js";

const target = (body, mesh, occurrence = 1) => ({ body, mesh, occurrence });

// Print source of truth:
// 1. Parts must be present in Pollen Robotics' current Microduck MJCF assembly.
// 2. Their mesh must also be classified as a print in the reconstructed fabrication
//    manifest (microduck-replica commit 6e41e2f, print/README.md).
// Legacy aliases are normalized to the current mesh names and obsolete, unreferenced
// trunk_shell_left/right files are omitted. Exact visual/collision duplicates count
// once; mirrored or separately positioned instances count as distinct physical parts.
// Purchased hardware stays out of the print package.
// Assembly: https://github.com/pollen-robotics/microduck_rl
// Fabrication manifest: https://github.com/fanhao375/microduck-replica/tree/master/print
export const PART_GROUPS = [
  {
    label: "Head",
    parts: [
      { id: "head", label: "Upper head shell", targets: [target("jaw_soft", "top_head_shell.stl")], color: "#F2EFE8" },
      { id: "headBand", label: "Lower head shell", targets: [target("jaw_soft", "bottom_head_shell.stl")], color: "#FF7A2F" },
      { id: "face", label: "Face plate", targets: [target("jaw_soft", "face_part.stl")], color: "#9B9892" },
      { id: "eye", label: "Eye ring", targets: [target("jaw_soft", "noenoeil.stl")], color: "#FFB52E" },
      { id: "jaw", label: "Lower jaw", targets: [target("jaw_soft", "jaw.stl")], color: "#FF7A2F" },
      { id: "upperBeakSoft", label: "Upper beak soft pad", targets: [target("jaw_soft", "soft_mouth_top.stl")], color: "#FFB52E" },
      { id: "lowerJawSoft", label: "Lower jaw soft pad", targets: [target("jaw_soft", "jaw_soft.stl")], color: "#FFB52E" },
      { id: "headMotorSupport", label: "Head motor support", targets: [target("jaw_soft", "motor_support.stl")], color: "#8B8B90" },
      { id: "cameraLensHolder", label: "Camera lens holder", targets: [target("jaw_soft", "m12_lens_holder.stl")], color: "#1D1D1F" },
    ],
  },
  {
    label: "Body",
    parts: [
      { id: "bodyLeft", label: "Left body shell", targets: [target("trunk_base", "left_shell.stl")], color: "#F2EFE8" },
      { id: "bodyRight", label: "Right body shell", targets: [target("trunk_base", "right_shell.stl")], color: "#F2EFE8" },
      { id: "bodyCore", label: "Trunk base", targets: [target("trunk_base", "trunk_base.stl")], color: "#F2EFE8" },
      { id: "powerSupport", label: "Power support", targets: [target("trunk_base", "power_support.stl")], color: "#8B8B90" },
      { id: "pcbLocker", label: "PCB locking clip", targets: [target("trunk_base", "banana_pcb_locker.stl")], color: "#1D1D1F" },
      { id: "leftHip", label: "Left hip cover", targets: [target("hip_l", "hip_l.stl")], color: "#8B8B90" },
      { id: "rightHip", label: "Right hip cover", targets: [target("hip_l_2", "hip_l.stl")], color: "#8B8B90" },
    ],
  },
  {
    label: "Joints",
    parts: [
      { id: "neckFront", label: "Front neck link", targets: [target("neck", "neck.stl", 1)], color: "#8B8B90" },
      { id: "neckRear", label: "Rear neck link", targets: [target("neck", "neck.stl", 2)], color: "#8B8B90" },
      { id: "neckPitch", label: "Neck pitch link", targets: [target("neck_pitch", "neck_pitch.stl")], color: "#8B8B90" },
      { id: "headJoint", label: "Head joint link", targets: [target("yaw_roll_motion", "yaw_roll_motion.stl")], color: "#8B8B90" },
      { id: "leftYawRoll", label: "Left yaw-roll link", targets: [target("yaw2roll", "yaw2roll.stl")], color: "#1D1D1F" },
      { id: "rightYawRoll", label: "Right yaw-roll link", targets: [target("bearing_roll", "yaw2roll.stl")], color: "#1D1D1F" },
      { id: "leftBearingRetainer", label: "Left bearing retainer", targets: [target("yaw2roll", "bearing_roll.stl")], color: "#1D1D1F" },
      { id: "rightBearingRetainer", label: "Right bearing retainer", targets: [target("bearing_roll", "bearing_roll.stl")], color: "#1D1D1F" },
    ],
  },
  {
    label: "Legs",
    parts: [
      { id: "leftLeg", label: "Left upper leg", targets: [target("upper_leg_left", "upper_leg_left.stl")], color: "#F2EFE8" },
      { id: "rightLeg", label: "Right upper leg", targets: [target("upper_leg_right", "upper_leg_right.stl")], color: "#F2EFE8" },
      { id: "leftRigidity", label: "Left reinforcement", targets: [target("upper_leg_left", "upper_leg_rigidity_plate.stl")], color: "#8B8B90" },
      { id: "rightRigidity", label: "Right reinforcement", targets: [target("upper_leg_right", "upper_leg_rigidity_plate.stl")], color: "#8B8B90" },
      { id: "leftShin", label: "Left shin shell", targets: [target("leg", "leg.stl")], color: "#8B8B90" },
      { id: "rightShin", label: "Right shin shell", targets: [target("leg_2", "leg.stl")], color: "#8B8B90" },
    ],
  },
  {
    label: "Feet",
    parts: [
      { id: "leftAnkle", label: "Left ankle joint", targets: [target("ankle_left", "ankle_left.stl")], color: "#FF7A2F" },
      { id: "rightAnkle", label: "Right ankle joint", targets: [target("ankle_right", "ankle_right.stl")], color: "#FF7A2F" },
      { id: "leftFoot", label: "Left foot shell", targets: [target("ankle_left", "foot_left.stl")], color: "#FF7A2F" },
      { id: "rightFoot", label: "Right foot shell", targets: [target("ankle_right", "foot_right.stl")], color: "#FF7A2F" },
      { id: "leftSole", label: "Left sole pad", targets: [target("ankle_left", "sole_left.stl")], color: "#FFD23F" },
      { id: "rightSole", label: "Right sole pad", targets: [target("ankle_right", "sole_right.stl")], color: "#FFD23F" },
    ],
  },
];

export const PARTS = PART_GROUPS.flatMap((group) => group.parts);
export const PART_BY_ID = Object.fromEntries(PARTS.map((part) => [part.id, part]));
export const PART_BY_TARGET = new Map(PARTS.flatMap((part) => (
  part.targets.map(({ mesh, body, occurrence }) => [meshInstanceKey(mesh, body, occurrence), part])
)));
export const PRINT_MESH_ORDER = PARTS.flatMap((part) => (
  part.targets.map(({ mesh, body, occurrence }) => meshInstanceKey(mesh, body, occurrence))
));
export const DEFAULT_COLORS = Object.fromEntries(PARTS.map((part) => [part.id, part.color]));

export function partForMeshInstance(meshName, bodyName, occurrence) {
  return PART_BY_TARGET.get(meshInstanceKey(meshName, bodyName, occurrence)) ?? null;
}

export function colorOverridesForParts(colors) {
  return Object.fromEntries(PARTS.flatMap((part) => (
    part.targets.map(({ mesh, body, occurrence }) => [
      meshInstanceKey(mesh, body, occurrence),
      colors[part.id],
    ])
  )));
}
