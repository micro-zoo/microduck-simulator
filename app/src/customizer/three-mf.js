import * as THREE from "three";
import { bambuLabel, closestBambuColor, exactBambuColor } from "./bambu-colors.js";
import { meshInstanceKey, meshNameFromSelector } from "../game/mesh-selector.js";

const encoder = new TextEncoder();

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function colorHex(material, opacityOverride = null) {
  const color = material?.color ?? new THREE.Color("#b9b9bd");
  const alpha = Math.round(255 * (opacityOverride ?? material?.opacity ?? 1))
    .toString(16)
    .padStart(2, "0");
  return `#${color.getHexString(THREE.SRGBColorSpace).toUpperCase()}${alpha.toUpperCase()}`;
}

function geometryRecord(mesh, { textured = false, forceOpaque = false } = {}) {
  const geometry = mesh.geometry;
  const positions = geometry?.getAttribute("position");
  if (!positions || positions.count < 3) return null;

  mesh.updateWorldMatrix(true, false);
  const point = new THREE.Vector3();
  const vertices = [];
  for (let i = 0; i < positions.count; i += 1) {
    point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    // Three.js is Y-up. 3MF slicers conventionally expect Z-up.
    vertices.push([point.x * 1000, -point.z * 1000, point.y * 1000]);
  }

  const index = geometry.index;
  const triangles = [];
  const count = index ? index.count : positions.count;
  for (let i = 0; i + 2 < count; i += 3) {
    triangles.push([
      index ? index.getX(i) : i,
      index ? index.getX(i + 1) : i + 1,
      index ? index.getX(i + 2) : i + 2,
    ]);
  }

  const uv = textured ? geometry.getAttribute("uv") : null;
  const textureCoordinates = [];
  if (uv) {
    for (let i = 0; i < uv.count; i += 1) {
      textureCoordinates.push([uv.getX(i), 1 - uv.getY(i)]);
    }
  }

  return {
    name: mesh.userData.partLabel || mesh.userData.meshName || mesh.name || "Microduck part",
    vertices,
    triangles,
    textureCoordinates,
    color: colorHex(mesh.material, forceOpaque ? 1 : null),
    textured: !!uv,
  };
}

function modelXml({ root, decal, selectedPart, includeMeshes = null }) {
  root.updateWorldMatrix(true, true);
  const records = [];
  root.traverse((object) => {
    if (!object.isMesh || object.visible === false) return;
    if (includeMeshes && !includeMeshes.has(object)) return;
    const record = geometryRecord(object, { forceOpaque: includeMeshes?.has(object) ?? false });
    if (record) records.push(record);
  });

  let decalRecord = null;
  if (decal?.geometry && decal.visible !== false) {
    decalRecord = geometryRecord(decal, { textured: true });
  }

  const colors = [...new Set(records.map((record) => record.color))];
  const colorIndex = new Map(colors.map((color, index) => [color, index]));
  const hasTexture = !!decalRecord?.textured;
  const objectStartId = 10;

  const resources = [
    `<basematerials id="1">${colors
      .map((color, index) => {
        const filament = exactBambuColor(color.slice(0, 7));
        const name = filament ? `Bambu PLA Basic · ${bambuLabel(filament)}` : `Custom color ${index + 1}`;
        return `<base name="${escapeXml(name)}" displaycolor="${color}"/>`;
      })
      .join("")}</basematerials>`,
  ];

  if (hasTexture) {
    resources.push(
      '<m:texture2d id="2" path="/3D/Textures/pattern.png" contenttype="image/png" tilestyleu="clamp" tilestylev="clamp"/>',
      `<m:texture2dgroup id="3" texid="2">${decalRecord.textureCoordinates
        .map(([u, v]) => `<m:tex2coord u="${u.toFixed(6)}" v="${v.toFixed(6)}"/>`)
        .join("")}</m:texture2dgroup>`,
    );
  }

  const objects = [];
  const build = [];
  records.forEach((record, recordIndex) => {
    const id = objectStartId + recordIndex;
    objects.push(
      `<object id="${id}" type="model" name="${escapeXml(record.name)}" pid="1" pindex="${colorIndex.get(record.color)}"><mesh><vertices>${record.vertices
        .map(([x, y, z]) => `<vertex x="${x.toFixed(5)}" y="${y.toFixed(5)}" z="${z.toFixed(5)}"/>`)
        .join("")}</vertices><triangles>${record.triangles
        .map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`)
        .join("")}</triangles></mesh></object>`,
    );
    build.push(`<item objectid="${id}"/>`);
  });

  if (hasTexture) {
    const id = objectStartId + records.length;
    objects.push(
      `<object id="${id}" type="model" name="Custom pattern"><mesh><vertices>${decalRecord.vertices
        .map(([x, y, z]) => `<vertex x="${x.toFixed(5)}" y="${y.toFixed(5)}" z="${z.toFixed(5)}"/>`)
        .join("")}</vertices><triangles>${decalRecord.triangles
        .map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}" pid="3" p1="${a}" p2="${b}" p3="${c}"/>`)
        .join("")}</triangles></mesh></object>`,
    );
    build.push(`<item objectid="${id}"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" requiredextensions="m">
  <metadata name="Title">Microduck custom colorway</metadata>
  <metadata name="Designer">Microduck Color Studio</metadata>
  <metadata name="Description">Full Microduck assembly with per-part colors${hasTexture ? " and a custom texture decal" : ""}.</metadata>
  <metadata name="microduck:selected-part">${escapeXml(selectedPart)}</metadata>
  <resources>${resources.join("")}${objects.join("")}</resources>
  <build>${build.join("")}</build>
</model>`;
}

function contentTypesXml(hasTexture) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  ${hasTexture ? '<Default Extension="png" ContentType="image/png"/>' : ""}
</Types>`;
}

const rootRelationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

const textureRelationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/Textures/pattern.png" Id="rel1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dtexture"/>
</Relationships>`;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function u32(view, offset, value) {
  view.setUint32(offset, value, true);
}

// 3MF is an OPC ZIP package. Stored (uncompressed) entries keep this tiny
// writer dependency-free and are accepted by all common slicers.
function makeZip(entries) {
  const prepared = entries.map(([name, data]) => ({
    name: encoder.encode(name),
    data: typeof data === "string" ? encoder.encode(data) : data,
  }));
  const localSize = prepared.reduce((sum, entry) => sum + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = prepared.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  const centralRecords = [];
  let offset = 0;

  for (const entry of prepared) {
    const checksum = crc32(entry.data);
    const start = offset;
    u32(view, offset, 0x04034b50);
    u16(view, offset + 4, 20);
    u16(view, offset + 6, 0);
    u16(view, offset + 8, 0);
    u16(view, offset + 10, 0);
    u16(view, offset + 12, 0);
    u32(view, offset + 14, checksum);
    u32(view, offset + 18, entry.data.length);
    u32(view, offset + 22, entry.data.length);
    u16(view, offset + 26, entry.name.length);
    u16(view, offset + 28, 0);
    output.set(entry.name, offset + 30);
    output.set(entry.data, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.data.length;
    centralRecords.push({ ...entry, checksum, start });
  }

  const centralOffset = offset;
  for (const entry of centralRecords) {
    u32(view, offset, 0x02014b50);
    u16(view, offset + 4, 20);
    u16(view, offset + 6, 20);
    u16(view, offset + 8, 0);
    u16(view, offset + 10, 0);
    u16(view, offset + 12, 0);
    u16(view, offset + 14, 0);
    u32(view, offset + 16, entry.checksum);
    u32(view, offset + 20, entry.data.length);
    u32(view, offset + 24, entry.data.length);
    u16(view, offset + 28, entry.name.length);
    u16(view, offset + 30, 0);
    u16(view, offset + 32, 0);
    u16(view, offset + 34, 0);
    u16(view, offset + 36, 0);
    u32(view, offset + 38, 0);
    u32(view, offset + 42, entry.start);
    output.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  }

  u32(view, offset, 0x06054b50);
  u16(view, offset + 4, 0);
  u16(view, offset + 6, 0);
  u16(view, offset + 8, prepared.length);
  u16(view, offset + 10, prepared.length);
  u32(view, offset + 12, centralSize);
  u32(view, offset + 16, centralOffset);
  u16(view, offset + 20, 0);
  return output;
}

export function createThreeMf({ root, decal = null, patternBytes = null, selectedPart = "", includeMeshes = null }) {
  if (!root) throw new Error("The model is still loading.");
  const hasTexture = !!(decal && patternBytes?.length);
  const files = [
    ["[Content_Types].xml", contentTypesXml(hasTexture)],
    ["_rels/.rels", rootRelationships],
    ["3D/3dmodel.model", modelXml({ root, decal: hasTexture ? decal : null, selectedPart, includeMeshes })],
  ];
  if (hasTexture) {
    files.push(["3D/_rels/3dmodel.model.rels", textureRelationships]);
    files.push(["3D/Textures/pattern.png", patternBytes]);
  }
  return makeZip(files);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function orderedPrintableMeshes(root, meshOrder) {
  const requestedNames = new Set(meshOrder.map(meshNameFromSelector));
  const foundBySelector = new Map();
  root.traverse((object) => {
    const meshName = object.userData?.meshName;
    if (object.isMesh && object.visible !== false && requestedNames.has(meshName)) {
      const exactSelector = meshInstanceKey(meshName, object.userData?.bodyName);
      const occurrenceSelector = meshInstanceKey(
        meshName,
        object.userData?.bodyName,
        object.userData?.meshOccurrence,
      );
      for (const selector of new Set([occurrenceSelector, exactSelector, meshName])) {
        if (!foundBySelector.has(selector)) foundBySelector.set(selector, []);
        foundBySelector.get(selector).push(object);
      }
    }
  });
  const occurrenceBySelector = new Map();
  return meshOrder.flatMap((selector, absoluteIndex) => {
    const occurrence = occurrenceBySelector.get(selector) ?? 0;
    occurrenceBySelector.set(selector, occurrence + 1);
    const mesh = foundBySelector.get(selector)?.[occurrence];
    const meshName = meshNameFromSelector(selector);
    return mesh ? [{ mesh, meshName, absoluteIndex }] : [];
  });
}

export function createThreeMfBundle({
  root,
  decal = null,
  patternBytes = null,
  selectedPart = "",
  meshOrder = [],
}) {
  if (!root) throw new Error("The model is still loading.");
  if (!meshOrder.length) throw new Error("No printable-part order was supplied.");

  const printable = orderedPrintableMeshes(root, meshOrder);
  if (!printable.length) throw new Error("No printable parts were found.");

  const printableSet = new Set(printable.map(({ mesh }) => mesh));
  const complete = createThreeMf({
    root,
    decal,
    patternBytes,
    selectedPart,
    includeMeshes: printableSet,
  });
  const files = [["duck-complete.3mf", complete]];
  const manifest = [];
  const width = Math.max(2, String(printable.length).length);

  printable.forEach(({ mesh, meshName, absoluteIndex }) => {
    const absoluteNumber = String(absoluteIndex + 1).padStart(width, "0");
    const hex = colorHex(mesh.material, 1).slice(0, 7);
    const filament = exactBambuColor(hex) ?? closestBambuColor(hex);
    const colorCode = filament.code;
    const filename = `duck-${absoluteNumber}-${colorCode}.3mf`;
    const path = `parts/${colorCode}/${filename}`;
    const ownsDecal = decal?.userData?.targetMesh === mesh;
    files.push([
      path,
      createThreeMf({
        root,
        decal: ownsDecal ? decal : null,
        patternBytes: ownsDecal ? patternBytes : null,
        selectedPart: mesh.userData.partLabel || meshName,
        includeMeshes: new Set([mesh]),
      }),
    ]);
    manifest.push({
      absoluteNumber,
      filename,
      path,
      part: mesh.userData.partLabel || meshName,
      sourceMesh: meshName,
      colorCode,
      colorName: filament.name,
      hex,
      exactColor: filament.hex === hex,
    });
  });

  const csv = [
    ["absolute_number", "filename", "part", "source_mesh", "bambu_color_code", "bambu_color_name", "hex", "exact_bambu_color"],
    ...manifest.map((entry) => [
      entry.absoluteNumber,
      entry.filename,
      entry.part,
      entry.sourceMesh,
      entry.colorCode,
      entry.colorName,
      entry.hex,
      entry.exactColor ? "yes" : "nearest",
    ]),
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
  files.splice(1, 0, ["parts.csv", csv]);

  return {
    bytes: makeZip(files),
    manifest,
    partCount: manifest.length,
    colorCount: new Set(manifest.map((entry) => entry.colorCode)).size,
  };
}
