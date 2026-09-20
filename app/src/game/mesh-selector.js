export const MESH_INSTANCE_SEPARATOR = "::";

export function meshInstanceKey(meshName, bodyName = "", occurrence = null) {
  if (!bodyName) return meshName;
  const base = `${bodyName}${MESH_INSTANCE_SEPARATOR}${meshName}`;
  return occurrence == null ? base : `${base}${MESH_INSTANCE_SEPARATOR}${occurrence}`;
}

export function meshNameFromSelector(selector) {
  const parts = selector.split(MESH_INSTANCE_SEPARATOR);
  return parts.length === 1 ? selector : parts[1];
}

export function materialForMeshInstance(map, meshName, bodyName, occurrence, fallback) {
  return map?.[meshInstanceKey(meshName, bodyName, occurrence)]
    ?? map?.[meshInstanceKey(meshName, bodyName)]
    ?? map?.[meshName]
    ?? fallback;
}
