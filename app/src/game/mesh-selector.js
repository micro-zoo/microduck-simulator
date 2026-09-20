export const MESH_INSTANCE_SEPARATOR = "::";

export function meshInstanceKey(meshName, bodyName = "") {
  return bodyName ? `${bodyName}${MESH_INSTANCE_SEPARATOR}${meshName}` : meshName;
}

export function meshNameFromSelector(selector) {
  const separator = selector.indexOf(MESH_INSTANCE_SEPARATOR);
  return separator === -1 ? selector : selector.slice(separator + MESH_INSTANCE_SEPARATOR.length);
}

export function materialForMeshInstance(map, meshName, bodyName, fallback) {
  return map?.[meshInstanceKey(meshName, bodyName)] ?? map?.[meshName] ?? fallback;
}
