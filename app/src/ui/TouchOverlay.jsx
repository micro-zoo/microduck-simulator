// Touch overlay: a floating left stick, a hold-to-run cap, and the two
// immediate actions that benefit from arcade latency. The full touch control
// deck (scene, modes, all actions) lives in MobileConsole.
//
// The DOM here is deliberately plain and keyed by ids: controls/touch.js
// binds pointer events to #touch-zone / #touch-stick / #touch-sprint /
// #touch-a / #touch-b
// at controller init and toggles the .live/.down classes itself. React
// only owns the wrapper's visibility, so it never fights those mutations -
// which is also why this component must stay mounted at all times.
import Box from "@mui/material/Box";
import { useGame } from "../store.js";
import { INK, ORANGE } from "../theme.js";

export default function TouchOverlay() {
  const touchMode = useGame((s) => s.touchMode);
  const entered = useGame((s) => s.entered);
  const menuOpen = useGame((s) => s.menuOpen);
  const loco = useGame((s) => s.loco);
  const visible = touchMode && entered && !menuOpen;

  return (
    <Box
      id="touch-ui"
      sx={{
        display: visible ? "block" : "none",
        // Floating-stick zone: sits BELOW the back button in z so its tap
        // still lands; the resting stick inside marks the zone when idle.
        "& #touch-zone": {
          position: "fixed",
          left: 0,
          right: "50%",
          top: "30%",
          bottom: 0,
          zIndex: 9,
          touchAction: "none",
        },
        "& #touch-stick": {
          position: "absolute",
          left: "1.3rem",
          bottom: "2rem",
          width: "8.2rem",
          height: "8.2rem",
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          background: "rgba(8, 8, 12, 0.4)",
          pointerEvents: "none", // the zone owns the pointer
        },
        "& #touch-stick .nub": {
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "3.6rem",
          height: "3.6rem",
          margin: "-1.8rem 0 0 -1.8rem",
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.35)",
          background: "rgba(255, 255, 255, 0.14)",
          pointerEvents: "none",
        },
        "& #touch-stick.live": { borderColor: "rgba(255, 122, 47, 0.55)" },
        "& #touch-stick.live .nub": {
          background: "rgba(255, 122, 47, 0.45)",
          borderColor: ORANGE,
        },
        "& #touch-btns": {
          position: "fixed",
          right: "1.3rem",
          bottom: "2.2rem",
          zIndex: 12,
          width: "9.4rem",
          height: "8.4rem",
        },
        "& #touch-sprint-wrap": {
          position: "fixed",
          left: "1.3rem",
          bottom: "min(10.9rem, 34dvh)",
          zIndex: 13,
          display: loco === "rollers" ? "none" : "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.28rem",
          pointerEvents: "auto",
        },
        "& #touch-sprint": {
          appearance: "none",
          minWidth: "4.6rem",
          height: "2.7rem",
          px: "0.75rem",
          border: "2px solid rgba(255, 255, 255, 0.64)",
          borderRadius: 0,
          background: "rgba(8, 8, 12, 0.72)",
          color: "rgba(255, 255, 255, 0.92)",
          boxShadow: "2px 2px 0 rgba(0, 0, 0, 0.7)",
          font: "inherit",
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.11em",
          cursor: "pointer",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTapHighlightColor: "transparent",
          transition: "transform 0.12s ease, background 0.12s ease, color 0.12s ease",
          "&:active, &.down": {
            transform: "scale(0.96)",
            background: ORANGE,
            borderColor: ORANGE,
            color: INK,
          },
          "&:focus-visible": { outline: "2px dashed #fff", outlineOffset: 3 },
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        },
        "& #touch-sprint-wrap span": {
          fontSize: "0.55rem",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.45)",
        },
        "& .capwrap": {
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.3rem",
        },
        "& .cap-a": { right: 0, top: 0, display: loco === "rollers" ? "none" : "flex" },
        "& .cap-b": { left: 0, bottom: 0 },
        "& #touch-btns button": {
          appearance: "none",
          width: "4.2rem",
          height: "4.2rem",
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          background: "rgba(8, 8, 12, 0.5)",
          color: "rgba(255, 255, 255, 0.85)",
          font: "inherit",
          fontSize: "1.3rem",
          fontWeight: 700,
          cursor: "pointer",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        },
        "& #touch-btns button.down": {
          background: ORANGE,
          borderColor: ORANGE,
          color: INK,
        },
        "& .capwrap span": {
          fontSize: "0.55rem",
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.45)",
        },
      }}
    >
      <div id="touch-zone">
        <div id="touch-stick">
          <div className="nub" />
        </div>
      </div>
      <div id="touch-sprint-wrap">
        <button type="button" id="touch-sprint" aria-label="Hold to run">RUN</button>
        <span>Hold + move</span>
      </div>
      <div id="touch-btns">
        <div className="capwrap cap-a">
          <button type="button" id="touch-a" aria-label="Kick">A</button>
          <span>Kick</span>
        </div>
        <div className="capwrap cap-b">
          <button type="button" id="touch-b" aria-label="Quack">B</button>
          <span>Quack</span>
        </div>
      </div>
    </Box>
  );
}
