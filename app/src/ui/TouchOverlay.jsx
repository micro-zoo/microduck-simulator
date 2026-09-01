// Touch overlay: the left floating stick is always the drive/primary stick.
// Head and body-pose expose the right stick on demand, mirroring padd's
// two-stick modes. The right action deck owns only immediate, thumb-friendly
// controls; scenes and configuration stay in MobileConsole.
//
// controls/touch.js binds pointer events directly to these stable ids. React
// intentionally owns visibility and mode only, never the live nub transforms.
import Box from "@mui/material/Box";
import { useGame } from "../store.js";
import { INK, ORANGE } from "../theme.js";

const actions = [
  ["touch-roll", "Roll"], ["touch-kick", "Kick"],
  ["touch-pick", "Pick"], ["touch-sit", "Sit"],
  ["touch-mouth", "Mouth"], ["touch-quack", "Quack"],
  ["touch-wawa", "Wawa"],
  ["touch-head", "Head"], ["touch-pose", "Pose"],
];

export default function TouchOverlay() {
  const touchMode = useGame((s) => s.touchMode);
  const entered = useGame((s) => s.entered);
  const menuOpen = useGame((s) => s.menuOpen);
  const inputMode = useGame((s) => s.touchInputMode);
  const visible = touchMode && entered && !menuOpen;
  const modal = inputMode !== "drive";

  return (
    <Box
      id="touch-ui"
      sx={{
        display: visible ? "block" : "none",
        "& #touch-zone, & #touch-aux-zone": {
          position: "fixed",
          top: "30%",
          bottom: 0,
          zIndex: 9,
          touchAction: "none",
        },
        "& #touch-zone": { left: 0, right: "50%" },
        // Keep the right hand's stick clear of the action deck and let it
        // disappear entirely in Drive, where the same screen space is free.
        "& #touch-aux-zone": {
          display: modal ? "block" : "none",
          left: "50%",
          right: 0,
          bottom: "16.2rem",
        },
        "& #touch-stick, & #touch-aux-stick": {
          position: "absolute",
          bottom: "2rem",
          width: "8.2rem",
          height: "8.2rem",
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          background: "rgba(8, 8, 12, 0.4)",
          pointerEvents: "none",
        },
        "& #touch-stick": { left: "1.3rem" },
        "& #touch-aux-stick": { right: "1.3rem" },
        "& #touch-stick .nub, & #touch-aux-stick .nub": {
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
        "& #touch-stick.live, & #touch-aux-stick.live": { borderColor: "rgba(255, 122, 47, 0.55)" },
        "& #touch-stick.live .nub, & #touch-aux-stick.live .nub": {
          background: "rgba(255, 122, 47, 0.45)", borderColor: ORANGE,
        },
        "& #touch-btns": {
          position: "fixed",
          right: "1rem",
          bottom: "1rem",
          zIndex: 12,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          width: "11.2rem",
          gap: "0.42rem",
          pointerEvents: "auto",
        },
        "& #touch-btns button": {
          appearance: "none",
          minHeight: "2.65rem",
          padding: "0.35rem 0.45rem",
          borderRadius: 0,
          border: "1px solid rgba(255, 255, 255, 0.28)",
          background: "rgba(8, 8, 12, 0.68)",
          boxShadow: "2px 2px 0 rgba(0, 0, 0, 0.62)",
          color: "rgba(255, 255, 255, 0.88)",
          fontFamily: "Anton, Impact, sans-serif",
          fontSize: "0.76rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTapHighlightColor: "transparent",
          transition: "transform 0.12s ease, background 0.12s ease, color 0.12s ease",
          "&:active, &.down": { transform: "scale(0.96)", background: ORANGE, borderColor: ORANGE, color: INK },
          "&[aria-pressed='true']": { background: ORANGE, borderColor: ORANGE, color: INK },
          "&:focus-visible": { outline: "2px dashed #fff", outlineOffset: 3 },
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        },
      }}
    >
      <div id="touch-zone"><div id="touch-stick"><div className="nub" /></div></div>
      <div id="touch-aux-zone"><div id="touch-aux-stick"><div className="nub" /></div></div>
      <div id="touch-btns">
        {actions.map(([id, label]) => (
          <button
            key={id}
            type="button"
            id={id}
            aria-label={label}
            aria-pressed={(id === "touch-head" && inputMode === "head") || (id === "touch-pose" && inputMode === "pose")}
          >
            {label}
          </button>
        ))}
      </div>
    </Box>
  );
}
