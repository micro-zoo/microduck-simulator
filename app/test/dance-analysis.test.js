import test from "node:test";
import assert from "node:assert/strict";

import {
  DANCE_MOVES,
  analyzeDanceSamples,
  setTimelineMove,
  writeDanceCommand,
} from "../src/game/dance-analysis.js";

function pulseTrain({ bpm = 120, seconds = 18, sampleRate = 44100 }) {
  const samples = new Float32Array(seconds * sampleRate);
  const period = 60 / bpm;
  for (let beat = 0.12; beat < seconds; beat += period) {
    const start = Math.round(beat * sampleRate);
    // A short exponential transient resembles the part of a drum hit that
    // the browser analyser uses; changing its amplitude makes energy sections.
    const amplitude = beat > seconds * 0.55 ? 0.95 : 0.45;
    for (let n = 0; n < 100 && start + n < samples.length; n++) {
      samples[start + n] += amplitude * Math.exp(-n / 16);
    }
  }
  return { samples, sampleRate };
}

test("local audio analysis produces a policy-safe beat timeline", () => {
  const { samples, sampleRate } = pulseTrain({ bpm: 120 });
  const { timeline } = analyzeDanceSamples({ samples, sampleRate, name: "click track" });
  assert.ok(Math.abs(timeline.bpm - 120) <= 2, `estimated ${timeline.bpm} BPM`);
  assert.ok(timeline.beat_times.length >= 30);
  assert.ok(timeline.segments.length >= 4);
  for (const segment of timeline.segments) {
    assert.ok(segment.move >= 0 && segment.move < DANCE_MOVES.length);
    assert.ok(segment.t_end > segment.t_start);
  }
});

test("timeline edits feed the exact six dance command slots", () => {
  const { samples, sampleRate } = pulseTrain({ bpm: 120 });
  const { timeline } = analyzeDanceSamples({ samples, sampleRate });
  const edited = setTimelineMove(timeline, 0, 4);
  const command = new Float32Array(13).fill(99);
  const move = writeDanceCommand(command, edited, edited.segments[0].t_start);
  assert.equal(move, 4);
  assert.deepEqual([...command.slice(0, 7)], Array(7).fill(0));
  assert.ok(Math.abs(command[9] - edited.bpm / 120) < 1e-6);
  assert.deepEqual([...command.slice(10)], [0, 0, 1]);
});
