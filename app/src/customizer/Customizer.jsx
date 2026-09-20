import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { applyPose, buildRig, groundFullBody, loadKinematics, MODEL_DIR } from "../game/duck.js";
import { DEFAULT_POSE, JOINT_NAMES } from "../game/constants.js";
import { materialHookFor, VARIANTS } from "../game/variants.js";
import { signed } from "../game/signed.js";
import { ANTON, COMIC_INK, CREAM, HalftoneRamp } from "../ui/comic.jsx";
import { MONO, ORANGE } from "../theme.js";
import { createThreeMfBundle } from "./three-mf.js";
import { BAMBU_PLA_BASIC, bambuLabel, closestBambuColor, exactBambuColor } from "./bambu-colors.js";
import { saveStudioDesign } from "./design-storage.js";
import {
  colorOverridesForParts,
  DEFAULT_COLORS,
  PART_BY_ID,
  PART_GROUPS,
  PARTS,
  partForMeshInstance,
  PRINT_MESH_ORDER,
} from "./studio-parts.js";

const MOBILE_GROUPS = PART_GROUPS.map((group) => ({ ...group, id: group.label.toLowerCase() }));
const MOBILE_GROUP_BY_ID = Object.fromEntries(MOBILE_GROUPS.map((group) => [group.id, group]));
const MOBILE_GROUP_ID_BY_PART = Object.fromEntries(MOBILE_GROUPS.flatMap((group) => group.parts.map((part) => [part.id, group.id])));

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
    colors: { ...DEFAULT_COLORS, head: "#2F2F33", bodyCore: "#232326", bodyLeft: "#232326", bodyRight: "#232326", leftLeg: "#232326", rightLeg: "#232326", headBand: "#FFD23F", jaw: "#FFD23F", leftAnkle: "#FFD23F", rightAnkle: "#FFD23F", leftFoot: "#FFD23F", rightFoot: "#FFD23F", eye: "#BFA9CF", leftSole: "#8068B0", rightSole: "#8068B0" },
  },
  {
    id: "lavender",
    label: "Ultraviolet",
    stripe: ["#B4A4D4", "#FFD23F", "#8068B0"],
    colors: { ...DEFAULT_COLORS, head: "#B4A4D4", bodyCore: "#B4A4D4", bodyLeft: "#B4A4D4", bodyRight: "#B4A4D4", leftLeg: "#B4A4D4", rightLeg: "#B4A4D4", headBand: "#FFD23F", jaw: "#FFD23F", leftAnkle: "#FFD23F", rightAnkle: "#FFD23F", leftFoot: "#FFD23F", rightFoot: "#FFD23F", eye: "#A8DCE8", leftSole: "#8068B0", rightSole: "#8068B0" },
  },
  {
    id: "sky",
    label: "Poolside",
    stripe: ["#A8DCE8", "#FF7A2F", "#FFD23F"],
    colors: { ...DEFAULT_COLORS, head: "#A8DCE8", bodyCore: "#A8DCE8", bodyLeft: "#A8DCE8", bodyRight: "#A8DCE8", leftLeg: "#A8DCE8", rightLeg: "#A8DCE8" },
  },
];

const standPose = Object.fromEntries(JOINT_NAMES.map((name, index) => [name, DEFAULT_POSE[index]]));
const SELECTED_OPACITY_MIN = 0.72;
const SELECTED_OPACITY_MAX = 1;
const SELECTED_BREATHING_SPEED = Math.PI * 1.15;

