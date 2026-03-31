import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  summaryPath,
  validatePairEvidence,
  validateRunEvidence,
  validateSummaryEvidence
} from "./evidence-shared.mjs";

async function readJson(absPath) {
  return JSON.parse(await readFile(absPath, "utf8"));
}

async function main() {
  const root = process.cwd();
  const summary = await readJson(summaryPath(root));
  validateSummaryEvidence(summary);

  for (const entry of summary.tests) {
    const runA = await readJson(path.join(root, entry.run_a_ref));
    const runB = await readJson(path.join(root, entry.run_b_ref));
    const pair = await readJson(path.join(root, entry.pair_ref));
    validateRunEvidence(runA);
    validateRunEvidence(runB);
    validatePairEvidence(pair);
  }

  if (summary.overall_status !== "PASS_REPRODUCED") {
    throw new Error(`evidence summary is not reproduced: ${summary.overall_status}`);
  }

  console.log(`[EVIDENCE] VERIFIED ${summary.tests.length} reproduced test pairs`);
}

await main();
