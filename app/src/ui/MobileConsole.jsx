// Full touch control deck. It intentionally keeps locomotion under the left
// thumb and quick A/B actions exposed, while putting the complete desktop
// surface behind one large, reachable button instead of forcing tiny HUD
// controls over the scene.
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { useGame, gameApi } from "../store.js";
import { VARIANT_LABELS, VARIANT_SWATCH_HEX } from "../game/variants.js";
import { SCENE_IDS, SCENES } from "../game/scenes.js";
import { INK, ORANGE, MONO } from "../theme.js";
import { ANTON, COMIC_INK, CREAM } from "./comic.jsx";

const panelButtonSx = {
  appearance: "none",
  minHeight: "2.7rem",
  px: "0.72rem",
  border: `2px solid ${COMIC_INK}`,
  borderRadius: 0,
  background: "rgba(250, 248, 242, 0.08)",
  color: CREAM,
  boxShadow: `2px 2px 0 ${COMIC_INK}`,
  cursor: "pointer",
  fontFamily: ANTON,
  fontSize: "0.76rem",
  letterSpacing: "0.07em",
  lineHeight: 1,
  textTransform: "uppercase",
  WebkitTapHighlightColor: "transparent",
  transition: "transform 0.12s ease, background 0.12s ease, color 0.12s ease",
  "&:active": { transform: "translate(1px, 1px)", boxShadow: "1px 1px 0 #08080c" },
  "&:focus-visible": { outline: `2px dashed ${CREAM}`, outlineOffset: 3 },
  "&:disabled": { cursor: "not-allowed", opacity: 0.38 },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
};

function DeckSection({ title, children }) {
  return (
    <Box component="section" aria-label={title} sx={{ display: "grid", gap: "0.48rem" }}>
      <Box
        sx={{
          fontFamily: MONO,
          fontSize: "0.59rem",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(250, 248, 242, 0.54)",
        }}
      >
        {title}
      </Box>
      {children}
    </Box>
  );
}

function Segment({ label, items, value, onChange }) {
  return (
    <Box role="group" aria-label={label} sx={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: "0.42rem" }}>
      {items.map(({ value: itemValue, label: itemLabel }) => {
        const selected = itemValue === value;
        return (
          <Box
            key={itemValue}
            component="button"
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(itemValue)}
            sx={{
              ...panelButtonSx,
              background: selected ? ORANGE : "rgba(250, 248, 242, 0.08)",
              color: selected ? INK : CREAM,
            }}
          >
            {itemLabel}
          </Box>
        );
      })}
    </Box>
  );
}

