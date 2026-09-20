import { meshInstanceKey } from "../game/mesh-selector.js";

const target = (body, mesh) => ({ body, mesh });

// Every user-printable exterior or soft part in the MJLab walking model.
// Body names matter for mirrored pieces that reuse the same STL file.
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
    ],
  },
  {
    label: "Body",
    parts: [
      { id: "bodyCore", label: "Trunk base", targets: [target("trunk_base", "trunk_base.stl")], color: "#F2EFE8" },
      { id: "bodyLeft", label: "Left body shell", targets: [target("trunk_base", "left_shell.stl")], color: "#F2EFE8" },
      { id: "bodyRight", label: "Right body shell", targets: [target("trunk_base", "right_shell.stl")], color: "#F2EFE8" },
      { id: "leftHip", label: "Left hip cover", targets: [target("hip_l", "hip_l.stl")], color: "#8B8B90" },
      { id: "rightHip", label: "Right hip cover", targets: [target("hip_l_2", "hip_l.stl")], color: "#8B8B90" },
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
  part.targets.map(({ mesh, body }) => [meshInstanceKey(mesh, body), part])
)));
export const PRINT_MESH_ORDER = PARTS.flatMap((part) => (
  part.targets.map(({ mesh, body }) => meshInstanceKey(mesh, body))
));
export const DEFAULT_COLORS = Object.fromEntries(PARTS.map((part) => [part.id, part.color]));

export function partForMeshInstance(meshName, bodyName) {
  return PART_BY_TARGET.get(meshInstanceKey(meshName, bodyName)) ?? null;
}

export function colorOverridesForParts(colors) {
  return Object.fromEntries(PARTS.flatMap((part) => (
    part.targets.map(({ mesh, body }) => [meshInstanceKey(mesh, body), colors[part.id]])
  )));
}
