import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { POLICIES } from "../src/game/constants.js";

test("ships the verified beat-conditioned dance policy", async () => {
  assert.equal(POLICIES.dance, "./policies/microduck_dance_4000.onnx");
  const bytes = await readFile(
    new URL("../public/policies/microduck_dance_4000.onnx", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "e185910d798db771106ae4654f28e4aec2cca170f4a9ae21fc294224d79b3a5d",
  );
});
