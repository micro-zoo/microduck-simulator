// Runtime-selectable environments. The compact arcade remains the default;
// the larger user-supplied room assets are loaded only when selected.

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
    // Converted from the supplied Dining_room__Kichen_baked.usdz.
    arenaHalf: 5.2,
    spawn: Object.freeze([0, 0]),
    cameraMaxDistance: 8,
  }),
  apartment: Object.freeze({
    id: "apartment",
    label: "Apartment",
    arenaHalf: 5.8,
    // Lounge aisle: keeps the entry framing clear of the doorway wall.
    spawn: Object.freeze([-0.24, -2.28]),
    heading: Math.PI,
    cameraDistance: 1.5,
    cameraMaxDistance: 9,
  }),
  loft: Object.freeze({
    id: "loft",
    label: "Loft 13",
    arenaHalf: 4.8,
    // The clear end of the interior; face back toward the furnished space.
    spawn: Object.freeze([4.2, 0.2]),
    heading: Math.PI,
    cameraDistance: 1.25,
    cameraMaxDistance: 8,
  }),
  vintage: Object.freeze({
    id: "vintage",
    label: "Vintage Room",
    // The supplied modular kit is centered and scaled to a compact room.
    arenaHalf: 4.3,
    // The furnished room is the left-side module cluster; the positive-X
    // pieces are disconnected display assets, including the floating rug.
    spawn: Object.freeze([-2.6, 0]),
    heading: -Math.PI / 2,
    cameraDistance: 1.25,
    cameraMaxDistance: 7,
  }),
  backrooms: Object.freeze({
    id: "backrooms",
    label: "Backrooms",
    // The 59 m authored corridor is scaled to a 28 m playable footprint.
    arenaHalf: 14.5,
    spawn: Object.freeze([3.8, 0]),
    cameraMaxDistance: 20,
  }),
});

export const SCENE_IDS = Object.freeze(Object.keys(SCENES));

// v=2 replaces the legacy dining-room GLB with the supplied USDZ conversion.
export const DINING_ROOM_ASSET = "./assets/rooms/dining-room.glb?v=2";
export const APARTMENT_ASSET = "./assets/rooms/apartment.glb?v=1";
export const LOFT_ASSET = "./assets/rooms/loft-13.glb?v=1";
export const VINTAGE_ROOM_ASSET = "./assets/rooms/vintage-living-room.glb?v=1";
export const BACKROOMS_ASSET = "./assets/rooms/backrooms.glb?v=1";

function finishRoom(root, {
  THREE, scene, name, scale = 1, centerAndFloor = false, floorOffset = 0,
}) {
  if (centerAndFloor) {
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    root.scale.setScalar(scale);
    root.position.set(
      -center.x * scale,
      -bounds.min.y * scale - floorOffset,
      -center.z * scale,
    );
  }
  root.name = name;
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

async function loadRoom({
  GLTFLoader, signed, THREE, scene, asset, name, scale, centerAndFloor, floorOffset,
}) {
  if (!GLTFLoader || !signed || !THREE || !scene) {
    throw new Error(`${name} requires GLTFLoader, signed, THREE, and scene`);
  }
  const gltf = await new GLTFLoader().loadAsync(signed(asset));
  return finishRoom(gltf.scene, {
    THREE, scene, name, scale, centerAndFloor, floorOffset,
  });
}

export async function loadDiningRoom({ GLTFLoader, signed, THREE, scene }) {
  return loadRoom({
    GLTFLoader, signed, THREE, scene, asset: DINING_ROOM_ASSET,
    name: "dining-room-main-scene", scale: 1, centerAndFloor: true, floorOffset: 0,
  });
}

export async function loadApartment({ GLTFLoader, signed, THREE, scene }) {
  return loadRoom({
    GLTFLoader, signed, THREE, scene, asset: APARTMENT_ASSET,
    name: "apartment-main-scene", scale: 1, centerAndFloor: true, floorOffset: 0.01,
  });
}

export async function loadLoft({ GLTFLoader, signed, THREE, scene }) {
  return loadRoom({
    GLTFLoader, signed, THREE, scene, asset: LOFT_ASSET,
    name: "loft-main-scene", scale: 1, centerAndFloor: true, floorOffset: 0.08,
  });
}

export async function loadVintageRoom({ GLTFLoader, signed, THREE, scene }) {
  return loadRoom({
    GLTFLoader, signed, THREE, scene, asset: VINTAGE_ROOM_ASSET,
    name: "vintage-room-main-scene", scale: 0.35, centerAndFloor: true, floorOffset: 0,
  });
}

export async function loadBackrooms({ GLTFLoader, signed, THREE, scene }) {
  return loadRoom({
    GLTFLoader, signed, THREE, scene, asset: BACKROOMS_ASSET,
    // Its lowest mesh is not the walking surface; snap the actual floor to
    // the simulation plane after centering the converted asset.
    name: "backrooms-main-scene", scale: 0.48, centerAndFloor: true, floorOffset: 0.4,
  });
}
