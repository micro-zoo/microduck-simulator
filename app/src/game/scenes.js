// Runtime-selectable environments. The compact arcade remains the default;
// the dining room is loaded lazily because its textured GLB is much larger
// than the robot and UI assets.

import { ARENA_HALF, SPAWN_X, SPAWN_Y } from "./constants.js";

export const DEFAULT_SCENE = "arcade";

export const SCENES = Object.freeze({
  arcade: Object.freeze({
    id: "arcade",
    label: "Arcade",
    arenaHalf: ARENA_HALF,
    spawn: Object.freeze([SPAWN_X, SPAWN_Y]),
    cameraMaxDistance: 3,
  }),
  dining: Object.freeze({
    id: "dining",
    label: "Dining Room",
    // Matches the 10.4 m square safety arena used by microduck-racer.
    arenaHalf: 5.2,
    spawn: Object.freeze([-4.18, 3.25]),
    cameraMaxDistance: 8,
  }),
});

export const SCENE_IDS = Object.freeze(Object.keys(SCENES));

export const DINING_ROOM_ASSET = "./assets/rooms/dining-room.glb?v=1";

export const DINING_ROOM_ATTRIBUTION = Object.freeze({
  title: "Dining room | Kichen baked",
  creator: "ChristyHsu",
  creatorUrl: "https://sketchfab.com/ida61xq",
  sourceUrl: "https://sketchfab.com/3d-models/dining-room-kichen-baked-4831c2ce6a0044d9bee9eacefcc0f2bd",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
});

const roomBox = (name, pos, size) => Object.freeze({
  name,
  type: "box",
  pos: Object.freeze(pos),
  size: Object.freeze(size),
});

const TABLE_CENTER = [1.791, -0.272];

// Measured collision proxies from the referenced microduck-racer scene.
// They intentionally stay simple boxes: the room mesh is visual-only and
// MuJoCo gets stable, cheap furniture/kitchen/shell collision geometry.
const DINING_ROOM_COLLIDERS = Object.freeze([
  roomBox("room_wall_left", [-4.82, 0, 1.5], [0.1, 4.05, 1.5]),
  roomBox("room_wall_right", [4.82, 0, 1.5], [0.1, 4.05, 1.5]),
  roomBox("room_wall_back", [0, -3.9, 1.5], [4.92, 0.1, 1.5]),
  roomBox("room_kitchen_run", [4.59, -0.075, 1.3], [0.35, 2.9, 1.3]),
  roomBox("room_dining_table", [TABLE_CENTER[0], TABLE_CENTER[1], 0.39], [0.83, 1.33, 0.39]),
  ...[
    [0.637, 0.23],
    [0.637, -0.774],
    [1.777, 1.25],
    [1.742, -1.844],
    [2.967, -0.809],
    [2.967, 0.196],
  ].map(([x, y], index) => roomBox(
    `room_dining_chair_${index + 1}`,
    [x, y, 0.5],
    [0.31, 0.29, 0.5],
  )),
]);

export function diningRoomColliders() {
  return DINING_ROOM_COLLIDERS.map((collider) => ({
    ...collider,
    pos: [...collider.pos],
    size: [...collider.size],
  }));
}

export async function loadDiningRoom({ GLTFLoader, signed, scene }) {
  if (!GLTFLoader || !signed || !scene) {
    throw new Error("loadDiningRoom requires GLTFLoader, signed, and scene");
  }
  const gltf = await new GLTFLoader().loadAsync(signed(DINING_ROOM_ASSET));
  const root = gltf.scene;
  root.name = "dining-room-main-scene";
  root.position.set(0.96, -0.0131, 0.025);
  root.userData.attribution = DINING_ROOM_ATTRIBUTION;
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = true;
    node.frustumCulled = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.emissiveMap) material.emissiveIntensity = 0.32;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.35;
      material.needsUpdate = true;
    }
  });
  root.visible = false;
  scene.add(root);
  root.updateMatrixWorld(true);
  return root;
}
