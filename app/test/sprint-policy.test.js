import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

test("ships the verified DuckEMW fixed-head sprint policy", async () => {
  const bytes = await readFile(
    new URL("../public/policies/run.onnx", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "c542622d45175d5c5e7b4a90e661cb764ba6c11c7d14c272372dd60cac590401",
  );
});
