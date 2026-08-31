import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { OFFICIAL_POLICY_CATALOG } from "../src/game/constants.js";

const DEPLOYMENT_SHA256 = {
  walk: "e36332d383997d51401897734cd3e79cf5038406feddb18b4d57ecfb141daa6c",
  stand: "1569268713e40deea795dd2922dba50d3621e15a872855408b6b1b125b1c094b",
  sitstand: "c6c40e35e726eabd803d633e090d112994f469921152448367953fbaf9799bc8",
  groundpick: "ffbf5109982ff999b0ba53afe86b9ae731bbec679d67fb7f8ab4c52152c88872",
  kickL: "d6928284dccd3dd61e08bf2f760effa74309fbefd97b2b31afb2a60f526d196a",
  kickR: "147a32c388c6b19111b3ac3b550a9a6dc8b8bf267118af4d8c3712522eedb5af",
  roll: "3d60da08fc13f29c1b57f41977aa898132c0d60042100149d8e775affcbca32b",
  drive: "cf05651d2708a2f9364212e86b866c97a70ace8131c492500105e8f28bf99afd",
  crouch: "a1a084be240469c76ac9d3fa44d4792f16d4b1da60398b3ecd3cfc5e2244d990",
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("ships every default 61D policy resolved by microduck deployment", async () => {
  assert.deepEqual(OFFICIAL_POLICY_CATALOG.map((policy) => policy.id), Object.keys(DEPLOYMENT_SHA256));
  assert.deepEqual(
    OFFICIAL_POLICY_CATALOG.filter((policy) => policy.mode === "rollers").map((policy) => policy.id),
    ["drive"],
    "roller mode must schedule exactly one policy",
  );
  assert.equal(
    OFFICIAL_POLICY_CATALOG.find((policy) => policy.id === "crouch")?.mode,
    "not-scheduled",
    "the official crouch asset is inventoried but not exposed as a roller action",
  );
  for (const policy of OFFICIAL_POLICY_CATALOG) {
    const relative = policy.asset.replace(/^\.\//, "");
    const bytes = await readFile(new URL(`../public/${relative}`, import.meta.url));
    assert.equal(sha256(bytes), DEPLOYMENT_SHA256[policy.id], policy.id);
  }
});

test("ships the deployment WBC policy byte-for-byte", async () => {
  const bytes = await readFile(
    new URL("../public/wbc/microduck-wbc/policy.onnx", import.meta.url),
  );
  assert.equal(
    sha256(bytes),
    "d207ee5742738263c5b45be7bb72c3eff7242a772f4e06b99aeaba308c360047",
  );
});
