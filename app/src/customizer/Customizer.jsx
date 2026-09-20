import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
import { applyPose, buildRig, groundFullBody, loadKinematics, MODEL_DIR } from "../game/duck.js";
import { DEFAULT_POSE, JOINT_NAMES } from "../game/constants.js";
import { materialHookFor, VARIANTS } from "../game/variants.js";
import { signed } from "../game/signed.js";
import { ANTON, COMIC_INK, CREAM, HalftoneRamp } from "../ui/comic.jsx";
import { MONO, ORANGE } from "../theme.js";
import { createThreeMfBundle } from "./three-mf.js";
import { BAMBU_PLA_BASIC, bambuLabel, closestBambuColor, exactBambuColor } from "./bambu-colors.js";
import { saveStudioDesign } from "./design-storage.js";

const PART_GROUPS = [
  {
    label: "Head",
    parts: [
      { id: "head", label: "Head shell", meshes: ["top_head_shell.stl"], color: "#F2EFE8" },
      { id: "headBand", label: "Head band", meshes: ["bottom_head_shell.stl"], color: "#FF7A2F" },
      { id: "face", label: "Face plate", meshes: ["face_part.stl"], color: "#9B9892" },
      { id: "eye", label: "Eye ring", meshes: ["noenoeil.stl"], color: "#FFB52E" },
      { id: "beak", label: "Beak", meshes: ["soft_mouth_top.stl", "jaw.stl", "jaw_soft.stl"], color: "#FF7A2F" },
    ],
  },
  {
    label: "Body",
    parts: [
      { id: "body", label: "Body shell", meshes: ["trunk_base.stl", "left_shell.stl", "right_shell.stl"], color: "#F2EFE8" },
      { id: "hips", label: "Hip covers", meshes: ["hip_l.stl"], color: "#8B8B90" },
    ],
  },
  {
    label: "Legs",
    parts: [
      { id: "leftLeg", label: "Left leg shell", meshes: ["upper_leg_left.stl"], color: "#F2EFE8" },
      { id: "rightLeg", label: "Right leg shell", meshes: ["upper_leg_right.stl"], color: "#F2EFE8" },
    ],
  },
  {
    label: "Feet",
    parts: [
      { id: "leftFoot", label: "Left foot", meshes: ["foot_left.stl", "ankle_left.stl"], color: "#FF7A2F" },
      { id: "rightFoot", label: "Right foot", meshes: ["foot_right.stl", "ankle_right.stl"], color: "#FF7A2F" },
      { id: "soles", label: "Sole pads", meshes: ["sole_left.stl", "sole_right.stl"], color: "#FFD23F" },
    ],
  },
];

const PARTS = PART_GROUPS.flatMap((group) => group.parts);
const PART_BY_ID = Object.fromEntries(PARTS.map((part) => [part.id, part]));
const PART_BY_MESH = new Map(PARTS.flatMap((part) => part.meshes.map((mesh) => [mesh, part])));
// hip_l.stl is used by two physical covers. Repeating it reserves two stable
// absolute export numbers instead of numbering whatever traversal finds first.
const PHYSICAL_MESH_COPIES = { "hip_l.stl": 2 };
const PRINT_MESH_ORDER = PARTS.flatMap((part) => part.meshes.flatMap((mesh) => (
  Array.from({ length: PHYSICAL_MESH_COPIES[mesh] ?? 1 }, () => mesh)
)));
const DEFAULT_COLORS = Object.fromEntries(PARTS.map((part) => [part.id, part.color]));

const QUICK_BAMBU_NAMES = new Set([
  "Jade White", "Silver", "Gray", "Black", "Orange", "Yellow",
  "Cyan", "Blue", "Purple", "Pink", "Bambu Green", "Brown",
]);
const QUICK_BAMBU = BAMBU_PLA_BASIC.filter((color) => QUICK_BAMBU_NAMES.has(color.name));

