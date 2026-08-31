import { signed } from "./signed.js";
import { parseWbcReferenceCsv } from "./wbc-reference.js";

const WBC_ROOT = "./wbc/microduck-wbc";

async function fetchOk(url, kind = "asset") {
  const response = await fetch(signed(url));
  if (!response.ok) {
    throw new Error(`WBC ${kind} fetch failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

function sameStrings(actual, expected) {
  return actual.length === expected.length && actual.every((value, i) => value === expected[i]);
}

function sameNumbers(actual, expected, tolerance = 1e-6) {
  return actual.length === expected.length &&
    actual.every((value, i) => Math.abs(value - expected[i]) <= tolerance);
}

export async function loadWbcRuntime({
  ort,
  sessionOptions,
  expectedJointNames,
  expectedDefaultJointPosition,
}) {
  const runtimeUrl = `${WBC_ROOT}/runtime.json`;
  const runtime = await (await fetchOk(runtimeUrl, "runtime config")).json();
  if (runtime.schema !== "microduck_wbc_runtime_v1") {
    throw new Error(`Unsupported WBC runtime schema: ${runtime.schema}`);
  }
  if (!sameStrings(runtime.jointNames, expectedJointNames)) {
    throw new Error("WBC policy joint order does not match the simulator model");
  }
  if (!sameNumbers(runtime.defaultJointPosition, expectedDefaultJointPosition)) {
    throw new Error("WBC policy default joint pose does not match the simulator model");
  }
  if (runtime.actionMode !== "reference_residual") {
    throw new Error(`Unsupported WBC action mode: ${runtime.actionMode}`);
  }
  const packedObservationSize = runtime.observationTerms.reduce((size, term) => {
    if (term.offset !== size) throw new Error(`WBC observation term is not packed: ${term.name}`);
    return size + term.size;
  }, 0);
  if (packedObservationSize !== runtime.observationSize ||
      runtime.actionSize !== expectedJointNames.length) {
    throw new Error("WBC observation/action dimensions do not match runtime.json");
  }

  const indexUrl = `${WBC_ROOT}/${runtime.referenceIndex}`;
  const [index, session] = await Promise.all([
    (await fetchOk(indexUrl, "reference index")).json(),
    ort.InferenceSession.create(signed(`${WBC_ROOT}/${runtime.policy}`), sessionOptions),
  ]);
  if (index.schema !== "microduck_wbc_reference_csv_v1" || index.robot !== "microduck") {
    throw new Error(`Unsupported WBC reference bundle: ${index.schema}/${index.robot}`);
  }
  if (index.commandDim !== runtime.referenceCommandSize || index.fps !== runtime.fps) {
    throw new Error("WBC reference stream dimensions or frequency do not match runtime.json");
  }
  if (!sameStrings(index.jointNames, expectedJointNames)) {
    throw new Error("WBC reference joint order does not match the policy");
  }
  if (!session.inputNames.includes(runtime.inputName) || !session.outputNames.includes(runtime.outputName)) {
    throw new Error("WBC ONNX input/output names do not match runtime.json");
  }

  const clips = index.clips.map((clip) => ({ ...clip }));
  const clipById = new Map(clips.map((clip) => [clip.id, clip]));
  if (!clipById.has(runtime.defaultClip)) {
    throw new Error(`WBC default clip is missing: ${runtime.defaultClip}`);
  }
  const cache = new Map();

  async function loadClip(id) {
    const meta = clipById.get(id);
    if (!meta) throw new Error(`Unknown WBC clip: ${id}`);
    let pending = cache.get(id);
    if (!pending) {
      pending = (async () => {
        const response = await fetchOk(`${WBC_ROOT}/reference/${meta.file}`, `clip ${id}`);
        const values = parseWbcReferenceCsv(await response.text(), {
          frames: meta.frames,
          width: runtime.referenceCommandSize,
          label: `clip ${id}`,
        });
        return { ...meta, values };
      })();
      cache.set(id, pending);
    }
    return pending;
  }

  return { runtime, index, clips, session, loadClip };
}
