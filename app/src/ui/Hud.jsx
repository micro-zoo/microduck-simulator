// In-game HUD: Back, Discord/GitHub links, scene/control quickbar, a
// persistent input legend, telemetry and async loader status.
//
// Chrome reads as small comic PANELS: each group sits in a thick cream
// keyline frame on a dark glass plate (1px ink inset between glass and
// frame), with a caption box (cartouche) overlapping the frame's corner -
// flat cream (orange for the community CTA) fill, ink keyline, hard 2px offset
// shadow, half in / half out like a caption on a comic panel's edge. Same
// tokens as the landing (Anton, orange, cream), zero radius everywhere.
// Title-menu CTAs stay ComicButton.
//
// Whole HUD is hidden while the title/pause overlay is up; touch mode
// strips it down to the thumbs + Back.
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { keyframes } from "@mui/material/styles";
import { useGame, gameApi } from "../store.js";
import { VARIANT_LABELS, VARIANT_SWATCH_HEX } from "../game/variants.js";
import { ORANGE, MONO } from "../theme.js";
import { ANTON, COMIC_INK, CREAM } from "./comic.jsx";
import { readLayoutMap, resolveKeycaps } from "./keyboard-layout.js";

const HUD_CONTROL_CODES = ["KeyX", "KeyG", "KeyQ", "KeyE", "KeyR", "KeyM", "KeyC"];

function useHudKeycaps(enabled) {
  const [keycaps, setKeycaps] = useState(() => resolveKeycaps(HUD_CONTROL_CODES, null));
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const read = async () => {
      const map = await readLayoutMap();
      if (!cancelled) setKeycaps(resolveKeycaps(HUD_CONTROL_CODES, map));
    };
    read();
    const keyboard = navigator.keyboard;
    keyboard?.addEventListener?.("layoutchange", read);
    return () => {
      cancelled = true;
      keyboard?.removeEventListener?.("layoutchange", read);
    };
  }, [enabled]);
  return keycaps;
}

const recBlink = keyframes`
  0%, 58% { opacity: 1; }
  59%, 100% { opacity: 0.12; }
`;

const chipPop = keyframes`
  0% { transform: scale(0.86); }
  55% { transform: scale(1.1); }
  100% { transform: scale(1); }
`;

const HUD_H = 48;
const FRAME_W = 2; // cream keyline thickness
const PANEL_PAD = 5; // air between the frame and the printed content
// Height left for the cells inside frame + padding; colour swatches use it
// as their width too so they stay square.
const CELL_H = HUD_H - 2 * (FRAME_W + PANEL_PAD);
const CELL_GAP = 4; // gap between cells; the glass ground shows through
const FRAME = "rgba(250, 248, 242, 0.9)";
const GLASS = "rgba(8, 8, 12, 0.6)";

// The panel frame: a thick cream keyline (comic ink weight, HUD read)
// around a dark glass plate, with a 1px ink inset between frame and glass
// so it reads like a printed panel, and a few px of glass padding so the
// content has air inside the frame (the glass ground fills the padding).
// The inset is a pseudo-element so it draws over the cells (an inset
// box-shadow would be painted under them). Overflow clipping lives on the
// inner content wrapper, not the plate, so the caption box can hang over
// the frame's corner.
const plateSx = {
  position: "relative",
  display: "inline-flex",
  height: HUD_H,
  boxSizing: "border-box",
  border: `${FRAME_W}px solid ${FRAME}`,
  padding: `${PANEL_PAD}px`,
  borderRadius: 0,
  background: GLASS,
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 2,
    boxShadow: `inset 0 0 0 1px ${COMIC_INK}`,
  },
};

// Caption box (cartouche) printed over the panel's top corner, half in /
// half out - the landing's print language: flat fill, ink keyline, hard
// offset shadow, zero radius. Decorative only: no pointer events, no
// layout footprint (absolute over the frame).
const CAPTION_FILLS = { cream: CREAM, orange: ORANGE };
const captionBaseSx = {
  position: "absolute",
  top: -9,
  zIndex: 3,
  pointerEvents: "none",
  userSelect: "none",
  whiteSpace: "nowrap",
  fontFamily: ANTON,
  fontSize: "0.58rem",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  lineHeight: 1,
  padding: "3px 6px 2px",
  color: COMIC_INK,
  border: `2px solid ${COMIC_INK}`,
  borderRadius: 0,
  boxShadow: `2px 2px 0 ${COMIC_INK}`,
};

