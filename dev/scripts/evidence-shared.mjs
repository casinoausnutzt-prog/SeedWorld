import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createMutFingerprint } from "../../app/src/kernel/fingerprint.js";

export const RUN_SCHEMA_VERSION = "2.0.0";
export const PAIR_SCHEMA_VERSION = "2.0.0";
export const SUMMARY_SCHEMA_VERSION = "2.0.0";

export const ALLOWED_STATUSES = new Set([
  "PASS_REPRODUCED",
  "FAIL_NONDETERMINISTIC",
  "FAIL_SEED_MISMATCH",
  "FAIL_EVIDENCE_MISSING",
  "FAIL_EVIDENCE_INVALID",
  "FAIL_SCOPE_VIOLATION",
  "FAIL_INTERNAL",
  "SKIP_EXPLICIT"
]);

export const REQUIRED_TEST_IDS = Object.freeze([
  "00-runtime-governance-suite",
  "10-determinism-seed-proof-suite",
  "20-gameplay-state-suite"
]);

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function evidenceRoot(root) {
  return path.join(root, "runtime", "evidence");
}

export function runsDir(root) {
  return path.join(evidenceRoot(root), "runs");
}

export function pairsDir(root) {
  return path.join(evidenceRoot(root), "pairs");
}

export function summaryPath(root) {
  return path.join(evidenceRoot(root), "summary.json");
}

export function finalSummaryPath(root) {
  return path.join(evidenceRoot(root), "final", "testline-summary.json");
}

export async function ensureEvidenceDirs(root) {
  await mkdir(runsDir(root), { recursive: true });
  await mkdir(pairsDir(root), { recursive: true });
  await mkdir(path.dirname(finalSummaryPath(root)), { recursive: true });
}

export function sha256HexSync(input) {
  return createHash("sha256").update(input).digest("hex");
}

export async function hashFiles(root, relPaths = []) {
  const entries = [];
  for (const relPath of [...relPaths].sort((a, b) => a.localeCompare(b, "en"))) {
    const absPath = path.join(root, relPath);
    const source = await readFile(absPath, "utf8");
    entries.push({
      path: relPath,
      hash: sha256HexSync(source)
    });
  }
  return {
    fingerprint: await createMutFingerprint(entries),
    files: entries
  };
}

export function createRunId(testId, label) {
  return `${testId}-${label}`;
}

export function createPairId(testId) {
  return `${testId}-pair`;
}

export function validateRunEvidence(evidence) {
  assert(evidence && typeof evidence === "object" && !Array.isArray(evidence), "run evidence must be an object");
  for (const key of [
    "schema_version",
    "test_id",
    "run_id",
    "seed",
    "seed_source",
    "content_revision",
    "kernel_revision",
    "timestamp",
    "deterministic_fingerprint",
    "output_hashes",
    "status",
    "environment_summary"
  ]) {
    assert(key in evidence, `missing run evidence field: ${key}`);
  }
  assert(evidence.schema_version === RUN_SCHEMA_VERSION, "unexpected run schema version");
  assert(ALLOWED_STATUSES.has(evidence.status), `invalid run status: ${String(evidence.status)}`);
}

export function validatePairEvidence(evidence) {
  assert(evidence && typeof evidence === "object" && !Array.isArray(evidence), "pair evidence must be an object");
  for (const key of [
    "schema_version",
    "pair_id",
    "test_id",
    "run_a_ref",
    "run_b_ref",
    "seed_match",
    "fingerprint_match",
    "content_match",
    "comparator_result",
    "comparator_reason"
  ]) {
    assert(key in evidence, `missing pair evidence field: ${key}`);
  }
  assert(evidence.schema_version === PAIR_SCHEMA_VERSION, "unexpected pair schema version");
  assert(ALLOWED_STATUSES.has(evidence.comparator_result), `invalid pair status: ${String(evidence.comparator_result)}`);
}

export function validateSummaryEvidence(summary) {
  assert(summary && typeof summary === "object" && !Array.isArray(summary), "summary must be an object");
  for (const key of ["schema_version", "generated_at", "tests", "overall_status"]) {
    assert(key in summary, `missing summary field: ${key}`);
  }
  assert(summary.schema_version === SUMMARY_SCHEMA_VERSION, "unexpected summary schema version");
  assert(Array.isArray(summary.tests), "summary.tests must be an array");
}

export function compareRunEvidence(runA, runB) {
  validateRunEvidence(runA);
  validateRunEvidence(runB);

  const seedMatch = runA.seed === runB.seed && runA.seed_source === runB.seed_source;
  if (!seedMatch) {
    return {
      seed_match: false,
      fingerprint_match: false,
      content_match: false,
      comparator_result: "FAIL_SEED_MISMATCH",
      comparator_reason: "seed or seed_source differs"
    };
  }

  const contentMatch =
    runA.content_revision?.fingerprint === runB.content_revision?.fingerprint &&
    runA.kernel_revision?.fingerprint === runB.kernel_revision?.fingerprint;
  if (!contentMatch) {
    return {
      seed_match: true,
      fingerprint_match: false,
      content_match: false,
      comparator_result: "FAIL_EVIDENCE_INVALID",
      comparator_reason: "content_revision or kernel_revision differs"
    };
  }

  const fingerprintMatch = runA.deterministic_fingerprint === runB.deterministic_fingerprint;
  if (!fingerprintMatch) {
    return {
      seed_match: true,
      fingerprint_match: false,
      content_match: true,
      comparator_result: "FAIL_NONDETERMINISTIC",
      comparator_reason: "deterministic fingerprint differs"
    };
  }

  return {
    seed_match: true,
    fingerprint_match: true,
    content_match: true,
    comparator_result: "PASS_REPRODUCED",
    comparator_reason: "run A and run B reproduced exactly"
  };
}

export async function writeJson(absPath, payload) {
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
