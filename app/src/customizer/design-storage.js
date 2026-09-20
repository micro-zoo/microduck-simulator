export const STUDIO_DESIGN_KEY = "microduck.color-studio.v1";

const validHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function saveStudioDesign({ colors, meshColors }) {
  if (typeof localStorage === "undefined") return null;
  const design = {
    version: 1,
    savedAt: new Date().toISOString(),
    colors: Object.fromEntries(Object.entries(colors).filter(([, value]) => validHex(value))),
    meshColors: Object.fromEntries(Object.entries(meshColors).filter(([, value]) => validHex(value))),
  };
  localStorage.setItem(STUDIO_DESIGN_KEY, JSON.stringify(design));
  return design;
}

export function readStudioDesign() {
  if (typeof localStorage === "undefined") return null;
  try {
    const design = JSON.parse(localStorage.getItem(STUDIO_DESIGN_KEY));
    if (design?.version !== 1 || !design.meshColors || typeof design.meshColors !== "object") return null;
    const meshColors = Object.fromEntries(Object.entries(design.meshColors).filter(([, value]) => validHex(value)));
    if (!Object.keys(meshColors).length) return null;
    return { ...design, meshColors };
  } catch {
    return null;
  }
}