function HudPlate({ caption, captionSide = "left", captionFill = "cream", children, sx }) {
  return (
    <Box sx={{ ...plateSx, ...sx }}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "stretch",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
      {caption ? (
        <Box
          aria-hidden
          sx={{
            ...captionBaseSx,
            background: CAPTION_FILLS[captionFill],
            ...(captionSide === "right" ? { right: -8 } : { left: -8 }),
          }}
        >
          {caption}
        </Box>
      ) : null}
    </Box>
  );
}

function BackArrowIcon() {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      sx={{ width: "0.95em", height: "0.95em", display: "block", flex: "none" }}
    >
      <path d="M20 12H6" />
      <path d="M12 5l-7 7 7 7" />
    </Box>
  );
}

const hudHitSx = {
  appearance: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.45em",
  height: "100%",
  px: "0.95rem",
  margin: 0,
  border: "none",
  borderRadius: 0,
  background: "transparent",
  color: CREAM,
  cursor: "pointer",
  fontFamily: ANTON,
  fontSize: "0.92rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textDecoration: "none",
  lineHeight: 1,
  whiteSpace: "nowrap",
  WebkitTapHighlightColor: "transparent",
  userSelect: "none",
  transition: "background 0.15s ease, color 0.15s ease, filter 0.15s ease",
  "&:focus-visible": {
    outline: `2px dashed ${CREAM}`,
    outlineOffset: -5,
  },
};

function BackButton() {
  return (
    <HudPlate
      caption="Nav"
      sx={{ position: "fixed", top: "1.25rem", left: "1.5rem", zIndex: 10 }}
    >
      <Box
        component="button"
        type="button"
        onClick={() => useGame.setState({ menuOpen: true })}
        sx={{
          ...hudHitSx,
          "&:hover": {
            color: ORANGE,
            background: "rgba(255, 122, 47, 0.12)",
          },
          "&:active": { filter: "brightness(0.92)" },
        }}
      >
        <BackArrowIcon /> Back
      </Box>
    </HudPlate>
  );
}

const COMMUNITY_LINKS = [
  { label: "Discord", caption: "Chat", href: "https://discord.gg/7NmDZ3Xcee", accent: true },
  { label: "GitHub", caption: "Code", href: "https://github.com/micro-zoo", accent: false },
];

function CommunityLinks() {
  return (
    <Box
      sx={{
        position: "fixed",
        top: "1.25rem",
        right: "1.5rem",
        zIndex: 10,
        display: "flex",
        gap: "0.75rem",
      }}
    >
      {COMMUNITY_LINKS.map((link) => (
        <HudPlate
          key={link.label}
          caption={link.caption}
          captionSide="right"
          captionFill={link.accent ? "orange" : "cream"}
        >
          <Box
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              ...hudHitSx,
              background: link.accent ? ORANGE : "transparent",
              color: link.accent ? COMIC_INK : CREAM,
              "&:hover": {
                color: link.accent ? COMIC_INK : ORANGE,
                background: link.accent ? ORANGE : "rgba(255, 122, 47, 0.12)",
                filter: "brightness(1.07)",
              },
              "&:active": { filter: "brightness(0.92)" },
            }}
          >
            {link.label}
          </Box>
        </HudPlate>
      ))}
    </Box>
  );
}

