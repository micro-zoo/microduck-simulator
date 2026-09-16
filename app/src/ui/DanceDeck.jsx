// Local-music Dance Lab.  It deliberately uses the browser's decodeAudioData
// API: the selected music file is never uploaded or persisted by the app.
import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useGame, gameApi } from "../store.js";
import {
  DANCE_MOVES,
  analyzeDanceSamples,
  mixAudioBuffer,
  setTimelineMove,
} from "../game/dance-analysis.js";
import { ORANGE, MONO } from "../theme.js";
import { ANTON, COMIC_INK, CREAM } from "./comic.jsx";

const MOVE_LABELS = ["Bounce", "Shift", "Head bob", "Climax", "Call out"];

const panelSx = {
  position: "fixed",
  left: "1.5rem",
  bottom: "1.15rem",
  zIndex: 11,
  width: "min(25rem, calc(100vw - 3rem))",
  border: `2px solid ${CREAM}`,
  boxShadow: `3px 3px 0 ${COMIC_INK}, inset 0 0 0 1px ${COMIC_INK}`,
  background: "rgba(8, 8, 12, 0.91)",
  color: CREAM,
  "@media (max-width: 900px)": {
    bottom: "5.35rem",
    left: "1rem",
    width: "min(25rem, calc(100vw - 2rem))",
  },
};

const buttonSx = {
  appearance: "none",
  border: `1px solid ${CREAM}`,
  borderRadius: 0,
  minHeight: "2rem",
  px: "0.62rem",
  background: "transparent",
  color: CREAM,
  cursor: "pointer",
  fontFamily: ANTON,
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  "&:hover:not(:disabled)": { background: "rgba(255, 122, 47, 0.16)", color: ORANGE },
  "&:disabled": { opacity: 0.42, cursor: "wait" },
  "&:focus-visible": { outline: `2px dashed ${ORANGE}`, outlineOffset: 2 },
};

const formatTime = (seconds = 0) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const confidenceLabel = (confidence) => confidence >= 0.3 ? "strong" : confidence >= 0.12 ? "usable" : "check beats";

