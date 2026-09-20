// Bambu PLA Basic display colours. Hex values follow Bambu Lab's published
// filament chart; five-digit catalogue colour numbers are included where the
// store exposes them. These are screen/3MF identifiers, not measured Lab data.
export const BAMBU_PLA_BASIC = Object.freeze([
  { name: "Jade White", code: "10100", hex: "#FFFFFF" },
  { name: "Black", code: "10101", hex: "#000000" },
  { name: "Silver", code: "10102", hex: "#A6A9AA" },
  { name: "Gray", code: "10103", hex: "#8E9089" },
  { name: "Light Gray", code: "10104", hex: "#D1D3D5" },
  { name: "Dark Gray", code: "10105", hex: "#545454" },
  { name: "Red", code: "10200", hex: "#C12E1F" },
  { name: "Beige", code: "10201", hex: "#F7E6DE" },
  { name: "Magenta", code: "10202", hex: "#EC008C" },
  { name: "Pink", code: "10203", hex: "#F55A74" },
  { name: "Hot Pink", code: "10204", hex: "#F5547C" },
  { name: "Maroon Red", code: "10205", hex: "#9D2235" },
  { name: "Orange", code: "10300", hex: "#FF6A13" },
  { name: "Pumpkin Orange", code: "10301", hex: "#FF9016" },
  { name: "Yellow", code: "10400", hex: "#F4EE2A" },
  { name: "Gold", code: "10401", hex: "#E4BD68" },
  { name: "Sunflower Yellow", code: "10402", hex: "#FEC600" },
  { name: "Bambu Green", code: "10501", hex: "#00AE42" },
  { name: "Mistletoe Green", code: "10502", hex: "#3F8E43" },
  { name: "Bright Green", code: "10503", hex: "#BECF00" },
  { name: "Blue", code: "10601", hex: "#0A2989" },
  { name: "Cyan", code: "10603", hex: "#0086D6" },
  { name: "Cobalt Blue", code: "10604", hex: "#0056B8" },
  { name: "Turquoise", code: "10605", hex: "#00B1B7" },
  { name: "Purple", code: "10700", hex: "#5E43B7" },
  { name: "Indigo Purple", code: "10701", hex: "#482960" },
  { name: "Blue Gray", code: "10602", hex: "#5B6579" },
  { name: "Brown", code: "10800", hex: "#9D432C" },
  { name: "Bronze", code: "10801", hex: "#847D48" },
  { name: "Cocoa Brown", code: "10802", hex: "#6F5034" },
]);

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function exactBambuColor(hex) {
  const normalized = String(hex).toUpperCase();
  return BAMBU_PLA_BASIC.find((color) => color.hex === normalized) ?? null;
}

export function closestBambuColor(hex) {
  const [r, g, b] = rgb(String(hex).toUpperCase());
  let best = BAMBU_PLA_BASIC[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of BAMBU_PLA_BASIC) {
    const [cr, cg, cb] = rgb(color.hex);
    // Red-mean weighted RGB distance tracks perceived hue better than a
    // plain Euclidean comparison without adding a large colour library.
    const mean = (r + cr) / 2;
    const dr = r - cr;
    const dg = g - cg;
    const db = b - cb;
    const distance = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
    }
  }
  return { ...best, exact: best.hex === String(hex).toUpperCase() };
}

export const bambuLabel = (color) => `${color.code ? `${color.code} · ` : ""}${color.name}`;