function Quickbar() {
  const variant = useGame((s) => s.variant);
  const locoWant = useGame((s) => s.locoWant);
  const sceneWant = useGame((s) => s.sceneWant);
  const sceneSwitching = useGame((s) => s.sceneSwitching);
  const controlMode = useGame((s) => s.controlMode);
  const wbcLoading = useGame((s) => s.wbcLoading);
  const wbcClip = useGame((s) => s.wbcClip);
  const wbcClips = useGame((s) => s.wbcClips);
  const selectedControl = wbcLoading ? "wbc" : controlMode;
  return (
    <Box
      sx={{
        position: "fixed",
        top: "1.25rem",
        left: "9rem",
        zIndex: 10,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: "0.85rem",
        maxWidth: "calc(100vw - 25rem)",
        "@media (max-width: 1150px)": {
          top: "5.25rem",
          left: "1.5rem",
          maxWidth: "calc(100vw - 14.5rem)",
        },
      }}
    >
      <HudPlate caption="Color">
        <Box
          role="group"
          aria-label="Duck colours"
          sx={{
            display: "inline-flex",
            alignItems: "stretch",
            height: "100%",
            gap: `${CELL_GAP}px`,
          }}
        >
          {Object.entries(VARIANT_SWATCH_HEX).map(([name, hex]) => {
            const selected = name === variant;
            const label = VARIANT_LABELS[name] ?? name;
            return (
              <Box
                key={name}
                component="button"
                type="button"
                title={label}
                aria-label={`${label} colours`}
                aria-pressed={selected}
                onClick={() => gameApi.setVariant?.(name)}
                sx={{
                  appearance: "none",
                  width: CELL_H, // square cell inside frame + padding
                  height: "100%",
                  p: 0,
                  background: hex,
                  border: "none",
                  borderRadius: 0,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  boxShadow: selected ? `inset 0 0 0 2px ${CREAM}` : "none",
                  opacity: selected ? 1 : 0.7,
                  animation: selected ? `${chipPop} 0.28s ease` : "none",
                  transition: "opacity 0.15s ease, box-shadow 0.15s ease",
                  "&:hover": { opacity: 1 },
                  "&:active": { animation: "none", filter: "brightness(0.92)" },
                  "&:focus-visible": {
                    outline: `2px dashed ${CREAM}`,
                    outlineOffset: -5,
                  },
                  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
              />
            );
          })}
        </Box>
      </HudPlate>
      <HudPlate caption="Mode">
        <Box
          role="group"
          aria-label="Locomotion mode"
          sx={{
            display: "inline-flex",
            alignItems: "stretch",
            height: "100%",
            gap: `${CELL_GAP}px`,
          }}
        >
          {[
            { name: "legs", label: "Feet" },
            { name: "rollers", label: "Rollers" },
          ].map(({ name, label }) => {
            const selected = locoWant === name;
            return (
              <Box
                key={name}
                component="button"
                type="button"
                aria-pressed={selected}
                onClick={() => gameApi.requestLoco?.(name)}
                sx={{
                  ...hudHitSx,
                  px: "1.05rem",
                  background: selected ? ORANGE : "transparent",
                  color: selected ? COMIC_INK : "rgba(250, 248, 242, 0.72)",
                  "&:hover": {
                    color: selected ? COMIC_INK : CREAM,
                    background: selected ? ORANGE : "rgba(255, 122, 47, 0.12)",
                  },
                  "&:active": { filter: "brightness(0.92)" },
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
      </HudPlate>
      <HudPlate caption="Scene">
        <Box
          component="select"
          aria-label="Environment"
          value={sceneWant}
          disabled={sceneSwitching}
          onChange={(event) => gameApi.requestScene?.(event.target.value)}
          sx={{
            ...hudHitSx,
            minWidth: "9.5rem",
            px: "0.8rem",
            pr: "2rem",
            background: "rgba(8, 8, 12, 0.72)",
            color: CREAM,
            "&:disabled": { cursor: "wait", opacity: 0.65 },
            "& option": { color: COMIC_INK, background: CREAM },
          }}
        >
          <option value="arcade">Arcade</option>
          <option value="dining">Dining Room</option>
        </Box>
      </HudPlate>
      <HudPlate caption="Control">
        <Box
          role="group"
          aria-label="Control stack"
          sx={{
            display: "inline-flex",
            alignItems: "stretch",
            height: "100%",
            gap: `${CELL_GAP}px`,
          }}
        >
          {[
            { name: "skills", label: "Skills" },
            { name: "wbc", label: "WBC" },
          ].map(({ name, label }) => {
            const selected = selectedControl === name;
            return (
              <Box
                key={name}
                component="button"
                type="button"
                aria-pressed={selected}
                onClick={() => gameApi.requestControlMode?.(name)}
                sx={{
                  ...hudHitSx,
                  px: "1.05rem",
                  background: selected ? ORANGE : "transparent",
                  color: selected ? COMIC_INK : "rgba(250, 248, 242, 0.72)",
                  "&:hover": {
                    color: selected ? COMIC_INK : CREAM,
                    background: selected ? ORANGE : "rgba(255, 122, 47, 0.12)",
                  },
                  "&:active": { filter: "brightness(0.92)" },
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
      </HudPlate>
      {(controlMode === "wbc" || wbcLoading) && (
        <HudPlate caption="WBC Motion">
          <Box
            component="select"
            aria-label="WBC reference motion"
            value={wbcClip}
            disabled={wbcLoading || wbcClips.length === 0}
            onChange={(event) => gameApi.requestWbcClip?.(event.target.value)}
            sx={{
              ...hudHitSx,
              minWidth: "13rem",
              maxWidth: "18rem",
              px: "0.8rem",
              pr: "2rem",
              background: "rgba(8, 8, 12, 0.72)",
              color: CREAM,
              "&:disabled": { cursor: "wait", opacity: 0.65 },
              "& option": { color: COMIC_INK, background: CREAM },
            }}
          >
            {wbcClips.length === 0 ? <option value="">Loading motions…</option> : null}
            {wbcClips.map((clip) => (
              <option key={clip.id} value={clip.id}>
                {clip.name} · {clip.durationSec.toFixed(1)}s
              </option>
            ))}
          </Box>
        </HudPlate>
      )}
    </Box>
  );
}

function Telemetry() {
  const t = useGame((s) => s.telemetry);
  const controlMode = useGame((s) => s.controlMode);
  const wbcProgress = useGame((s) => s.wbcProgress);
  const odo = t.odo < 1000 ? `${t.odo.toFixed(1)}M` : `${(t.odo / 1000).toFixed(2)}KM`;
  const lines = [];
  if (controlMode === "wbc" && wbcProgress.frames) {
    lines.push(`WBC ${wbcProgress.frame + 1}/${wbcProgress.frames}`);
  }
  if (t.peers) lines.push(`${t.peers + 1} ONLINE`);
  lines.push(`${t.speed.toFixed(2)}M/S \u00b7 ODO ${odo}`);
  lines.push(`FPS ${t.fps} \u00b7 CTRL ${t.ctrlHz}HZ`);
  return (
    <Box
      sx={{
        position: "fixed",
        bottom: "5.25rem",
        right: "1.5rem",
        zIndex: 10,
        pointerEvents: "none",
        fontFamily: MONO,
        fontSize: "0.62rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "rgba(255, 255, 255, 0.35)",
        fontVariantNumeric: "tabular-nums",
        textShadow: "0 0 6px rgba(255, 255, 255, 0.15)",
        whiteSpace: "pre-line",
        textAlign: "right",
        lineHeight: 1.8,
      }}
    >
      {lines.join("\n")}
    </Box>
  );
}

function OsdLoad() {
  const rollersLoading = useGame((s) => s.rollersLoading);
  const wbcLoading = useGame((s) => s.wbcLoading);
  const wbcError = useGame((s) => s.wbcError);
  const sceneSwitching = useGame((s) => s.sceneSwitching);
  const sceneError = useGame((s) => s.sceneError);
  if (!rollersLoading && !wbcLoading && !wbcError && !sceneSwitching && !sceneError) return null;
  const error = sceneError || wbcError;
  const message = sceneError
    ? `SCENE ERROR · ${sceneError}`
    : wbcError
    ? `WBC ERROR · ${wbcError}`
    : sceneSwitching ? "LOADING SCENE"
    : wbcLoading ? "LOADING WBC" : "LOADING ROLLERS";
  return (
    <Box
      sx={{
        position: "fixed",
        top: "5.2rem",
        right: "1.5rem",
        zIndex: 10,
        fontFamily: MONO,
        fontSize: "0.68rem",
        letterSpacing: "0.14em",
        color: error ? "#ff6b6b" : ORANGE,
        textShadow: "0 0 8px rgba(255, 122, 47, 0.4)",
        maxWidth: "min(34rem, calc(100vw - 3rem))",
        textAlign: "right",
      }}
    >
      {message}
      {!error ? (
        <Box
          component="span"
          sx={{ display: "inline-block", ml: "0.15em", animation: `${recBlink} 0.8s steps(1) infinite` }}
        >
          {"\u2588"}
        </Box>
      ) : null}
    </Box>
  );
}

function SceneCredit() {
  const scene = useGame((s) => s.scene);
  if (scene !== "dining") return null;
  return (
    <Box
      sx={{
        position: "fixed",
        left: "1.5rem",
        bottom: "9.55rem",
        zIndex: 10,
        fontFamily: MONO,
        fontSize: "0.56rem",
        letterSpacing: "0.08em",
        color: "rgba(250, 248, 242, 0.58)",
        "& a": { color: "inherit" },
      }}
    >
      ROOM: <a href="https://sketchfab.com/ida61xq" target="_blank" rel="noreferrer">CHRISTYHSU</a>
      {" · "}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
    </Box>
  );
}

const keyCapSx = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "1.45rem",
  height: "1.35rem",
  px: "0.32rem",
  boxSizing: "border-box",
  border: `1px solid ${CREAM}`,
  borderRadius: 0,
  background: "#14141c",
  color: CREAM,
  fontFamily: MONO,
  fontSize: "0.56rem",
  fontWeight: 700,
  lineHeight: 1,
  boxShadow: `2px 2px 0 ${COMIC_INK}`,
};

function ControlHints() {
  const padConnected = useGame((s) => s.padConnected);
  const loco = useGame((s) => s.loco);
  const { labels } = useHudKeycaps(!padConnected);
  const rollers = loco === "rollers";
  const hints = rollers
    ? padConnected
      ? [
          { caps: ["LS"], label: "Drive" },
          { caps: ["↑"], label: "Hold: Feet" },
          { caps: ["→"], label: "Switch WBC" },
          { caps: ["R3"], label: "Camera" },
        ]
      : [
          { caps: ["↑↓←→", `${labels.KeyW}${labels.KeyA}${labels.KeyS}${labels.KeyD}`], label: "Drive" },
          { caps: [labels.KeyM], label: "Feet" },
          { caps: [labels.KeyC], label: "Camera" },
          { caps: ["Space"], label: "Reset" },
        ]
    : padConnected
      ? [
        { caps: ["LS"], label: "Move" },
        { caps: ["X"], label: "Roll" },
        { caps: ["A"], label: "Pick" },
        { caps: ["LB", "RB"], label: "Kick" },
        { caps: ["↓"], label: "Sit" },
        { caps: ["↑"], label: "Mode" },
        { caps: ["→"], label: "WBC" },
        { caps: ["R3"], label: "Camera" },
      ]
    : [
        { caps: ["↑↓←→", `${labels.KeyW}${labels.KeyA}${labels.KeyS}${labels.KeyD}`], label: "Move" },
        { caps: [labels.KeyX], label: "Roll" },
        { caps: [labels.KeyG], label: "Pick" },
        { caps: [labels.KeyQ, labels.KeyE], label: "Kick" },
        { caps: [labels.KeyR], label: "Sit" },
        { caps: [labels.KeyM], label: "Mode" },
        { caps: [labels.KeyC], label: "Camera" },
        { caps: ["Space"], label: "Reset" },
      ];
  return (
    <HudPlate
      caption={rollers ? "Roller" : padConnected ? "Gamepad" : "Controls"}
      sx={{
        position: "fixed",
        left: "50%",
        bottom: "1.05rem",
        zIndex: 10,
        transform: "translateX(-50%)",
        maxWidth: "calc(100vw - 3rem)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "stretch", height: "100%" }}>
        {hints.map((hint, index) => (
          <Box
            key={hint.label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "0.38rem",
              px: "0.62rem",
              borderLeft: index ? "1px solid rgba(250, 248, 242, 0.18)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            <Box sx={{ display: "flex", gap: "0.2rem" }}>
              {hint.caps.map((cap) => <Box component="kbd" key={cap} sx={keyCapSx}>{cap}</Box>)}
            </Box>
            <Box sx={{ fontFamily: ANTON, fontSize: "0.66rem", letterSpacing: "0.07em", color: CREAM }}>
              {hint.label}
            </Box>
          </Box>
        ))}
      </Box>
    </HudPlate>
  );
}

export default function Hud() {
  const entered = useGame((s) => s.entered);
  const menuOpen = useGame((s) => s.menuOpen);
  const touchMode = useGame((s) => s.touchMode);
  if (!entered || menuOpen) return null;
  return (
    <>
      <BackButton />
      <CommunityLinks />
      {!touchMode && (
        <>
          <Quickbar />
          <SceneCredit />
          <ControlHints />
          <Telemetry />
          <OsdLoad />
        </>
      )}
    </>
  );
}
