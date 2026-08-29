// Controls use physical KeyboardEvent.code positions; getLayoutMap() provides
// the characters printed on those keys for the active layout.
const FALLBACK_LABELS = Object.freeze({ KeyW: "W/Z", KeyA: "A/Q", KeyQ: "Q/A" });

const MOVEMENT_CODES = ["KeyW", "KeyA", "KeyS", "KeyD"];
const MOVEMENT_FALLBACK_HINT = "arrows or WASD / ZQSD";

function keycap(value) {
  if (typeof value !== "string") return null;
  const glyph = value.trim();
  if ([...glyph].length !== 1 || /[\p{M}\p{C}\p{Z}]/u.test(glyph)) return null;
  const upper = glyph.toUpperCase();
  return [...upper].length === 1 ? upper : glyph; // "ß" must not become "SS"
}

export function resolveKeycaps(codes, layoutMap) {
  const labels = {};
  const fromLayout = new Set();
  for (const code of new Set([...MOVEMENT_CODES, ...codes])) {
    let label = null;
    try {
      label = keycap(layoutMap?.get?.(code));
    } catch {
      label = null;
    }
    if (label) fromLayout.add(code);
    labels[code] = label ?? FALLBACK_LABELS[code] ?? code.replace(/^Key/, "");
  }
  const moveHint = MOVEMENT_CODES.every((code) => fromLayout.has(code))
    ? `arrows or ${MOVEMENT_CODES.map((code) => labels[code]).join("")}`
    : MOVEMENT_FALLBACK_HINT;
  return { labels, moveHint };
}

export async function readLayoutMap(nav = globalThis.navigator) {
  try {
    return (await nav?.keyboard?.getLayoutMap?.()) ?? null;
  } catch {
    return null;
  }
}