const PRESETS = [
  {
    id: "classic",
    label: "Creamsicle",
    stripe: ["#F2EFE8", "#FF7A2F", "#FFD23F"],
    colors: { ...DEFAULT_COLORS },
  },
  {
    id: "graphite",
    label: "After hours",
    stripe: ["#2F2F33", "#FFD23F", "#BFA9CF"],
    colors: { ...DEFAULT_COLORS, head: "#2F2F33", body: "#232326", leftLeg: "#232326", rightLeg: "#232326", headBand: "#FFD23F", beak: "#FFD23F", leftFoot: "#FFD23F", rightFoot: "#FFD23F", eye: "#BFA9CF", soles: "#8068B0" },
  },
  {
    id: "lavender",
    label: "Ultraviolet",
    stripe: ["#B4A4D4", "#FFD23F", "#8068B0"],
    colors: { ...DEFAULT_COLORS, head: "#B4A4D4", body: "#B4A4D4", leftLeg: "#B4A4D4", rightLeg: "#B4A4D4", headBand: "#FFD23F", beak: "#FFD23F", leftFoot: "#FFD23F", rightFoot: "#FFD23F", eye: "#A8DCE8", soles: "#8068B0" },
  },
  {
    id: "sky",
    label: "Poolside",
    stripe: ["#A8DCE8", "#FF7A2F", "#FFD23F"],
    colors: { ...DEFAULT_COLORS, head: "#A8DCE8", body: "#A8DCE8", leftLeg: "#A8DCE8", rightLeg: "#A8DCE8" },
  },
];

const standPose = Object.fromEntries(JOINT_NAMES.map((name, index) => [name, DEFAULT_POSE[index]]));

function Icon({ type }) {
  const paths = {
    home: <><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    minus: <path d="M5 12h14"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 14v5h14v-5"/></>,
    shuffle: <><path d="M4 7h3c5 0 5 10 10 10h3"/><path d="m17 14 3 3-3 3"/><path d="M4 17h3c2 0 3.2-1.5 4.3-3.3"/><path d="M14 7h3l3-3"/><path d="m17 4 3 3-3 3"/></>,
    play: <path d="m8 5 11 7-11 7Z"/>,
  };
  return (
    <Box component="svg" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter" sx={{ width: 18, height: 18, display: "block" }}>
      {paths[type]}
    </Box>
  );
}

function OrbitCamera({ action }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef(null);

  useEffect(() => {
    camera.position.set(0.5, 0.31, 0.52);
    const controls = new OrbitControls(camera, gl.domElement);
    const mobilePointer = window.matchMedia("(max-width: 899px) and (pointer: coarse)");
    const previousTouchAction = gl.domElement.style.touchAction;
    const configureTouch = () => {
      controls.enabled = !mobilePointer.matches;
      gl.domElement.style.touchAction = mobilePointer.matches ? "pan-y" : "none";
    };
    controls.target.set(0, 0.13, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 1.25;
    controls.enablePan = false;
    configureTouch();
    if (mobilePointer.addEventListener) mobilePointer.addEventListener("change", configureTouch);
    else mobilePointer.addListener?.(configureTouch);
    controls.update();
    controlsRef.current = controls;
    return () => {
      if (mobilePointer.removeEventListener) mobilePointer.removeEventListener("change", configureTouch);
      else mobilePointer.removeListener?.(configureTouch);
      gl.domElement.style.touchAction = previousTouchAction;
      controls.dispose();
    };
  }, [camera, gl]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !action?.seq) return;
    if (action.type === "home") {
      camera.position.set(0.5, 0.31, 0.52);
      controls.target.set(0, 0.13, 0);
    } else {
      const factor = action.type === "in" ? 0.84 : 1.18;
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
    }
    controls.update();
  }, [action, camera]);

  useFrame(() => controlsRef.current?.update());
  return null;
}