export default function DanceDeck() {
  const danceLoading = useGame((s) => s.danceLoading);
  const danceError = useGame((s) => s.danceError);
  const danceStatus = useGame((s) => s.danceStatus);
  const danceMove = useGame((s) => s.danceMove);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const audioContextRef = useRef(null);

  const stopController = () => gameApi.stopDance?.({ pauseAudio: false });

  const disposeAudio = () => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onpause = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  useEffect(() => () => {
    stopController();
    disposeAudio();
    audioContextRef.current?.close?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) setTime(audio.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const stop = ({ resetTime = true } = {}) => {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
    if (audio && resetTime) audio.currentTime = 0;
    setTime(resetTime ? 0 : audio?.currentTime ?? 0);
    setPlaying(false);
    stopController();
  };

  const selectFile = (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    stop();
    disposeAudio();
    setFile(nextFile);
    setTimeline(null);
    setAnalysis(null);
    setError(null);
  };

  const analyze = async () => {
    if (!file) return;
    stop();
    disposeAudio();
    setAnalysing(true);
    setError(null);
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) throw new Error("This browser cannot decode local audio");
      audioContextRef.current ??= new AudioContextCtor();
      const encoded = await file.arrayBuffer();
      const buffer = await audioContextRef.current.decodeAudioData(encoded.slice(0));
      const result = analyzeDanceSamples({
        samples: mixAudioBuffer(buffer),
        sampleRate: buffer.sampleRate,
        name: file.name.replace(/\.[^.]+$/, "") || "local track",
      });
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.onended = () => {
        setPlaying(false);
        setTime(result.timeline.duration);
        stopController();
      };
      audio.onpause = () => {
        // A user pause must freeze the policy too; otherwise it would hold a
        // static dance target while the music has stopped.
        if (!audio.ended) stopController();
        setPlaying(false);
      };
      objectUrlRef.current = url;
      audioRef.current = audio;
      setTimeline(result.timeline);
      setAnalysis({ confidence: result.confidence });
      setTime(0);
    } catch (caught) {
      setError(caught?.message || String(caught));
    } finally {
      setAnalysing(false);
    }
  };

  const start = async () => {
    const audio = audioRef.current;
    if (!audio || !timeline) return;
    setError(null);
    try {
      // HTMLMediaElement.play() does not consistently rewind an ended blob
      // source across browsers.  A second Play dance must start on beat zero,
      // not immediately resolve at the final timestamp.
      if (audio.ended || audio.currentTime >= timeline.duration - 0.01) {
        audio.currentTime = 0;
        setTime(0);
      }
      const ready = await gameApi.startDance?.(timeline, {
        clock: () => audio.currentTime,
        pauseAudio: () => audio.pause(),
      });
      if (!ready) throw new Error("The dance policy could not start");
      await audio.play();
      setPlaying(true);
    } catch (caught) {
      stopController();
      setError(caught?.message || String(caught));
    }
  };

  const editMove = (index, move) => {
    if (playing) return;
    setTimeline((current) => setTimelineMove(current, index, move));
  };

  const totalDuration = timeline?.duration ?? 0;
  const progress = totalDuration ? Math.min(100, (time / totalDuration) * 100) : 0;
  const shownError = error || danceError;

  return (
    <Box sx={panelSx} aria-label="Dance Lab">
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "2.7rem", px: "0.72rem", background: ORANGE, color: COMIC_INK }}>
        <Box>
          <Typography component="div" sx={{ fontFamily: ANTON, fontSize: "0.93rem", letterSpacing: "0.1em", lineHeight: 1 }}>
            Dance Lab
          </Typography>
          <Typography component="div" sx={{ mt: "0.14rem", fontFamily: MONO, fontSize: "0.49rem", letterSpacing: "0.08em", lineHeight: 1.2 }}>
            LOCAL AUDIO · BEAT + ENERGY CHOREOGRAPHY
          </Typography>
        </Box>
        <Box component="button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} sx={{ ...buttonSx, minHeight: "1.72rem", borderColor: COMIC_INK, color: COMIC_INK, "&:hover:not(:disabled)": { color: COMIC_INK, background: "rgba(255,255,255,0.25)" } }}>
          {open ? "Hide" : "Open"}
        </Box>
      </Box>

      {open ? (
        <Box sx={{ p: "0.74rem" }}>
          <Typography sx={{ mb: "0.58rem", color: "rgba(250,248,242,0.72)", fontSize: "0.72rem", lineHeight: 1.45 }}>
            Choose a track. It is decoded only in this browser, then mapped to a 90–140 BPM dance timeline.
          </Typography>
          <Box sx={{ display: "flex", gap: "0.45rem", alignItems: "center", mb: "0.55rem" }}>
            <Box component="label" sx={{ ...buttonSx, display: "inline-flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <input type="file" accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac" onChange={selectFile} hidden />
              <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file ? file.name : "Choose music"}
              </Box>
            </Box>
            <Box component="button" type="button" onClick={analyze} disabled={!file || analysing || danceLoading} sx={{ ...buttonSx, background: ORANGE, color: COMIC_INK, borderColor: ORANGE }}>
              {analysing ? "Reading…" : "Analyze"}
            </Box>
          </Box>

          {timeline ? (
            <>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", mb: "0.62rem", border: "1px solid rgba(250,248,242,0.22)", background: "rgba(250,248,242,0.22)" }}>
                {[
                  ["Tempo", `${timeline.bpm} BPM`],
                  ["Beat grid", `${timeline.beat_times.length} beats`],
                  ["Signal", confidenceLabel(analysis?.confidence ?? 0)],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ p: "0.38rem", background: "rgba(8,8,12,0.8)" }}>
                    <Box sx={{ fontFamily: MONO, fontSize: "0.47rem", letterSpacing: "0.08em", color: "rgba(250,248,242,0.5)", textTransform: "uppercase" }}>{label}</Box>
                    <Box sx={{ mt: "0.08rem", fontFamily: ANTON, fontSize: "0.72rem", letterSpacing: "0.04em", color: ORANGE }}>{value}</Box>
                  </Box>
                ))}
              </Box>

              <Box sx={{ mb: "0.56rem" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: "0.24rem", fontFamily: MONO, fontSize: "0.52rem", color: "rgba(250,248,242,0.58)", fontVariantNumeric: "tabular-nums" }}>
                  <span>{formatTime(time)}</span><span>{formatTime(totalDuration)}</span>
                </Box>
                <Box sx={{ height: "0.33rem", background: "rgba(250,248,242,0.19)", border: "1px solid rgba(250,248,242,0.42)" }}>
                  <Box sx={{ width: `${progress}%`, height: "100%", background: ORANGE, transition: playing ? "none" : "width 0.15s ease" }} />
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: "0.45rem", mb: "0.62rem" }}>
                <Box component="button" type="button" onClick={start} disabled={playing || danceLoading} sx={{ ...buttonSx, flex: 1, background: ORANGE, color: COMIC_INK, borderColor: ORANGE }}>
                  {danceLoading ? "Loading policy…" : playing ? "Dancing" : "Play dance"}
                </Box>
                <Box component="button" type="button" onClick={() => stop({ resetTime: false })} disabled={!playing} sx={{ ...buttonSx, flex: "0 0 auto" }}>Pause</Box>
                <Box component="button" type="button" onClick={() => stop()} disabled={!playing && time === 0} sx={{ ...buttonSx, flex: "0 0 auto" }}>Stop</Box>
              </Box>

              <Box sx={{ borderTop: "1px solid rgba(250,248,242,0.22)", pt: "0.52rem" }}>
                <Box sx={{ mb: "0.34rem", fontFamily: MONO, fontSize: "0.51rem", letterSpacing: "0.09em", color: "rgba(250,248,242,0.58)", textTransform: "uppercase" }}>
                  Energy choreography · edit before playing
                </Box>
                <Box sx={{ maxHeight: "8.8rem", overflowY: "auto", pr: "0.12rem", display: "grid", gap: "0.22rem" }}>
                  {timeline.segments.map((segment, index) => (
                    <Box key={`${segment.start_beat}-${index}`} sx={{ display: "grid", gridTemplateColumns: "2.2rem 1fr 2.8rem", gap: "0.38rem", alignItems: "center", p: "0.27rem 0.32rem", background: danceMove === segment.move_name && playing ? "rgba(255,122,47,0.18)" : "rgba(250,248,242,0.05)" }}>
                      <Box sx={{ fontFamily: MONO, fontSize: "0.5rem", color: "rgba(250,248,242,0.6)", fontVariantNumeric: "tabular-nums" }}>
                        {formatTime(segment.t_start)}
                      </Box>
                      <Box component="select" value={segment.move} disabled={playing} onChange={(event) => editMove(index, event.target.value)} aria-label={`Dance section ${index + 1}`} sx={{ minWidth: 0, height: "1.55rem", border: "1px solid rgba(250,248,242,0.48)", borderRadius: 0, background: "#111119", color: CREAM, fontFamily: MONO, fontSize: "0.62rem", "&:disabled": { opacity: 0.72 }, "& option": { color: COMIC_INK, background: CREAM } }}>
                        {DANCE_MOVES.map((move, moveId) => <option key={move} value={moveId}>{MOVE_LABELS[moveId]}</option>)}
                      </Box>
                      <Box sx={{ height: "0.52rem", border: "1px solid rgba(250,248,242,0.28)", background: "rgba(250,248,242,0.1)" }} title={`Energy ${Math.round((segment.energy ?? 0) * 100)}%`}>
                        <Box sx={{ width: `${Math.max(5, (segment.energy ?? 0) * 100)}%`, height: "100%", background: ORANGE }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </>
          ) : null}

          {shownError ? <Box role="alert" sx={{ mt: "0.55rem", color: "#ff8c8c", fontFamily: MONO, fontSize: "0.59rem", lineHeight: 1.35 }}>{shownError}</Box> : null}
          {danceStatus === "dancing" && danceMove ? <Box sx={{ mt: "0.5rem", color: ORANGE, fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Now: {danceMove.replaceAll("_", " ")}</Box> : null}
        </Box>
      ) : null}
    </Box>
  );
}
