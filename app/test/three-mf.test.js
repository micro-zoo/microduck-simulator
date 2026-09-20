import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createThreeMf, createThreeMfBundle } from "../src/customizer/three-mf.js";

test("3MF export creates an OPC zip with model geometry and color", () => {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0,
    0.01, 0, 0,
    0, 0.01, 0,
  ], 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#ff7a2f" }));
  mesh.userData.meshName = "sample.stl";
  root.add(mesh);

  const bytes = createThreeMf({ root, selectedPart: "Sample" });
  const binary = Buffer.from(bytes).toString("latin1");

  assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true), 0x04034b50);
  assert.match(binary, /\[Content_Types\]\.xml/);
  assert.match(binary, /3D\/3dmodel\.model/);
  assert.match(binary, /Microduck custom colorway/);
  assert.match(binary, /vertex x="10\.00000"/);
  assert.match(binary, /displaycolor="#FF7A2FFF"/);
  assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(bytes.length - 22, true), 0x06054b50);
});

test("3MF export packages uploaded artwork as a texture resource", () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
  root.add(body);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0.011, -0.005, -0.005,
    0.011, 0.005, -0.005,
    0.011, 0.005, 0.005,
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1], 2));
  const decal = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#ffffff" }));
  const bytes = createThreeMf({
    root,
    decal,
    patternBytes: new Uint8Array([137, 80, 78, 71]),
    selectedPart: "Body shell",
  });
  const binary = Buffer.from(bytes).toString("latin1");

  assert.match(binary, /3D\/Textures\/pattern\.png/);
  assert.match(binary, /3D\/_rels\/3dmodel\.model\.rels/);
  assert.match(binary, /texture2dgroup id="3"/);
  assert.match(binary, /pid="3" p1="0" p2="1" p3="2"/);
  assert.match(binary, /Body shell/);
});

test("3MF export names exact Bambu PLA Basic material colours", () => {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshStandardMaterial({ color: "#ff6a13" })));
  const binary = Buffer.from(createThreeMf({ root })).toString("utf8");

  assert.match(binary, /Bambu PLA Basic · 10300 · Orange/);
  assert.match(binary, /displaycolor="#FF6A13FF"/);
});

test("ZIP bundle includes a complete model and absolutely numbered parts grouped by Bambu colour", () => {
  const root = new THREE.Group();
  const addPart = (meshName, label, color) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.01, 0.01),
      new THREE.MeshStandardMaterial({ color }),
    );
    mesh.userData.meshName = meshName;
    mesh.userData.partLabel = label;
    root.add(mesh);
    return mesh;
  };
  addPart("head.stl", "Head shell", "#ff6a13");
  addPart("hip.stl", "Hip cover", "#000000");
  addPart("hip.stl", "Hip cover", "#000000");

  const bundle = createThreeMfBundle({
    root,
    meshOrder: ["head.stl", "hip.stl", "hip.stl"],
  });
  const binary = Buffer.from(bundle.bytes).toString("latin1");

  assert.equal(bundle.partCount, 3);
  assert.equal(bundle.colorCount, 2);
  assert.deepEqual(bundle.manifest.map((part) => part.absoluteNumber), ["01", "02", "03"]);
  assert.match(binary, /duck-complete\.3mf/);
  assert.match(binary, /parts\.csv/);
  assert.match(binary, /parts\/10300\/duck-01-10300\.3mf/);
  assert.match(binary, /parts\/10101\/duck-02-10101\.3mf/);
  assert.match(binary, /parts\/10101\/duck-03-10101\.3mf/);
  assert.match(binary, /absolute_number,filename,part,source_mesh,bambu_color_code/);
});