function StudioModel({ colors, selectedId, pattern, exportRef, onReady, onError, onSelect }) {
  const [rig, setRig] = useState(null);
  const [decal, setDecal] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      loadKinematics(`${MODEL_DIR}/kinematics.json`),
    ])
      .then(async ([kinematics]) => {
        const built = await buildRig(kinematics, {
          materialForMesh: materialHookFor(VARIANTS.classic),
          inkEdges: { color: 0x101018, opacity: 0.26, threshold: 48 },
        });
        applyPose(built, standPose);
        groundFullBody(built, 0);
        built.placer.rotation.y = -0.24;
        if (!live) return;
        setRig(built);
        exportRef.current.root = built.placer;
        onReady();
      })
      .catch((error) => live && onError(error));
    return () => {
      live = false;
      exportRef.current.root = null;
    };
  }, [exportRef, onError, onReady]);

  useLayoutEffect(() => {
    if (!rig) return;
    const transitions = [];
    rig.placer.traverse((object) => {
      if (!object.isMesh || !object.userData.meshName) return;
      const part = PART_BY_MESH.get(object.userData.meshName);
      if (!part) return;
      if (!object.userData.studioMaterial) {
        object.material = object.material.clone();
        object.userData.studioMaterial = true;
        object.userData.partLabel = part.label;
      }
      const target = new THREE.Color(colors[part.id]);
      if (!object.userData.studioColorReady) {
        object.material.color.copy(target);
        object.userData.studioColorReady = true;
      } else if (!object.material.color.equals(target)) {
        transitions.push({ material: object.material, from: object.material.color.clone(), to: target });
      }
      object.material.roughness = 0.42;
      object.material.metalness = 0.02;
      object.material.emissive.set(part.id === selectedId ? ORANGE : "#000000");
      object.material.emissiveIntensity = part.id === selectedId ? 0.1 : 0;
    });
    if (!transitions.length) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / 150);
      const eased = 1 - Math.pow(1 - t, 3);
      for (const transition of transitions) {
        transition.material.color.lerpColors(transition.from, transition.to, eased);
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [colors, rig, selectedId]);

  useEffect(() => {
    if (!rig || !pattern?.image) {
      setDecal(null);
      exportRef.current.decal = null;
      return;
    }
    rig.placer.updateWorldMatrix(true, true);
    const part = PART_BY_ID[selectedId];
    let target = null;
    rig.placer.traverse((object) => {
      if (!target && object.isMesh && part.meshes.includes(object.userData.meshName)) target = object;
    });
    if (!target) return;

    target.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3().setFromObject(target);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const position = center.clone();
    position.x = bounds.max.x + 0.0006;
    const decalSize = new THREE.Vector3(
      Math.max(0.009, Math.min(0.045, size.z * 0.72)),
      Math.max(0.009, Math.min(0.045, size.y * 0.72)),
      Math.max(0.012, size.x * 1.2),
    );
    const geometry = new DecalGeometry(target, position, new THREE.Euler(0, Math.PI / 2, 0), decalSize);
    if (!geometry.getAttribute("position")?.count) return;
    const texture = new THREE.Texture(pattern.image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.52,
      metalness: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    const nextDecal = new THREE.Mesh(geometry, material);
    nextDecal.name = "Custom pattern";
    nextDecal.userData.targetMesh = target;
    nextDecal.renderOrder = 4;
    setDecal(nextDecal);
    exportRef.current.decal = nextDecal;
    return () => {
      exportRef.current.decal = null;
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [exportRef, pattern, rig, selectedId]);

  if (!rig) return null;
  const selectClickedPart = (event) => {
    if (event.delta > 5) return;
    const part = PART_BY_MESH.get(event.object?.userData?.meshName);
    if (!part) return;
    event.stopPropagation();
    onSelect(part.id);
  };
  return (
    <>
      <primitive object={rig.placer} onClick={selectClickedPart} />
      {decal ? <primitive object={decal} /> : null}
    </>
  );
}

const panelSx = {
  background: "#111118",
  borderColor: "rgba(255,255,255,0.1)",
  color: CREAM,
};

const eyebrowSx = {
  fontFamily: MONO,
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.48)",
};

const smallButtonSx = {
  appearance: "none",
  border: `2px solid ${COMIC_INK}`,
  borderRadius: 0,
  background: CREAM,
  color: COMIC_INK,
  minHeight: 40,
  px: "0.9rem",
  fontFamily: ANTON,
  fontSize: "0.8rem",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: `4px 4px 0 ${ORANGE}`,
  transition: "transform 120ms ease, box-shadow 120ms ease",
  "&:hover": { transform: "translate(-1px,-1px)", boxShadow: `6px 6px 0 ${ORANGE}` },
  "&:active": { transform: "translate(4px,4px)", boxShadow: "none" },
  "&:focus-visible": { outline: `3px dashed ${CREAM}`, outlineOffset: 4 },
};

function PartRail({ selectedId, colors, onSelect }) {
  return (
    <Box component="aside" sx={{ ...panelSx, gridArea: "parts", borderRight: "1px solid", overflowY: "auto", p: "1.6rem 1.15rem 2.5rem", minWidth: 0 }}>
      <Typography sx={eyebrowSx}>01 / Select a part</Typography>
      <Typography component="h1" sx={{ mt: 1, fontFamily: ANTON, fontSize: "1.9rem", lineHeight: 1, textTransform: "uppercase", color: CREAM }}>
        Start with a shell.
      </Typography>
      <Typography sx={{ mt: 1, fontSize: "0.88rem", lineHeight: 1.5, color: "rgba(255,255,255,0.53)" }}>
        Pick a printed part, then make it yours.
      </Typography>

      {PART_GROUPS.map((group) => (
        <Box key={group.label} sx={{ mt: "1.55rem" }}>
          <Typography sx={{ ...eyebrowSx, color: "rgba(255,255,255,0.34)" }}>{group.label}</Typography>
          <Box sx={{ mt: "0.45rem", display: "grid", gap: "0.28rem" }}>
            {group.parts.map((part) => {
              const selected = part.id === selectedId;
              return (
                <Box
                  component="button"
                  type="button"
                  key={part.id}
                  onClick={() => onSelect(part.id)}
                  aria-pressed={selected}
                  sx={{
                    appearance: "none",
                    width: "100%",
                    minHeight: 42,
                    px: "0.7rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    border: "1px solid",
                    borderColor: selected ? COMIC_INK : "transparent",
                    borderRadius: 0,
                    background: selected ? CREAM : "transparent",
                    color: selected ? COMIC_INK : "rgba(255,255,255,0.76)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "0.85rem",
                    fontWeight: selected ? 750 : 550,
                    transition: "background 120ms ease, color 120ms ease",
                    "&:hover": { background: selected ? CREAM : "rgba(255,255,255,0.055)" },
                    "&:focus-visible": { outline: `2px dashed ${ORANGE}`, outlineOffset: -2 },
                  }}
                >
                  <Box sx={{ width: 14, height: 14, flex: "0 0 auto", background: colors[part.id], border: `1px solid ${selected ? COMIC_INK : "rgba(255,255,255,0.4)"}` }} />
                  <Box component="span" sx={{ flex: 1 }}>{part.label}</Box>
                  <Box component="span" aria-hidden sx={{ fontFamily: MONO, fontSize: "0.9rem", color: selected ? ORANGE : "rgba(255,255,255,0.24)" }}>→</Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function CanvasPanel({ colors, selectedId, pattern, exportRef, action, loading, error, onReady, onError, onView, onSelect }) {
  return (
    <Box component="main" sx={{ gridArea: "preview", position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", background: "#0b0b10" }}>
      <HalftoneRamp color="rgba(255, 122, 47, 0.09)" size={22} corner="bottom-left" reach={72} />
      <Typography aria-hidden sx={{ position: "absolute", zIndex: 0, left: { xs: 18, md: 34 }, top: { xs: 24, md: 36 }, fontFamily: ANTON, fontSize: "clamp(3.4rem, 8vw, 7rem)", lineHeight: 0.82, color: "rgba(255,255,255,0.035)", textTransform: "uppercase", whiteSpace: "pre-line", userSelect: "none" }}>
        {"MAKE IT\nYOURS."}
      </Typography>
      <Box sx={{ position: "absolute", zIndex: 2, top: 20, left: 22, px: "0.65rem", py: "0.35rem", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(8,8,12,0.72)", fontFamily: MONO, fontSize: "0.64rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.56)" }}>
        Live 3D preview
      </Box>

      <Canvas camera={{ fov: 34, near: 0.01, far: 50 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} style={{ position: "absolute", inset: 0 }}>
        <ambientLight intensity={1.45} />
        <hemisphereLight color="#fff8eb" groundColor="#1c1823" intensity={1.25} />
        <directionalLight color="#fff0d6" position={[1.5, 2.2, 1.8]} intensity={2.6} />
        <directionalLight color={ORANGE} position={[-1.2, 0.8, -1.2]} intensity={1.15} />
        <StudioModel colors={colors} selectedId={selectedId} pattern={pattern} exportRef={exportRef} onReady={onReady} onError={onError} onSelect={onSelect} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
          <circleGeometry args={[0.38, 96]} />
          <meshStandardMaterial color="#101018" roughness={0.94} transparent opacity={0.66} />
        </mesh>
        <gridHelper args={[1.4, 28, "#34251f", "#191820"]} position={[0, 0, 0]} />
        <OrbitCamera action={action} />
      </Canvas>

      {(loading || error) && (
        <Box sx={{ position: "absolute", zIndex: 4, inset: 0, display: "grid", placeItems: "center", background: "rgba(8,8,12,0.78)" }}>
          <Box sx={{ textAlign: "center" }}>
            {loading ? <CircularProgress size={28} sx={{ color: ORANGE }} /> : null}
            <Typography sx={{ mt: 1.2, fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: error ? "#ff9d8d" : CREAM }}>
              {error || "Loading print geometry"}
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ position: "absolute", zIndex: 5, right: 22, bottom: 22, display: "grid", border: `2px solid ${COMIC_INK}`, boxShadow: `4px 4px 0 ${ORANGE}` }}>
        {[
          ["home", "home", "Reset view"],
          ["plus", "in", "Zoom in"],
          ["minus", "out", "Zoom out"],
        ].map(([icon, type, label]) => (
          <Box key={type} component="button" type="button" aria-label={label} onClick={() => onView(type)} sx={{ appearance: "none", width: 42, height: 42, display: "grid", placeItems: "center", border: "none", borderBottom: type === "out" ? "none" : "1px solid rgba(16,16,24,0.16)", background: CREAM, color: COMIC_INK, cursor: "pointer", "&:hover": { background: ORANGE }, "&:focus-visible": { outline: `3px dashed ${ORANGE}`, outlineOffset: -5 } }}>
            <Icon type={icon} />
          </Box>
        ))}
      </Box>
      <Typography sx={{ position: "absolute", zIndex: 2, left: 22, bottom: 20, fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.34)" }}>
        DRAG TO ORBIT · SCROLL TO ZOOM
      </Typography>
    </Box>
  );
}

function ControlRail({ selectedId, colors, tab, setTab, pattern, onColor, onPreset, onRandom, onPattern }) {
  const selected = PART_BY_ID[selectedId];
  const bambuMatch = closestBambuColor(colors[selectedId]);
  const exactBambu = exactBambuColor(colors[selectedId]);
  const inputRef = useRef(null);
  const [hexDraft, setHexDraft] = useState(colors[selectedId]);

  useEffect(() => setHexDraft(colors[selectedId]), [colors, selectedId]);

  const commitHex = () => {
    const value = hexDraft.trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(value)) onColor(value);
    else setHexDraft(colors[selectedId]);
  };

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.src = sourceUrl;
    await image.decode();
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const normalizedUrl = URL.createObjectURL(blob);
    const normalizedImage = new Image();
    normalizedImage.src = normalizedUrl;
    await normalizedImage.decode();
    URL.revokeObjectURL(sourceUrl);
    onPattern({ name: file.name, url: normalizedUrl, image: normalizedImage, bytes: new Uint8Array(await blob.arrayBuffer()) });
  };

  return (
    <Box component="aside" sx={{ ...panelSx, gridArea: "controls", borderLeft: "1px solid", overflowY: "auto", p: "1.6rem 1.35rem 2.5rem", minWidth: 0 }}>
      <Typography sx={eyebrowSx}>02 / Make it yours</Typography>
      <Box role="tablist" aria-label="Customization mode" sx={{ mt: "1rem", p: "0.25rem", display: "grid", gridTemplateColumns: "1fr 1fr", background: "#1a1a22", border: "1px solid rgba(255,255,255,0.08)" }}>
        {[['color', 'Color'], ['pattern', 'Pattern']].map(([id, label]) => (
          <Box component="button" type="button" role="tab" aria-selected={tab === id} key={id} onClick={() => setTab(id)} sx={{ appearance: "none", border: 0, minHeight: 40, background: tab === id ? CREAM : "transparent", color: tab === id ? COMIC_INK : "rgba(255,255,255,0.5)", fontFamily: ANTON, fontSize: "0.82rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
            {label}
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: "1.45rem", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
        <Typography component="h2" sx={{ fontFamily: ANTON, fontSize: "1.35rem", textTransform: "uppercase", color: CREAM }}>{selected.label}</Typography>
        <Typography sx={{ ...eyebrowSx, color: ORANGE }}>Selected</Typography>
      </Box>

      {tab === "color" ? (
        <>
          <Box sx={{ mt: "0.9rem", height: 118, position: "relative", display: "flex", alignItems: "flex-end", p: "0.9rem", background: colors[selectedId], border: `3px solid ${COMIC_INK}`, boxShadow: "6px 6px 0 rgba(255,255,255,0.12)", color: new THREE.Color(colors[selectedId]).getHSL({}).l > 0.48 ? COMIC_INK : CREAM }}>
            <Typography sx={{ fontFamily: MONO, fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(250,248,242,0.78)", color: COMIC_INK, px: "0.45rem", py: "0.25rem" }}>Click to tune ↓</Typography>
            <Box component="input" type="color" aria-label={`Choose ${selected.label} color`} value={colors[selectedId]} onChange={(event) => onColor(event.target.value.toUpperCase())} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
          </Box>

          <Typography sx={{ ...eyebrowSx, mt: "1.45rem", mb: "0.5rem" }}>Color code</Typography>
          <Box sx={{ display: "flex", alignItems: "center", minHeight: 46, border: "1px solid rgba(255,255,255,0.14)", background: "#0c0c11" }}>
            <Typography sx={{ pl: "0.8rem", fontFamily: MONO, fontSize: "0.66rem", color: "rgba(255,255,255,0.34)" }}>HEX</Typography>
            <Box component="input" value={hexDraft} onChange={(event) => setHexDraft(event.target.value)} onBlur={commitHex} onKeyDown={(event) => event.key === "Enter" && commitHex()} aria-label="Hex color code" sx={{ minWidth: 0, flex: 1, border: 0, outline: 0, background: "transparent", color: CREAM, p: "0.75rem 0.65rem", fontFamily: MONO, fontWeight: 700, fontSize: "0.8rem" }} />
            <Box sx={{ width: 18, height: 18, mr: "0.8rem", background: colors[selectedId], border: "1px solid rgba(255,255,255,0.42)" }} />
          </Box>

          <Box sx={{ mt: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={eyebrowSx}>Bambu PLA Basic</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: exactBambu ? ORANGE : "rgba(255,255,255,0.42)" }}>{exactBambu ? "Exact match" : "Closest match"}</Typography>
          </Box>
          <Box component="select" aria-label="Bambu PLA Basic color" value={exactBambu?.hex ?? ""} onChange={(event) => event.target.value && onColor(event.target.value)} sx={{ mt: "0.65rem", width: "100%", minHeight: 44, px: "0.7rem", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 0, background: "#0c0c11", color: CREAM, fontFamily: MONO, fontSize: "0.72rem", cursor: "pointer", "& option": { color: COMIC_INK, background: CREAM } }}>
            {!exactBambu ? <option value="">Custom · closest {bambuLabel(bambuMatch)}</option> : null}
            {BAMBU_PLA_BASIC.map((color) => <option key={color.name} value={color.hex}>{bambuLabel(color)} · {color.hex}</option>)}
          </Box>
          <Box sx={{ mt: "0.65rem", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.55rem" }}>
            {QUICK_BAMBU.map((swatch) => (
              <Box component="button" type="button" key={swatch.name} title={`${bambuLabel(swatch)} · ${swatch.hex}`} aria-label={`Use Bambu ${bambuLabel(swatch)}`} onClick={() => onColor(swatch.hex)} sx={{ appearance: "none", aspectRatio: "1", minWidth: 0, border: colors[selectedId] === swatch.hex ? `3px solid ${CREAM}` : "2px solid rgba(255,255,255,0.18)", outline: colors[selectedId] === swatch.hex ? `2px solid ${ORANGE}` : "none", outlineOffset: 2, borderRadius: "50%", background: swatch.hex, cursor: "pointer" }} />
            ))}
          </Box>
          <Typography sx={{ mt: 0.75, fontFamily: MONO, fontSize: "0.64rem", color: "rgba(255,255,255,0.42)" }}>
            {bambuLabel(bambuMatch)} · {bambuMatch.hex}
          </Typography>
        </>
      ) : (
        <Box sx={{ mt: "1rem" }}>
          <Box onClick={() => inputRef.current?.click()} sx={{ minHeight: 176, p: "1rem", display: "grid", placeItems: "center", textAlign: "center", border: `2px dashed ${pattern ? ORANGE : "rgba(255,255,255,0.2)"}`, background: pattern ? `center / contain no-repeat url(${pattern.url}) #0b0b10` : "#0b0b10", cursor: "pointer" }}>
            {!pattern ? (
              <Box>
                <Box sx={{ display: "grid", placeItems: "center", width: 44, height: 44, mx: "auto", mb: 1, color: ORANGE, border: `2px solid ${ORANGE}` }}><Icon type="upload" /></Box>
                <Typography sx={{ fontFamily: ANTON, fontSize: "0.95rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>Upload artwork</Typography>
                <Typography sx={{ mt: 0.5, fontSize: "0.75rem", lineHeight: 1.5, color: "rgba(255,255,255,0.42)" }}>PNG, JPG or WEBP · max side normalized to 512 px</Typography>
              </Box>
            ) : (
              <Typography sx={{ alignSelf: "end", px: "0.45rem", py: "0.25rem", background: "rgba(8,8,12,0.76)", fontFamily: MONO, fontSize: "0.65rem", color: CREAM }}>{pattern.name}</Typography>
            )}
          </Box>
          <Box component="input" ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
          <Typography sx={{ mt: 1, fontSize: "0.72rem", lineHeight: 1.5, color: "rgba(255,255,255,0.4)" }}>
            The artwork is projected onto the selected part and embedded in the exported 3MF.
          </Typography>
          {pattern ? <Box component="button" type="button" onClick={() => onPattern(null)} sx={{ mt: 1.2, ...smallButtonSx, width: "100%", background: "transparent", color: CREAM, borderColor: "rgba(255,255,255,0.35)", boxShadow: "none" }}>Remove pattern</Box> : null}
        </Box>
      )}

      <Box sx={{ mt: "1.7rem", pt: "1.35rem", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={eyebrowSx}>Colorways</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.34)" }}>Apply all</Typography>
        </Box>
        <Box sx={{ mt: "0.7rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
          {PRESETS.map((preset) => (
            <Box component="button" type="button" key={preset.id} onClick={() => onPreset(preset.colors)} sx={{ appearance: "none", minWidth: 0, p: "0.55rem", border: "1px solid rgba(255,255,255,0.12)", background: "#0c0c11", color: CREAM, cursor: "pointer", textAlign: "left", "&:hover": { borderColor: ORANGE } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", height: 15 }}>{preset.stripe.map((color) => <Box key={color} sx={{ background: color }} />)}</Box>
              <Typography sx={{ mt: 0.55, fontFamily: MONO, fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase" }}>{preset.label}</Typography>
            </Box>
          ))}
        </Box>
        <Box component="button" type="button" onClick={onRandom} sx={{ mt: "0.8rem", ...smallButtonSx, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.55rem" }}>
          <Icon type="shuffle" /> Random colorway
        </Box>
      </Box>
    </Box>
  );
}

export default function Customizer() {
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [selectedId, setSelectedId] = useState("head");
  const [tab, setTab] = useState("color");
  const [pattern, setPattern] = useState(null);
  const [viewAction, setViewAction] = useState({ seq: 0, type: "home" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const exportRef = useRef({ root: null, decal: null });
  const ready = useMemo(() => !loading && !loadError, [loading, loadError]);
  const meshColors = useMemo(() => Object.fromEntries(PARTS.flatMap((part) => part.meshes.map((mesh) => [mesh, colors[part.id]]))), [colors]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Microduck Color Studio";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyOverscroll = document.body.style.overscrollBehaviorY;
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    document.body.style.overscrollBehaviorY = "contain";
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.overscrollBehaviorY = bodyOverscroll;
    };
  }, []);

  useEffect(() => () => {
    if (pattern?.url) URL.revokeObjectURL(pattern.url);
  }, [pattern]);

  const handleModelReady = useCallback(() => setLoading(false), []);
  const handleModelError = useCallback((error) => {
    setLoading(false);
    setLoadError(error?.message || "Unable to load the model");
  }, []);

  useEffect(() => {
    saveStudioDesign({ colors, meshColors });
  }, [colors, meshColors]);

  const setSelectedColor = (color) => setColors((current) => ({ ...current, [selectedId]: color.toUpperCase() }));
  const selectPattern = (next) => {
    if (pattern?.url) URL.revokeObjectURL(pattern.url);
    setPattern(next);
  };

  const randomize = () => {
    const pool = BAMBU_PLA_BASIC.map((color) => color.hex);
    setColors(Object.fromEntries(PARTS.map((part) => [part.id, pool[Math.floor(Math.random() * pool.length)]])));
  };

  const runInSimulator = () => {
    saveStudioDesign({ colors, meshColors });
    location.href = "./?boot=1&design=custom";
  };

  const exportDesign = async () => {
    if (!ready || exporting) return;
    setExporting(true);
    setNotice("Packaging full-resolution geometry…");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const bundle = createThreeMfBundle({
        root: exportRef.current.root,
        decal: exportRef.current.decal,
        patternBytes: pattern?.bytes,
        selectedPart: PART_BY_ID[selectedId].label,
        meshOrder: PRINT_MESH_ORDER,
      });
      const blob = new Blob([bundle.bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `microduck-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`${bundle.partCount} parts · ${bundle.colorCount} colors · ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (error) {
      setNotice(error?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", height: { xs: "auto", md: "100dvh" }, overflow: { xs: "visible", md: "hidden" }, WebkitOverflowScrolling: "touch", background: "#08080c", color: CREAM }}>
      <Box component="header" sx={{ position: "relative", zIndex: 10, height: 66, display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 }, px: { xs: 1.2, sm: 2.2 }, borderBottom: "1px solid rgba(255,255,255,0.1)", background: "#0b0b10" }}>
        <Box component="a" href="./" aria-label="Back to Microduck simulator" sx={{ display: "flex", alignItems: "center", gap: 1, color: CREAM, textDecoration: "none" }}>
          <Box component="img" src={signed("./assets/duck-head-mark.webp")} alt="" sx={{ width: 38, height: 30, objectFit: "contain", filter: "drop-shadow(2px 2px 0 rgba(0,0,0,.5))" }} />
          <Typography sx={{ display: { xs: "none", sm: "block" }, fontFamily: ANTON, fontSize: "1.2rem", letterSpacing: "0.025em", textTransform: "uppercase" }}>Microduck</Typography>
        </Box>
        <Box sx={{ width: 1, height: 24, background: "rgba(255,255,255,0.16)" }} />
        <Typography sx={{ fontFamily: MONO, fontSize: { xs: "0.66rem", sm: "0.72rem" }, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)" }}>Color Studio</Typography>
        <Typography sx={{ display: { xs: "none", lg: "block" }, ml: "auto", mr: "auto", fontSize: "0.78rem", color: "rgba(255,255,255,0.34)" }}>Make the hardware unmistakably yours.</Typography>
        <Box component="button" type="button" aria-label="Run this design in the simulator" disabled={!ready} onClick={runInSimulator} sx={{ ml: { xs: "auto", lg: 0 }, ...smallButtonSx, minHeight: 42, display: "flex", alignItems: "center", gap: "0.45rem", background: CREAM, boxShadow: `4px 4px 0 ${ORANGE}`, opacity: !ready ? 0.55 : 1 }}>
          <Icon type="play" />
          <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Run design</Box>
        </Box>
        <Box component="button" type="button" aria-label={exporting ? "Building 3MF ZIP package" : "Export 3MF ZIP package"} disabled={!ready || exporting} onClick={exportDesign} sx={{ ...smallButtonSx, minHeight: 42, display: "flex", alignItems: "center", gap: "0.5rem", background: ORANGE, boxShadow: `4px 4px 0 ${CREAM}`, opacity: !ready ? 0.55 : 1, "&:disabled": { cursor: "wait" } }}>
          {exporting ? <CircularProgress size={16} sx={{ color: COMIC_INK }} /> : null}
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{exporting ? "Building" : "Export ZIP"}</Box>
          <Icon type="arrow" />
        </Box>
      </Box>

      <Box sx={{ height: { xs: "auto", md: "calc(100dvh - 66px)" }, display: "grid", gridTemplateAreas: { xs: '"preview" "parts" "controls"', md: '"parts preview controls"' }, gridTemplateColumns: { xs: "1fr", md: "230px minmax(360px,1fr) 300px", xl: "258px minmax(520px,1fr) 348px" }, gridTemplateRows: { xs: "minmax(520px, 68vh) auto auto", md: "1fr" } }}>
        <PartRail selectedId={selectedId} colors={colors} onSelect={setSelectedId} />
        <CanvasPanel colors={colors} selectedId={selectedId} pattern={pattern} exportRef={exportRef} action={viewAction} loading={loading} error={loadError} onReady={handleModelReady} onError={handleModelError} onView={(type) => setViewAction(({ seq }) => ({ seq: seq + 1, type }))} onSelect={setSelectedId} />
        <ControlRail selectedId={selectedId} colors={colors} tab={tab} setTab={setTab} pattern={pattern} onColor={setSelectedColor} onPreset={(next) => setColors({ ...next })} onRandom={randomize} onPattern={selectPattern} />
      </Box>

      {notice ? (
        <Box role="status" sx={{ position: "fixed", zIndex: 30, left: "50%", bottom: 22, transform: "translateX(-50%)", px: "1rem", py: "0.65rem", border: `2px solid ${COMIC_INK}`, background: CREAM, color: COMIC_INK, boxShadow: `5px 5px 0 ${ORANGE}`, fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {notice}
        </Box>
      ) : null}
    </Box>
  );
}