export default function MobileConsole() {
  const touchMode = useGame((s) => s.touchMode);
  const entered = useGame((s) => s.entered);
  const menuOpen = useGame((s) => s.menuOpen);
  const variant = useGame((s) => s.variant);
  const loco = useGame((s) => s.loco);
  const locoWant = useGame((s) => s.locoWant);
  const rollersLoading = useGame((s) => s.rollersLoading);
  const sceneWant = useGame((s) => s.sceneWant);
  const sceneSwitching = useGame((s) => s.sceneSwitching);
  const sceneError = useGame((s) => s.sceneError);
  const controlMode = useGame((s) => s.controlMode);
  const wbcLoading = useGame((s) => s.wbcLoading);
  const wbcError = useGame((s) => s.wbcError);
  const wbcClip = useGame((s) => s.wbcClip);
  const wbcClips = useGame((s) => s.wbcClips);
  const modeLabel = useGame((s) => s.modeLabel);
  const [open, setOpen] = useState(false);
  const visible = touchMode && entered && !menuOpen;

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  if (!visible) return null;

  const busy = sceneSwitching || rollersLoading || wbcLoading;
  const message = sceneError
    ? `Scene error · ${sceneError}`
    : wbcError
    ? `WBC error · ${wbcError}`
    : sceneSwitching
    ? "Loading scene…"
    : rollersLoading
    ? "Loading rollers…"
    : wbcLoading
    ? "Loading WBC…"
    : null;
  const action = (name) => gameApi.triggerAction?.(name);
  const skillsOnly = controlMode !== "skills" || loco !== "legs";
  const headMode = modeLabel === "Head";
  const skillsActionDisabled = skillsOnly || headMode;
  const headHold = (input) => ({
    onPointerDown: (event) => {
      event.preventDefault();
      gameApi.setTouchHeadInput?.(input);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    },
    onPointerUp: () => gameApi.setTouchHeadInput?.(),
    onPointerCancel: () => gameApi.setTouchHeadInput?.(),
    onLostPointerCapture: () => gameApi.setTouchHeadInput?.(),
  });

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          // Community links occupy the top rail on touch too; keep this
          // primary affordance on its own line so GitHub never sits under it.
          top: "5.15rem",
          right: "1rem",
          zIndex: 15,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Box
          aria-hidden
          sx={{
            display: { xs: "none", sm: "block" },
            fontFamily: MONO,
            fontSize: "0.56rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(250, 248, 242, 0.56)",
          }}
        >
          {modeLabel}
        </Box>
        <Box
          component="button"
          type="button"
          aria-label="Open control deck"
          aria-expanded={open}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          sx={{
            ...panelButtonSx,
            minHeight: "2.85rem",
            px: "0.9rem",
            background: open ? ORANGE : "rgba(8, 8, 12, 0.78)",
            color: open ? INK : CREAM,
          }}
        >
          {open ? "Close" : "Controls"}
        </Box>
      </Box>

      {open ? (
        <Box
          role="dialog"
          aria-modal="false"
          aria-label="Mobile control deck"
          onPointerDown={(event) => event.stopPropagation()}
          sx={{
            position: "fixed",
            top: "8.55rem",
            right: "0.72rem",
            bottom: "0.72rem",
            left: "0.72rem",
            zIndex: 14,
            display: "grid",
            alignContent: "start",
            gap: "1.05rem",
            overflowY: "auto",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
            p: "1rem",
            border: `2px solid ${CREAM}`,
            boxShadow: `4px 4px 0 ${COMIC_INK}`,
            background: "rgba(8, 8, 12, 0.94)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.75rem" }}>
            <Box>
              <Box sx={{ fontFamily: ANTON, fontSize: "1.08rem", letterSpacing: "0.07em", color: ORANGE, textTransform: "uppercase" }}>
                Microduck
              </Box>
              <Box sx={{ mt: "0.12rem", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.12em", color: "rgba(250, 248, 242, 0.6)", textTransform: "uppercase" }}>
                Enhanced with MicroZoo
              </Box>
            </Box>
            <Box sx={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", color: "rgba(250, 248, 242, 0.62)", textTransform: "uppercase", textAlign: "right" }}>
              {modeLabel}<br />{loco === "rollers" ? "Roller drive" : "Leg skills"}
            </Box>
          </Box>

          {message ? (
            <Box role={sceneError || wbcError ? "alert" : "status"} sx={{ p: "0.65rem 0.7rem", borderLeft: `3px solid ${sceneError || wbcError ? "#ff6b6b" : ORANGE}`, background: "rgba(255, 122, 47, 0.09)", fontFamily: MONO, fontSize: "0.61rem", letterSpacing: "0.08em", lineHeight: 1.45, color: sceneError || wbcError ? "#ff8b8b" : ORANGE, textTransform: "uppercase" }}>
              {message}
            </Box>
          ) : null}

          <DeckSection title="Colour">
            <Box role="group" aria-label="Duck colours" sx={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.42rem" }}>
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
                      appearance: "none", height: "2.65rem", p: 0,
                      border: selected ? `3px solid ${CREAM}` : `2px solid ${COMIC_INK}`,
                      borderRadius: 0, background: hex, cursor: "pointer",
                      boxShadow: selected ? `2px 2px 0 ${ORANGE}` : `2px 2px 0 ${COMIC_INK}`,
                      WebkitTapHighlightColor: "transparent",
                      "&:focus-visible": { outline: `2px dashed ${CREAM}`, outlineOffset: 3 },
                    }}
                  />
                );
              })}
            </Box>
          </DeckSection>

          <DeckSection title="Locomotion">
            <Segment
              label="Locomotion mode"
              value={locoWant}
              onChange={(next) => gameApi.requestLoco?.(next)}
              items={[{ value: "legs", label: "Feet" }, { value: "rollers", label: "Rollers" }]}
            />
          </DeckSection>

          <DeckSection title="Environment">
            <Box
              component="select"
              aria-label="Environment"
              value={sceneWant}
              disabled={sceneSwitching}
              onChange={(event) => gameApi.requestScene?.(event.target.value)}
              sx={{ ...panelButtonSx, width: "100%", background: "rgba(250, 248, 242, 0.08)", "& option": { color: COMIC_INK, background: CREAM } }}
            >
              {SCENE_IDS.map((id) => <option key={id} value={id}>{SCENES[id].label}</option>)}
            </Box>
          </DeckSection>

          <DeckSection title="Control stack">
            <Segment
              label="Control stack"
              value={controlMode}
              onChange={(next) => gameApi.requestControlMode?.(next)}
              items={[{ value: "skills", label: "Skills" }, { value: "wbc", label: "WBC" }]}
            />
            {controlMode === "wbc" || wbcLoading ? (
              <Box
                component="select"
                aria-label="WBC reference motion"
                value={wbcClip}
                disabled={wbcLoading || wbcClips.length === 0}
                onChange={(event) => gameApi.requestWbcClip?.(event.target.value)}
                sx={{ ...panelButtonSx, width: "100%", background: "rgba(250, 248, 242, 0.08)", "& option": { color: COMIC_INK, background: CREAM } }}
              >
                {wbcClips.length === 0 ? <option value="">Loading motions…</option> : null}
                {wbcClips.map((clip) => <option key={clip.id} value={clip.id}>{clip.name} · {clip.durationSec.toFixed(1)}s</option>)}
              </Box>
            ) : null}
          </DeckSection>

          <DeckSection title={skillsOnly ? "Actions · switch to leg skills to enable" : headMode ? "Actions · exit head pose before skills" : "Actions"}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.42rem" }}>
              {[
                ["roll", "Roll", skillsActionDisabled], ["pick", "Pick", skillsActionDisabled],
                ["kickLeft", "Kick left", skillsActionDisabled], ["kickRight", "Kick right", skillsActionDisabled],
                ["sitToggle", "Sit / stand", skillsActionDisabled], ["walk", "Walk", skillsActionDisabled],
                ["head", headMode ? "Exit head" : "Head pose", skillsOnly],
                ["camera", "Camera", false], ["quack", "Quack", false],
                ["ball", "Ball", false], ["reset", "Reset", false],
              ].map(([id, label, disabled]) => (
                <Box key={id} component="button" type="button" disabled={disabled || busy} onClick={() => action(id)} sx={panelButtonSx}>{label}</Box>
              ))}
            </Box>
            <Box
              component="button"
              type="button"
              disabled={busy}
              onPointerDown={(event) => { event.preventDefault(); action("wheeeStart"); try { event.currentTarget.setPointerCapture(event.pointerId); } catch {} }}
              onPointerUp={() => action("wheeeStop")}
              onPointerCancel={() => action("wheeeStop")}
              onLostPointerCapture={() => action("wheeeStop")}
              sx={{ ...panelButtonSx, width: "100%" }}
            >
              Hold wheee
            </Box>
          </DeckSection>

          {headMode ? (
            <DeckSection title="Head pose · hold a direction">
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.42rem" }}>
                <Box component="button" type="button" sx={panelButtonSx} {...headHold({ pitch: 1 })}>Look up</Box>
                <Box component="button" type="button" sx={panelButtonSx} {...headHold({ neckPitch: 1 })}>Neck up</Box>
                <Box component="button" type="button" sx={panelButtonSx} {...headHold({ roll: 1 })}>Tilt left</Box>
                <Box component="button" type="button" sx={panelButtonSx} {...headHold({ yaw: 1 })}>Look left</Box>
                <Box component="button" type="button" onClick={() => gameApi.setTouchHeadInput?.()} sx={panelButtonSx}>Centre</Box>
                <Box component="button" type="button" sx={panelButtonSx} {...headHold({ yaw: -1 })}>Look right</Box>
                <Box component="button" type="button" sx={panelButtonSx} {...headHold({ pitch: -1 })}>Look down</Box>
                <Box component="button" type="button" sx={panelButtonSx} {...headHold({ neckPitch: -1 })}>Neck down</Box>
                <Box component="button" type="button" sx={panelButtonSx} {...headHold({ roll: -1 })}>Tilt right</Box>
              </Box>
            </DeckSection>
          ) : null}

          <Box sx={{ pt: "0.1rem", fontFamily: MONO, fontSize: "0.57rem", letterSpacing: "0.1em", lineHeight: 1.55, color: "rgba(250, 248, 242, 0.48)", textTransform: "uppercase" }}>
            Left thumb: move · hold RUN + forward to ramp toward 1.0 m/s · drag scene to orbit · pinch to zoom
          </Box>
        </Box>
      ) : null}
    </>
  );
}
