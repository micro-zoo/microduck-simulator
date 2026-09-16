// Browser-side music analysis and choreography for the beat-conditioned
// Microduck dance policy.  The policy was trained on a fixed BPM/grid command,
// so the browser intentionally produces one stable tempo and phase origin
// rather than feeding it jittery per-beat corrections.

export const DANCE_MOVES = Object.freeze([
  "squat_bounce",
  "weight_shift",
  "head_bob",
  "climax",
  "call_out",
]);

export const DANCE_BPM_MIN = 90;
export const DANCE_BPM_MAX = 140;
const FRAME_SIZE = 1024;
const HOP_SIZE = 512;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function percentile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * q), 0, sorted.length - 1);
  return sorted[index];
}

function median(values) {
  return percentile(values, 0.5);
}

/** Mix a decoded Web Audio buffer to mono without retaining the source file. */
export function mixAudioBuffer(audioBuffer) {
  const mono = new Float32Array(audioBuffer.length);
  const channels = Math.max(1, audioBuffer.numberOfChannels);
  for (let channel = 0; channel < channels; channel++) {
    const samples = audioBuffer.getChannelData(channel);
    for (let i = 0; i < mono.length; i++) mono[i] += samples[i] / channels;
  }
  return mono;
}

// RMS energy plus its positive log-difference is deliberately lightweight:
// it works in every browser (no WASM or upload), and punchy transients are
// the cue that matters for the trained robot's beat grid.
export function makeEnergyEnvelope(samples, sampleRate) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Invalid audio sample rate");
  if (!samples?.length) throw new Error("The audio file contains no samples");
  const count = Math.max(1, Math.floor((samples.length - 1) / HOP_SIZE) + 1);
  const energy = new Float32Array(count);
  for (let frame = 0; frame < count; frame++) {
    const start = frame * HOP_SIZE;
    const end = Math.min(samples.length, start + FRAME_SIZE);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    energy[frame] = Math.sqrt(sum / Math.max(1, end - start));
  }

  const novelty = new Float32Array(count);
  const logEnergy = new Float32Array(count);
  for (let i = 0; i < count; i++) logEnergy[i] = Math.log(1e-7 + energy[i]);
  for (let i = 1; i < count; i++) novelty[i] = Math.max(0, logEnergy[i] - logEnergy[i - 1]);
  // A short triangular smoothing removes frame-scale quantisation without
  // smearing adjacent 90–140 BPM beats (separated by 8+ frames at 44.1 kHz).
  const smoothed = new Float32Array(count);
  for (let i = 1; i < count - 1; i++) {
    smoothed[i] = (novelty[i - 1] + 2 * novelty[i] + novelty[i + 1]) * 0.25;
  }
  return { energy, novelty: smoothed, hopSeconds: HOP_SIZE / sampleRate };
}

function tempoScore(novelty, lag) {
  let score = 0;
  for (let i = 0; i + lag + 1 < novelty.length; i++) {
    const index = i + Math.floor(lag);
    const fraction = lag % 1;
    const atLag = novelty[index] + (novelty[index + 1] - novelty[index]) * fraction;
    score += novelty[i] * atLag;
  }
  return score;
}

/**
 * Pick a policy-safe global tempo.  Searching the trained 90–140 BPM range
 * avoids half/double tempo ambiguity and keeps tempo_norm in its curriculum.
 */
export function estimateTempo(novelty, hopSeconds) {
  if (novelty.length < 16) throw new Error("Audio is too short to estimate a beat");
  let best = { bpm: 120, score: -Infinity };
  let runnerUp = { score: -Infinity };
  for (let bpm = DANCE_BPM_MIN; bpm <= DANCE_BPM_MAX; bpm += 1) {
    const score = tempoScore(novelty, 60 / bpm / hopSeconds);
    if (score > best.score) {
      runnerUp = best;
      best = { bpm, score };
    } else if (score > runnerUp.score) {
      runnerUp = { bpm, score };
    }
  }
  const confidence = best.score > 1e-8
    ? clamp((best.score - Math.max(0, runnerUp.score)) / best.score, 0, 1)
    : 0;
  return { ...best, confidence };
}

function phaseScore(novelty, hopSeconds, period, phase) {
  const sigma = Math.min(0.07, period * 0.14);
  let score = 0;
  for (let i = 0; i < novelty.length; i++) {
    if (!novelty[i]) continue;
    const time = i * hopSeconds;
    let delta = (time - phase) % period;
    if (delta > period / 2) delta -= period;
    if (delta < -period / 2) delta += period;
    score += novelty[i] * Math.exp(-(delta * delta) / (2 * sigma * sigma));
  }
  return score;
}

/** Find the grid offset whose beats align best with onset energy. */
export function estimateBeatOrigin(novelty, hopSeconds, bpm) {
  const period = 60 / bpm;
  const candidates = [];
  const threshold = percentile(Array.from(novelty), 0.82);
  for (let i = 1; i < novelty.length - 1; i++) {
    if (novelty[i] >= threshold && novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1]) {
      candidates.push((i * hopSeconds) % period);
    }
  }
  // A quiet track may have few local maxima; a regular phase sweep remains a
  // useful fallback and makes the output deterministic.
  for (let p = 0; p < period; p += Math.max(hopSeconds, 0.01)) candidates.push(p);
  let bestPhase = 0;
  let bestScore = -Infinity;
  for (const phase of candidates) {
    const score = phaseScore(novelty, hopSeconds, period, phase);
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  return bestPhase;
}

