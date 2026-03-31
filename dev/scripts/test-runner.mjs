import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { strict as assert } from "node:assert";
import {
  REQUIRED_TEST_IDS,
  RUN_SCHEMA_VERSION,
  PAIR_SCHEMA_VERSION,
  SUMMARY_SCHEMA_VERSION,
  ensureEvidenceDirs,
  runsDir,
  pairsDir,
  summaryPath,
  createRunId,
  createPairId,
  hashFiles,
  compareRunEvidence,
  validateRunEvidence,
  validatePairEvidence,
  writeJson
} from "./evidence-shared.mjs";
import { createMutFingerprint } from "../../app/src/kernel/fingerprint.js";

const root = process.cwd();
const modulesDir = path.join(root, "dev", "tests", "modules");

async function loadModules() {
  const entries = await readdir(modulesDir, { withFileTypes: true });
  const modules = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".module.mjs")) {
      continue;
    }
    const mod = await import(pathToFileURL(path.join(modulesDir, entry.name)).href);
    modules.push(mod);
  }
  modules.sort((a, b) => String(a.id).localeCompare(String(b.id), "en"));
  return modules;
}

function environmentSummary() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch
  };
}

async function executeRun(mod, label) {
  const testId = String(mod.id);
  const runId = createRunId(testId, label);
  const seed = typeof mod.seed === "string" && mod.seed.trim() ? mod.seed.trim() : `${testId}-seed`;
  const seedSource = typeof mod.seedSource === "string" && mod.seedSource.trim() ? mod.seedSource.trim() : "test-vector";
  const authority = mod.authority || {};
  const kernelRevision = await hashFiles(root, Array.isArray(authority.kernelPaths) ? authority.kernelPaths : []);
  const contentRevision = await hashFiles(root, Array.isArray(authority.contentPaths) ? authority.contentPaths : []);

  let outputs = null;
  let status = "PASS_REPRODUCED";
  let reasonCode = null;

  try {
    outputs = await mod.runEvidence({ root, assert, seed });
  } catch (error) {
    status = "FAIL_INTERNAL";
    reasonCode = String(error?.message || error);
    outputs = {
      error: reasonCode
    };
  }

  const outputHashes = {
    payload: await createMutFingerprint(outputs)
  };
  const evidence = {
    schema_version: RUN_SCHEMA_VERSION,
    test_id: testId,
    run_id: runId,
    seed,
    seed_source: seedSource,
    content_revision: contentRevision,
    kernel_revision: kernelRevision,
    timestamp: new Date().toISOString(),
    deterministic_fingerprint: outputHashes.payload,
    output_hashes: outputHashes,
    output_snapshots: outputs,
    status,
    reason_code: reasonCode,
    environment_summary: environmentSummary()
  };
  validateRunEvidence(evidence);
  const filePath = path.join(runsDir(root), `${runId}.json`);
  await writeJson(filePath, evidence);
  return { evidence, filePath };
}

function overallFromPairs(pairs) {
  const firstFailure = pairs.find((entry) => entry.status !== "PASS_REPRODUCED");
  return firstFailure ? firstFailure.status : "PASS_REPRODUCED";
}

async function main() {
  await ensureEvidenceDirs(root);
  const modules = await loadModules();
  const presentIds = modules.map((mod) => String(mod.id));
  for (const requiredId of REQUIRED_TEST_IDS) {
    if (!presentIds.includes(requiredId)) {
      throw new Error(`required test module missing: ${requiredId}`);
    }
  }

  const summary = {
    schema_version: SUMMARY_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    tests: [],
    overall_status: "PASS_REPRODUCED"
  };

  for (const mod of modules) {
    const runA = await executeRun(mod, "run-a");
    const runB = await executeRun(mod, "run-b");
    const comparison = compareRunEvidence(runA.evidence, runB.evidence);
    const pairEvidence = {
      schema_version: PAIR_SCHEMA_VERSION,
      pair_id: createPairId(mod.id),
      test_id: mod.id,
      run_a_ref: path.relative(root, runA.filePath),
      run_b_ref: path.relative(root, runB.filePath),
      seed_match: comparison.seed_match,
      fingerprint_match: comparison.fingerprint_match,
      content_match: comparison.content_match,
      comparator_result: comparison.comparator_result,
      comparator_reason: comparison.comparator_reason
    };
    validatePairEvidence(pairEvidence);

    const pairPath = path.join(pairsDir(root), `${pairEvidence.pair_id}.json`);
    await writeJson(pairPath, pairEvidence);
    summary.tests.push({
      test_id: mod.id,
      run_a_ref: pairEvidence.run_a_ref,
      run_b_ref: pairEvidence.run_b_ref,
      pair_ref: path.relative(root, pairPath),
      status: pairEvidence.comparator_result
    });
  }

  summary.overall_status = overallFromPairs(summary.tests);
  await writeJson(summaryPath(root), summary);

  if (summary.overall_status !== "PASS_REPRODUCED") {
    process.exitCode = 1;
  }
}

await main();
