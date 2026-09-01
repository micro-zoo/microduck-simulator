// Title / pause overlay: a full-page ink screen printed in the landing's
// comic DA - big Anton title with the ink-drop + cyan/magenta aberration
// treatment, a comic-block CTA on an acid plate, and an orange halftone
// ramp pooling in the top-left corner. Colour and locomotion live in the
// in-game HUD quickbar, so the intro's only action is Waddle in.
//
// The first "Waddle in" cues the BIOS; later Esc / the in-game Back button
// reopen the overlay as pause ("Resume"). The ?boot=1 bypass lives in
// App.jsx and never mounts this component.
import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { keyframes, styled } from "@mui/material/styles";
import { useGame } from "../store.js";
import { signed } from "../game/signed.js";
import { INK, ORANGE, MONO } from "../theme.js";
import { ComicButton, ComicTitle, HalftoneRamp, ANTON } from "./comic.jsx";
import { readLayoutMap, resolveKeycaps } from "./keyboard-layout.js";

const rowIn = keyframes`
  from { transform: translateY(12px); opacity: 0; }
  to { transform: none; opacity: 1; }
`;
const brandIn = keyframes`
  from { transform: translateY(10px) scale(0.94); opacity: 0; }
  to { transform: none; opacity: 1; }
`;

// One soft ease, small travel, ~80 ms between rows - staged, not showy.
const row = (delay, name = rowIn) => ({
  animation: `${name} 0.55s cubic-bezier(0.22, 1, 0.36, 1) both`,
  animationDelay: `${delay}s`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const Kbd = styled("kbd")(({ round }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: round ? "1.9rem" : "1.65rem",
  height: "1.65rem",
  padding: "0 0.45rem",
  font: "inherit",
  fontSize: "0.68rem",
  fontWeight: 600,
  color: "#fff",
  background: "#14141c",
  border: `2px solid ${INK}`,
  borderRadius: round ? "50%" : 8,
  boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.82)",
}));

// Letter keycaps are resolved from physical codes for the active layout.
const TILES = {
  kb: [
    { caps: "cluster-arrows", name: "Move" },
    { codes: ["KeyX"], name: "Roll", hint: "feet · official roulade" },
    { codes: ["KeyQ", "KeyE"], name: "Kick", hint: "feet · left / right" },
    { codes: ["KeyR"], name: "Sit", hint: "feet only" },
    { codes: ["KeyG"], name: "Pick up", hint: "feet only" },
    { codes: ["KeyH", "KeyP"], name: "Head / Pose", hint: "modal control" },
    { codes: ["KeyV"], name: "Wawa", hint: "voice + beak" },
    { codes: ["KeyC"], name: "Camera", hint: "toggle chase" },
    { caps: ["Space"], name: "Reset", hint: "fresh start" },
  ],
  pad: [
    { caps: ["LS"], name: "Move", hint: "left stick" },
    { caps: ["X"], name: "Roll", hint: "feet · hold to chain" },
    { caps: ["A"], name: "Pick up", hint: "feet only" },
    { caps: ["LB", "RB"], name: "Kick", hint: "feet · left / right" },
    { caps: ["Y", "B"], name: "Head / Pose", hint: "feet only" },
    { caps: ["RS"], name: "Camera", hint: "orbit" },
    { caps: ["\u2193"], name: "Sit", hint: "feet only" },
  ],
  touch: [
    { caps: ["Stick"], name: "Move", hint: "left thumb" },
    { caps: ["Head / Pose"], name: "Modes", hint: "two-stick control" },
    { caps: ["Deck"], name: "Control", hint: "scene · mouth · actions" },
  ],
};
const HINTS = {
  kb: "drag to orbit \u00b7 scroll to zoom",
  pad: "hold \u2191 mode \u00b7 hold \u2192 WBC \u00b7 RT quack \u00b7 LT wheee \u00b7 R3 chase",
  touch: "drag to orbit · pinch to zoom · choose Head or Pose for two-stick control",
};

const KB_CODES = TILES.kb.flatMap((t) => t.codes ?? []);

