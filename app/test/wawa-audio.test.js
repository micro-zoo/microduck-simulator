import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ships Wawa audio and starts preloading it before input", async () => {
  const [audio, game] = await Promise.all([
    readFile(new URL("../public/assets/voices/wawa.mp3", import.meta.url)),
    readFile(new URL("../src/game/game.js", import.meta.url), "utf8"),
  ]);
  assert.ok(audio.byteLength > 0, "Wawa audio must be published with the app");
  assert.match(game, /new Audio\(signed\("\.\/assets\/voices\/wawa\.mp3"\)\)/);
  assert.match(game, /wawaAudio\.preload = "auto";/);
  assert.match(game, /wawaAudio\.load\(\);/);
  assert.match(game, /const wawaLoud = \(\) => \{[\s\S]*?quackAt = performance\.now\(\);/);
});