function meanBetween(values, hopSeconds, start, end) {
  const from = clamp(Math.floor(start / hopSeconds), 0, values.length - 1);
  const to = clamp(Math.ceil(end / hopSeconds), from + 1, values.length);
  let sum = 0;
  for (let i = from; i < to; i++) sum += values[i];
  return sum / Math.max(1, to - from);
}

function chooseMove({ index, energy, previousEnergy, low, mid, high }) {
  const rise = energy - previousEnergy;
  if (energy >= high) return 3; // climax for the loudest passages
  if (rise > Math.max((high - low) * 0.24, 0.008)) return 4; // transition accent
  if (energy <= low) return index % 2 ? 2 : 1; // restrained intro/breakdown
  if (energy >= mid) return index % 2 ? 0 : 2;
  return index % 2 ? 1 : 0;
}

/**
 * Build DuckEMW-compatible segments.  Energy informs choreography but never
 * changes phase timing: exactly what the beat-conditioned network trained on.
 */
export function makeEnergyChoreography({ name, bpm, t0, duration, energy, hopSeconds }) {
  const period = 60 / bpm;
  const beatTimes = [];
  for (let time = t0; time < duration - 1e-6; time += period) {
    beatTimes.push(Number(time.toFixed(4)));
  }
  if (beatTimes.length < 8) throw new Error("Need at least eight detected beats to build a dance timeline");

  const rawEnergies = [];
  for (let start = 0; start < beatTimes.length; start += 8) {
    const endBeat = Math.min(start + 7, beatTimes.length - 1);
    const end = endBeat + 1 < beatTimes.length ? beatTimes[endBeat + 1] : duration;
    rawEnergies.push(meanBetween(energy, hopSeconds, beatTimes[start], end));
  }
  const low = percentile(rawEnergies, 0.28);
  const mid = median(rawEnergies);
  const high = percentile(rawEnergies, 0.76);
  const span = Math.max(1e-8, percentile(rawEnergies, 0.9) - percentile(rawEnergies, 0.1));
  let previousEnergy = rawEnergies[0] ?? 0;
  const segments = rawEnergies.map((segmentEnergy, index) => {
    const startBeat = index * 8;
    const endBeat = Math.min(startBeat + 7, beatTimes.length - 1);
    const move = chooseMove({ index, energy: segmentEnergy, previousEnergy, low, mid, high });
    previousEnergy = segmentEnergy;
    return {
      move,
      move_name: DANCE_MOVES[move],
      start_beat: startBeat,
      end_beat: endBeat,
      t_start: beatTimes[startBeat],
      t_end: endBeat + 1 < beatTimes.length ? beatTimes[endBeat + 1] : Number(duration.toFixed(3)),
      energy: Number(clamp((segmentEnergy - low) / span, 0, 1).toFixed(3)),
    };
  });

  return {
    name,
    bpm: Number(bpm.toFixed(2)),
    beat_times: beatTimes,
    t0: Number(t0.toFixed(4)),
    duration: Number(duration.toFixed(3)),
    segments,
  };
}

/** Decode-free analysis entry point: easy to test and safe to run locally. */
export function analyzeDanceSamples({ samples, sampleRate, name = "local track" }) {
  const { energy, novelty, hopSeconds } = makeEnergyEnvelope(samples, sampleRate);
  const { bpm, confidence } = estimateTempo(novelty, hopSeconds);
  const t0 = estimateBeatOrigin(novelty, hopSeconds, bpm);
  const duration = samples.length / sampleRate;
  const timeline = makeEnergyChoreography({ name, bpm, t0, duration, energy, hopSeconds });
  return {
    timeline,
    confidence,
    envelope: { energy, hopSeconds },
  };
}

export function setTimelineMove(timeline, segmentIndex, move) {
  const moveId = Number(move);
  if (!Number.isInteger(moveId) || moveId < 0 || moveId >= DANCE_MOVES.length) {
    throw new Error(`Unknown dance move: ${move}`);
  }
  return {
    ...timeline,
    segments: timeline.segments.map((segment, index) => index === segmentIndex
      ? { ...segment, move: moveId, move_name: DANCE_MOVES[moveId] }
      : segment),
  };
}

function moveAt(timeline, time) {
  let selected = timeline.segments[0];
  for (const segment of timeline.segments) {
    if (time >= segment.t_start) selected = segment;
    else break;
  }
  return selected;
}

/** Write the exact training command into cmd[7..12], leaving all else zero. */
export function writeDanceCommand(command, timeline, time) {
  command.fill(0);
  const safeTime = clamp(Number(time) || 0, 0, timeline.duration);
  const beats = (safeTime - timeline.t0) * timeline.bpm / 60;
  command[7] = Math.sin(Math.PI * beats);
  command[8] = Math.cos(Math.PI * beats);
  command[9] = timeline.bpm / 120;
  const move = moveAt(timeline, safeTime)?.move ?? 0;
  command[10] = move & 1 ? 1 : 0;
  command[11] = move & 2 ? 1 : 0;
  command[12] = move & 4 ? 1 : 0;
  return move;
}