function useKeycaps(enabled) {
  const [keycaps, setKeycaps] = useState(() => resolveKeycaps(KB_CODES, null));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let latest = 0;
    const read = async () => {
      const ticket = ++latest;
      const map = await readLayoutMap();
      // Overlapping reads can settle out of order; only the newest paints.
      if (!cancelled && ticket === latest) setKeycaps(resolveKeycaps(KB_CODES, map));
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

function closeMenu() {
  useGame.setState({ menuOpen: false });
  if (!useGame.getState().entered) useGame.setState({ entered: true });
}

export default function TitleMenu() {
  const menuOpen = useGame((s) => s.menuOpen);
  const entered = useGame((s) => s.entered);
  const padConnected = useGame((s) => s.padConnected);
  const touchMode = useGame((s) => s.touchMode);
  const [closing, setClosing] = useState(false);
  const prevOpen = useRef(menuOpen);
  // A plugged-in gamepad wins over the touch tutorial.
  const tutorialVariant = padConnected ? "pad" : touchMode ? "touch" : "kb";
  const { labels, moveHint } = useKeycaps(tutorialVariant === "kb");

  // Keep the overlay mounted through the 0.35 s closing fade.
  useEffect(() => {
    const was = prevOpen.current;
    prevOpen.current = menuOpen;
    if (was && !menuOpen) {
      setClosing(true);
      const t = setTimeout(() => setClosing(false), 380);
      return () => clearTimeout(t);
    }
  }, [menuOpen]);

  // Enter enters / resumes; Esc toggles the pause menu (never over the
  // BIOS readout).
  useEffect(() => {
    const onKey = (e) => {
      const s = useGame.getState();
      if (e.code === "Enter" && s.menuOpen) {
        if (e.target instanceof HTMLButtonElement && e.target.dataset.cta !== "1") return;
        e.preventDefault();
        closeMenu();
        return;
      }
      if (e.code !== "Escape") return;
      if (s.biosVisible) return;
      if (s.menuOpen) {
        if (s.entered) closeMenu();
        return;
      }
      if (s.entered) useGame.setState({ menuOpen: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!menuOpen && !closing) return null;

  const tiles =
    tutorialVariant === "kb"
      ? TILES.kb.map((t) => ({
          ...t,
          caps: t.codes ? t.codes.map((code) => labels[code]) : t.caps,
          hint: t.hint ?? moveHint,
        }))
      : TILES[tutorialVariant];
  const ctaLabel = entered ? "Resume" : "Waddle in";

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="Microduck - Enhanced with MicroZoo"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: "2.4rem 1.4rem 1.8rem",
        background: INK,
        opacity: menuOpen ? 1 : 0,
        pointerEvents: menuOpen ? "auto" : "none",
        overflowY: "auto",
        transition: "opacity 0.35s ease, background 0.4s ease",
      }}
    >
      {/* Theme-orange halftone pooling in the top-left corner, dots
          growing toward it - the landing's screen-tone on ink ground. */}
      <HalftoneRamp
        color="rgba(255, 122, 47, 0.16)"
        size={20}
        corner="top-left"
        reach={60}
      />

      <Box
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: "min(48rem, 92vw)",
          textAlign: "center",
          m: "auto 0",
        }}
      >
        {/* Vitrine brand lockup: drawn duck head + name. Hovering swaps to
            the open-beak frame, same hard sprite swap as the vitrine. */}
        <Box
          aria-hidden
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            mb: "1.15rem",
            userSelect: "none",
            ...row(0, brandIn),
            "&:hover .duck-closed": { opacity: 0 },
            "&:hover .duck-open": { opacity: 1 },
          }}
        >
          <Box
            component="span"
            sx={{
              position: "relative",
              display: "block",
              height: { xs: "2.4rem", sm: "3rem" },
              filter: "drop-shadow(3px 3px 0 rgba(0, 0, 0, 0.5))",
            }}
          >
            <Box
              component="img"
              className="duck-closed"
              alt=""
              src={signed("./assets/duck-head-mark.webp")}
              sx={{ display: "block", height: "100%", width: "auto" }}
            />
            {/* The open frame's canvas (460x333) is a hair wider/taller
                than the closed one (454x269); offsets pin the head while
                the jaw hangs below. */}
            <Box
              component="img"
              className="duck-open"
              alt=""
              src={signed("./assets/duck-head-mark-open.webp")}
              sx={{
                position: "absolute",
                top: "-0.75%",
                left: "-1.1%",
                width: "101.3%",
                maxWidth: "none",
                height: "auto",
                opacity: 0,
              }}
            />
          </Box>
        </Box>

        {/* The landing hero's mistracked-VHS treatment: orange fill with
            ink drop + chroma ghosts, hollow echo line below. */}
        <ComicTitle
          component="h1"
          tone="dark"
          accent={ORANGE}
          fontSize="clamp(3.1rem, 10vw, 5.4rem)"
          lines={[
            { text: "Microduck" },
            { text: "Enhanced with MicroZoo", variant: "outline", scale: 0.31 },
          ]}
          sx={{ ...row(0.08) }}
        />

        <Typography
          sx={{
            mx: "auto",
            mt: "1.1rem",
            "@media (max-height: 700px)": { mt: "0.8rem" },
            maxWidth: "36ch",
            fontSize: { xs: "0.95rem", sm: "1.05rem" },
            lineHeight: 1.5,
            letterSpacing: "-0.012em",
            color: "rgba(255, 255, 255, 0.72)",
            textWrap: "balance",
            ...row(0.24),
          }}
        >
          The exact same trained policies that drive the real robot,
          live in your browser.
        </Typography>

        <Box
          sx={{
            display: "grid",
            // Three columns from ~500px up (two rows of tiles); narrow
            // phones fall back to two.
            gridTemplateColumns:
              tutorialVariant === "touch" ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
            "@media (min-width: 500px)": {
              gridTemplateColumns: "repeat(3, 1fr)",
            },
            gap: "0.55rem",
            m: "1.35rem auto 0",
            maxWidth: "36rem",
            ...row(0.32),
          }}
        >
          {tiles.map((t) => (
            <Box
              key={t.name}
              sx={{
                p: { xs: "0.65rem 0.35rem 0.6rem", sm: "0.8rem 0.45rem 0.7rem" },
                border: "1px solid rgba(255, 255, 255, 0.09)",
                background: "rgba(255, 255, 255, 0.035)",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.2rem",
                  height: { xs: "2.8rem", sm: "3.3rem" },
                  // Arrow-cluster keycaps are a notch smaller so two rows
                  // fit.
                  "& .cluster kbd": {
                    minWidth: "1.4rem",
                    height: "1.4rem",
                    p: "0 0.3rem",
                    fontSize: "0.62rem",
                  },
                }}
              >
                {t.caps === "cluster-arrows" ? (
                  <Box
                    className="cluster"
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.2rem",
                    }}
                  >
                    <Box sx={{ display: "flex", gap: "0.22rem", justifyContent: "center" }}>
                      <Kbd>{"\u2191"}</Kbd>
                    </Box>
                    <Box sx={{ display: "flex", gap: "0.22rem", justifyContent: "center" }}>
                      <Kbd>{"\u2190"}</Kbd>
                      <Kbd>{"\u2193"}</Kbd>
                      <Kbd>{"\u2192"}</Kbd>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", gap: "0.22rem", justifyContent: "center" }}>
                    {t.caps.map((c, i) => (
                      <Kbd key={i} round={t.round ? 1 : 0}>{c}</Kbd>
                    ))}
                  </Box>
                )}
              </Box>
              <Box
                sx={{
                  mt: "0.5rem",
                  fontFamily: ANTON,
                  fontSize: "0.8rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#fff",
                }}
              >
                {t.name}
              </Box>
              <Box
                sx={{
                  mt: "0.16rem",
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  letterSpacing: "0.11em",
                  textTransform: "uppercase",
                  color: ORANGE,
                }}
              >
                {t.hint}
              </Box>
            </Box>
          ))}
        </Box>

        <Typography
          sx={{
            mt: "0.85rem",
            fontFamily: MONO,
            fontSize: "0.64rem",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.38)",
            ...row(0.4),
          }}
        >
          {HINTS[tutorialVariant]}
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mt: "1.7rem",
            "@media (max-height: 700px)": { mt: "1.2rem" },
            ...row(0.48),
          }}
        >
          <ComicButton
            scheme="orange"
            size="medium"
            onDark
            data-cta="1"
            onClick={closeMenu}
          >
            {ctaLabel}
          </ComicButton>
        </Box>
      </Box>
    </Box>
  );
}