function Icon({ type }) {
  const paths = {
    home: <><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    minus: <path d="M5 12h14"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
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
    controls.target.set(0, 0.13, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 1.25;
    controls.enablePan = false;
    controls.update();
    controlsRef.current = controls;
    return () => controls.dispose();
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

function StudioModel({ colors, selectedId, exportRef, onReady, onError, onSelect }) {
  const [rig, setRig] = useState(null);
  const selectedMeshesRef = useRef([]);

  useFrame(({ clock }) => {
    const wave = (Math.sin(clock.elapsedTime * SELECTED_BREATHING_SPEED) + 1) / 2;
    const opacity = THREE.MathUtils.lerp(SELECTED_OPACITY_MIN, SELECTED_OPACITY_MAX, wave);
    for (const mesh of selectedMeshesRef.current) mesh.material.opacity = opacity;
  });

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
    const selectedMeshes = [];
    rig.placer.traverse((object) => {
      if (object.isLineSegments) object.raycast = () => {};
      if (!object.isMesh || !object.userData.meshName) return;
      const part = partForMeshInstance(
        object.userData.meshName,
        object.userData.bodyName,
        object.userData.meshOccurrence,
      );
      if (!part) return;
      object.userData.studioPartId = part.id;
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
      object.material.emissive.set("#000000");
      object.material.emissiveIntensity = 0;
      const selected = part.id === selectedId;
      if (object.material.transparent !== selected) {
        object.material.transparent = selected;
        object.material.depthWrite = !selected;
        object.material.needsUpdate = true;
      }
      object.material.opacity = selected ? SELECTED_OPACITY_MAX : 1;
      if (selected) selectedMeshes.push(object);
    });
    selectedMeshesRef.current = selectedMeshes;
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

  if (!rig) return null;
  const selectPressedPart = (event) => {
    const hits = [event.object, ...(event.intersections ?? []).map((hit) => hit.object)];
    const partId = hits.find((object) => object?.userData?.studioPartId)?.userData?.studioPartId;
    if (!partId) return;
    event.stopPropagation();
    onSelect(partId);
  };
  return <primitive object={rig.placer} onPointerDown={selectPressedPart} />;
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
    <Box component="aside" sx={{ ...panelSx, gridArea: "parts", display: { xs: "none", md: "block" }, borderRight: "1px solid", overflowY: "auto", p: "1.6rem 1.15rem 2.5rem", minWidth: 0 }}>
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

function CanvasPanel({ colors, selectedId, exportRef, action, loading, error, onReady, onError, onView, onSelect }) {
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
        <StudioModel colors={colors} selectedId={selectedId} exportRef={exportRef} onReady={onReady} onError={onError} onSelect={onSelect} />
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

      <Box sx={{ position: "absolute", zIndex: 5, right: { xs: 12, md: 22 }, bottom: { xs: 12, md: 22 }, display: "grid", border: `2px solid ${COMIC_INK}`, boxShadow: `4px 4px 0 ${ORANGE}` }}>
        {[
          ["home", "home", "Reset view"],
          ["plus", "in", "Zoom in"],
          ["minus", "out", "Zoom out"],
        ].map(([icon, type, label]) => (
          <Box key={type} component="button" type="button" aria-label={label} onClick={() => onView(type)} sx={{ appearance: "none", width: { xs: 36, md: 42 }, height: { xs: 36, md: 42 }, display: "grid", placeItems: "center", border: "none", borderBottom: type === "out" ? "none" : "1px solid rgba(16,16,24,0.16)", background: CREAM, color: COMIC_INK, cursor: "pointer", "&:hover": { background: ORANGE }, "&:focus-visible": { outline: `3px dashed ${ORANGE}`, outlineOffset: -5 } }}>
            <Icon type={icon} />
          </Box>
        ))}
      </Box>
      <Typography sx={{ position: "absolute", zIndex: 2, left: { xs: 12, md: 22 }, bottom: { xs: 12, md: 20 }, maxWidth: { xs: "65%", md: "none" }, fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.42)" }}>
        <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>TAP PART · DRAG TO ROTATE</Box>
        <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>DRAG TO ORBIT · SCROLL TO ZOOM</Box>
      </Typography>
    </Box>
  );
}

function ControlRail({ selectedId, colors, onColor, onPreset, onRandom }) {
  const selected = PART_BY_ID[selectedId];
  const bambuMatch = closestBambuColor(colors[selectedId]);
  const exactBambu = exactBambuColor(colors[selectedId]);
  const [hexDraft, setHexDraft] = useState(colors[selectedId]);

  useEffect(() => setHexDraft(colors[selectedId]), [colors, selectedId]);

  const commitHex = () => {
    const value = hexDraft.trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(value)) onColor(value);
    else setHexDraft(colors[selectedId]);
  };

  return (
    <Box component="aside" sx={{ ...panelSx, gridArea: "controls", display: { xs: "none", md: "block" }, borderLeft: "1px solid", overflowY: "auto", p: "1.6rem 1.35rem 2.5rem", minWidth: 0 }}>
      <Typography sx={eyebrowSx}>02 / Make it yours</Typography>
      <Box sx={{ mt: "1rem", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
        <Typography component="h2" sx={{ fontFamily: ANTON, fontSize: "1.35rem", textTransform: "uppercase", color: CREAM }}>{selected.label}</Typography>
        <Typography sx={{ ...eyebrowSx, color: ORANGE }}>Selected</Typography>
      </Box>

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

function MobileStudioDock({ mode, setMode, selectedId, colors, onSelect, onColor, onPreset, onRandom }) {
  const selected = PART_BY_ID[selectedId];
  const bambuMatch = closestBambuColor(colors[selectedId]);
  const activeGroup = MOBILE_GROUP_BY_ID[mode] ?? MOBILE_GROUPS[0];
  const chooseGroup = (groupId) => {
    const group = MOBILE_GROUP_BY_ID[groupId];
    setMode(groupId);
    if (!group.parts.some((part) => part.id === selectedId)) onSelect(group.parts[0].id);
  };

  return (
    <Box
      component="aside"
      sx={{
        ...panelSx,
        gridArea: "mobile",
        display: { xs: "grid", md: "none" },
        minWidth: 0,
        minHeight: 0,
        gridTemplateRows: "48px 40px minmax(0,1fr)",
        borderTop: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(17,17,24,0.96)",
        backdropFilter: "blur(18px) saturate(140%)",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: "0.7rem", display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
        <Box sx={{ position: "relative", width: 34, height: 34, flex: "0 0 auto", background: colors[selectedId], border: `2px solid ${CREAM}`, boxShadow: `2px 2px 0 ${ORANGE}` }}>
          <Box component="input" type="color" aria-label={`Choose ${selected.label} custom color`} value={colors[selectedId]} onChange={(event) => onColor(event.target.value.toUpperCase())} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: ANTON, fontSize: "0.9rem", lineHeight: 1.1, letterSpacing: "0.035em", textTransform: "uppercase" }}>{selected.label}</Typography>
          <Typography sx={{ mt: 0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO, fontSize: "0.62rem", color: ORANGE }}>{bambuMatch.code} · {bambuMatch.name}</Typography>
        </Box>
        <Box component="button" type="button" aria-label="Randomize the full colorway" onClick={onRandom} sx={{ appearance: "none", width: 36, height: 36, flex: "0 0 auto", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,0.2)", background: "#0b0b10", color: CREAM, "&:active": { transform: "scale(0.94)", background: ORANGE, color: COMIC_INK } }}>
          <Icon type="shuffle" />
        </Box>
      </Box>

      <Box role="tablist" aria-label="Part categories" sx={{ mx: "0.7rem", p: "3px", display: "grid", gridTemplateColumns: `repeat(${MOBILE_GROUPS.length},1fr)`, background: "#09090d", border: "1px solid rgba(255,255,255,0.1)" }}>
        {MOBILE_GROUPS.map(({ id, label }) => (
          <Box component="button" type="button" role="tab" aria-selected={mode === id} key={id} onClick={() => chooseGroup(id)} sx={{ appearance: "none", minWidth: 0, border: 0, background: mode === id ? CREAM : "transparent", color: mode === id ? COMIC_INK : "rgba(255,255,255,0.54)", fontFamily: ANTON, fontSize: "0.68rem", letterSpacing: "0.035em", textTransform: "uppercase", "&:active": { transform: "scale(0.97)" } }}>
            {label}
          </Box>
        ))}
      </Box>

      <Box sx={{ minHeight: 0, overflow: "hidden", p: "0.55rem 0.7rem max(0.55rem, env(safe-area-inset-bottom))" }}>
        <Box sx={{ height: "100%", display: "grid", gridTemplateRows: "38px minmax(0,1fr) 30px", gap: "0.35rem" }}>
            <Box sx={{ minWidth: 0, display: "flex", gap: "0.35rem", overflowX: "auto", overflowY: "hidden", scrollSnapType: "x proximity", scrollPaddingInline: "0.1rem", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch", touchAction: "pan-x", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {activeGroup.parts.map((part) => {
                const active = part.id === selectedId;
                return (
                  <Box component="button" type="button" key={part.id} aria-pressed={active} onClick={() => onSelect(part.id)} sx={{ appearance: "none", flex: activeGroup.parts.length <= 3 ? "1 1 0" : "0 0 118px", minWidth: activeGroup.parts.length <= 3 ? 0 : 118, scrollSnapAlign: "start", p: "0.35rem 0.55rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.38rem", border: "1px solid", borderColor: active ? ORANGE : "rgba(255,255,255,0.12)", background: active ? CREAM : "#0b0b10", color: active ? COMIC_INK : CREAM, fontSize: "0.72rem", lineHeight: 1, fontWeight: 750, whiteSpace: "nowrap", "&:active": { transform: "scale(0.97)" } }}>
                    <Box sx={{ width: 11, height: 11, flex: "0 0 auto", background: colors[part.id], border: "1px solid rgba(128,128,128,0.6)" }} />
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{part.label}</Box>
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ minHeight: 0, display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gridTemplateRows: "repeat(5,minmax(0,1fr))", gap: "0.2rem" }}>
              {BAMBU_PLA_BASIC.map((swatch) => {
                const active = colors[selectedId] === swatch.hex;
                return (
                  <Box component="button" type="button" key={swatch.code} title={`${bambuLabel(swatch)} · ${swatch.hex}`} aria-label={`Use Bambu ${bambuLabel(swatch)}`} aria-pressed={active} onClick={() => onColor(swatch.hex)} sx={{ appearance: "none", height: "min(40px, 100%)", maxWidth: 40, aspectRatio: "1", placeSelf: "center", borderRadius: "50%", border: active ? `3px solid ${CREAM}` : "2px solid rgba(255,255,255,0.22)", outline: active ? `2px solid ${ORANGE}` : "none", outlineOffset: 1, background: swatch.hex, boxShadow: swatch.hex === "#000000" ? "inset 0 0 0 1px rgba(255,255,255,0.25)" : "none", "&:active": { transform: "scale(0.88)" } }} />
                );
              })}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "0.35rem" }}>
              {PRESETS.map((preset) => (
                <Box component="button" type="button" key={preset.id} aria-label={`Apply ${preset.label} colorway`} onClick={() => onPreset(preset.colors)} sx={{ appearance: "none", minWidth: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: "1px solid rgba(255,255,255,0.18)", "&:active": { transform: "scale(0.95)" } }}>
                  {preset.stripe.map((color) => <Box key={color} sx={{ background: color }} />)}
                </Box>
              ))}
              <Box component="button" type="button" aria-label="Random colorway" onClick={onRandom} sx={{ appearance: "none", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,0.18)", background: "#0b0b10", color: CREAM, "&:active": { transform: "scale(0.95)" } }}><Icon type="shuffle" /></Box>
            </Box>
          </Box>
      </Box>
    </Box>
  );
}

export default function Customizer() {
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [selectedId, setSelectedId] = useState("head");
  const [mobileMode, setMobileMode] = useState("head");
  const [viewAction, setViewAction] = useState({ seq: 0, type: "home" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const exportRef = useRef({ root: null });
  const ready = useMemo(() => !loading && !loadError, [loading, loadError]);
  const meshColors = useMemo(() => colorOverridesForParts(colors), [colors]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Microduck Color Studio";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyOverscroll = document.body.style.overscrollBehaviorY;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehaviorY = "none";
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.overscrollBehaviorY = bodyOverscroll;
    };
  }, []);

  const handleModelReady = useCallback(() => setLoading(false), []);
  const handleModelError = useCallback((error) => {
    setLoading(false);
    setLoadError(error?.message || "Unable to load the model");
  }, []);

  useEffect(() => {
    saveStudioDesign({ colors, meshColors });
  }, [colors, meshColors]);

  const selectPart = useCallback((partId) => {
    setSelectedId(partId);
    setMobileMode(MOBILE_GROUP_ID_BY_PART[partId] ?? "head");
  }, []);
  const setSelectedColor = (color) => setColors((current) => ({ ...current, [selectedId]: color.toUpperCase() }));

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
    <Box sx={{ height: "100dvh", overflow: "hidden", background: "#08080c", color: CREAM }}>
      <Box component="header" sx={{ position: "relative", zIndex: 10, height: { xs: 58, md: 66 }, display: "flex", alignItems: "center", gap: { xs: 0.75, sm: 2 }, px: { xs: 0.85, sm: 2.2 }, borderBottom: "1px solid rgba(255,255,255,0.1)", background: "#0b0b10" }}>
        <Box component="a" href="./" aria-label="Back to Microduck simulator" sx={{ display: "flex", alignItems: "center", gap: 1, color: CREAM, textDecoration: "none" }}>
          <Box component="img" src={signed("./assets/duck-head-mark.webp")} alt="" sx={{ width: { xs: 32, md: 38 }, height: { xs: 26, md: 30 }, objectFit: "contain", filter: "drop-shadow(2px 2px 0 rgba(0,0,0,.5))" }} />
          <Typography sx={{ display: { xs: "none", sm: "block" }, fontFamily: ANTON, fontSize: "1.2rem", letterSpacing: "0.025em", textTransform: "uppercase" }}>Microduck</Typography>
        </Box>
        <Box sx={{ width: 1, height: 24, background: "rgba(255,255,255,0.16)" }} />
        <Typography sx={{ fontFamily: MONO, fontSize: { xs: "0.66rem", sm: "0.72rem" }, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)" }}>Color Studio</Typography>
        <Typography sx={{ display: { xs: "none", lg: "block" }, ml: "auto", mr: "auto", fontSize: "0.78rem", color: "rgba(255,255,255,0.34)" }}>Make the hardware unmistakably yours.</Typography>
        <Box component="button" type="button" aria-label="Run this design in the simulator" disabled={!ready} onClick={runInSimulator} sx={{ ml: { xs: "auto", lg: 0 }, ...smallButtonSx, minHeight: { xs: 36, md: 42 }, px: { xs: 0.65, md: 0.9 }, display: "flex", alignItems: "center", gap: "0.45rem", background: CREAM, boxShadow: `4px 4px 0 ${ORANGE}`, opacity: !ready ? 0.55 : 1 }}>
          <Icon type="play" />
          <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Run design</Box>
        </Box>
        <Box component="button" type="button" aria-label={exporting ? "Building 3MF ZIP package" : "Export 3MF ZIP package"} disabled={!ready || exporting} onClick={exportDesign} sx={{ ...smallButtonSx, minHeight: { xs: 36, md: 42 }, px: { xs: 0.65, md: 0.9 }, display: "flex", alignItems: "center", gap: "0.5rem", background: ORANGE, boxShadow: `4px 4px 0 ${CREAM}`, opacity: !ready ? 0.55 : 1, "&:disabled": { cursor: "wait" } }}>
          {exporting ? <CircularProgress size={16} sx={{ color: COMIC_INK }} /> : null}
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{exporting ? "Building" : "Export ZIP"}</Box>
          <Icon type="arrow" />
        </Box>
      </Box>

      <Box sx={{ height: { xs: "calc(100dvh - 58px)", md: "calc(100dvh - 66px)" }, display: "grid", gridTemplateAreas: { xs: '"preview" "mobile"', md: '"parts preview controls"' }, gridTemplateColumns: { xs: "1fr", md: "230px minmax(360px,1fr) 300px", xl: "258px minmax(520px,1fr) 348px" }, gridTemplateRows: { xs: "minmax(180px,1fr) clamp(300px,46dvh,340px)", md: "1fr" }, overflow: "hidden", "@media (max-width:899px) and (max-height:600px)": { gridTemplateAreas: '"preview mobile"', gridTemplateColumns: "minmax(0,1fr) minmax(300px,44vw)", gridTemplateRows: "1fr" } }}>
        <PartRail selectedId={selectedId} colors={colors} onSelect={selectPart} />
        <CanvasPanel colors={colors} selectedId={selectedId} exportRef={exportRef} action={viewAction} loading={loading} error={loadError} onReady={handleModelReady} onError={handleModelError} onView={(type) => setViewAction(({ seq }) => ({ seq: seq + 1, type }))} onSelect={selectPart} />
        <ControlRail selectedId={selectedId} colors={colors} onColor={setSelectedColor} onPreset={(next) => setColors({ ...next })} onRandom={randomize} />
        <MobileStudioDock mode={mobileMode} setMode={setMobileMode} selectedId={selectedId} colors={colors} onSelect={selectPart} onColor={setSelectedColor} onPreset={(next) => setColors({ ...next })} onRandom={randomize} />
      </Box>

      {notice ? (
        <Box role="status" sx={{ position: "fixed", zIndex: 30, left: "50%", bottom: 22, transform: "translateX(-50%)", px: "1rem", py: "0.65rem", border: `2px solid ${COMIC_INK}`, background: CREAM, color: COMIC_INK, boxShadow: `5px 5px 0 ${ORANGE}`, fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {notice}
        </Box>
      ) : null}
    </Box>
  );
}
