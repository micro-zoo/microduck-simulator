import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseWbcReferenceCsv } from "../src/game/wbc-reference.js";

const referenceRoot = new URL("../public/wbc/microduck-wbc/reference/", import.meta.url);

test("all published WBC motions obey the deployment CSV contract", async () => {
  const index = JSON.parse(await readFile(new URL("index.json", referenceRoot), "utf8"));
  assert.equal(index.schema, "microduck_wbc_reference_csv_v1");
  assert.equal(index.commandDim, 24);
  assert.equal(index.fps, 50);
  assert.deepEqual(index.clips.map(({ file }) => file), [
    "wbc_happy.csv",
    "wbc_curious.csv",
    "wbc_happy_bob.csv",
    "wbc_wiggle.csv",
  ]);
  for (const clip of index.clips) {
    const text = await readFile(new URL(clip.file, referenceRoot), "utf8");
    const values = parseWbcReferenceCsv(text, {
      frames: clip.frames,
      width: index.commandDim,
      label: clip.id,
    });
    assert.equal(values.length, clip.frames * index.commandDim);
  }
});

test("WBC CSV parsing rejects headers, wrong widths and non-finite values", () => {
  assert.throws(
    () => parseWbcReferenceCsv("ref_base_height,0\n", { frames: 1, width: 2 }),
    /not finite/,
  );
  assert.throws(
    () => parseWbcReferenceCsv("0,1,2\n", { frames: 1, width: 2 }),
    /3 columns, expected 2/,
  );
  assert.throws(
    () => parseWbcReferenceCsv("0,NaN\n", { frames: 1, width: 2 }),
    /not finite/,
  );
});
