import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  REQUIRED_TEST_IDS,
  summaryPath,
  reconcilePairEvidence,
  resolveWithinRoot,
  validatePairEvidence,
  validateSummaryEvidence,
  verifyRunEvidenceAgainstDisk
} from "./evidence-shared.mjs";

async function readJson(absPath) {
  return JSON.parse(await readFile(absPath, "utf8"));
}

async function main() {
  const root = process.cwd();
  const summary = await readJson(summaryPath(root));
  validateSummaryEvidence(summary);

  const summaryIds = summary.tests.map((entry) => entry.test_id).sort((a, b) => a.localeCompare(b, "en"));
  const expectedIds = [...REQUIRED_TEST_IDS].sort((a, b) => a.localeCompare(b, "en"));
  if (JSON.stringify(summaryIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`required testline mismatch: expected ${expectedIds.join(", ")} got ${summaryIds.join(", ")}`);
  }

  const derivedStatuses = [];
  for (const entry of summary.tests) {
    const runAPath = resolveWithinRoot(root, entry.run_a_ref, `summary.tests.${entry.test_id}.run_a_ref`);
    const runBPath = resolveWithinRoot(root, entry.run_b_ref, `summary.tests.${entry.test_id}.run_b_ref`);
    const pairPath = resolveWithinRoot(root, entry.pair_ref, `summary.tests.${entry.test_id}.pair_ref`);
    const runA = await readJson(runAPath);
    const runB = await readJson(runBPath);
    const pair = await readJson(pairPath);

    await verifyRunEvidenceAgainstDisk(root, runA);
    await verifyRunEvidenceAgainstDisk(root, runB);
    validatePairEvidence(pair);
    const comparison = reconcilePairEvidence(runA, runB, pair);

    if (runA.test_id !== entry.test_id || runB.test_id !== entry.test_id) {
      throw new Error(`summary entry test_id mismatch for ${entry.test_id}`);
    }
    if (pair.test_id !== entry.test_id) {
      throw new Error(`pair test_id mismatch for ${entry.test_id}`);
    }
    if (path.parse(runAPath).name !== runA.run_id || path.parse(runBPath).name !== runB.run_id) {
      throw new Error(`run id mismatch for ${entry.test_id}`);
    }
    if (path.parse(pairPath).name !== pair.pair_id) {
      throw new Error(`pair id mismatch for ${entry.test_id}`);
    }
    if (entry.status !== pair.comparator_result) {
      throw new Error(`summary status mismatch for ${entry.test_id}: ${entry.status} !== ${pair.comparator_result}`);
    }

    derivedStatuses.push(comparison.comparator_result);
  }

  const derivedOverallStatus = derivedStatuses.find((status) => status !== "PASS_REPRODUCED") || "PASS_REPRODUCED";
  if (summary.overall_status !== derivedOverallStatus) {
    throw new Error(`evidence summary status mismatch: ${summary.overall_status} !== ${derivedOverallStatus}`);
  }
  if (derivedOverallStatus !== "PASS_REPRODUCED") {
    throw new Error(`evidence summary is not reproduced: ${derivedOverallStatus}`);
  }

  console.log(`[EVIDENCE] VERIFIED ${summary.tests.length} reproduced test pairs`);
}

await main();
