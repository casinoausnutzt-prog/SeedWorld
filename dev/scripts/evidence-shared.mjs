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

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertString(value, message) {
  assert(typeof value === "string" && value.length > 0, message);
}

function assertBoolean(value, message) {
  assert(typeof value === "boolean", message);
}

export function resolveWithinRoot(root, relPath, context = "path") {
  assertString(root, "root must be a non-empty string");
  assertString(relPath, `${context} must be a non-empty string`);

  const absRoot = path.resolve(root);
  const absPath = path.resolve(absRoot, relPath);
  const relative = path.relative(absRoot, absPath);

  assert(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `${context} escapes repository root: ${relPath}`
  );

  return absPath;
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
    const absPath = resolveWithinRoot(root, relPath, `file path (${relPath})`);
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

function validateRevisionShape(revision, label) {
  assert(isPlainObject(revision), `${label} must be an object`);
  assertString(revision.fingerprint, `${label}.fingerprint must be a string`);
  assert(Array.isArray(revision.files), `${label}.files must be an array`);

  const seenPaths = new Set();
  revision.files.forEach((file, index) => {
    assert(isPlainObject(file), `${label}.files[${index}] must be an object`);
    assertString(file.path, `${label}.files[${index}].path must be a string`);
    assertString(file.hash, `${label}.files[${index}].hash must be a string`);
    assert(!seenPaths.has(file.path), `${label}.files contains duplicate path: ${file.path}`);
    seenPaths.add(file.path);
  });
}

function validateRunRevisionShape(run, label) {
  validateRevisionShape(run.content_revision, `${label}.content_revision`);
  validateRevisionShape(run.kernel_revision, `${label}.kernel_revision`);
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
  assertString(evidence.schema_version, "run schema_version must be a string");
  assertString(evidence.test_id, "run test_id must be a string");
  assertString(evidence.run_id, "run run_id must be a string");
  assertString(evidence.seed, "run seed must be a string");
  assertString(evidence.seed_source, "run seed_source must be a string");
  assertString(evidence.timestamp, "run timestamp must be a string");
  assertString(evidence.deterministic_fingerprint, "run deterministic_fingerprint must be a string");
  assert(isPlainObject(evidence.output_hashes), "run output_hashes must be an object");
  assertString(evidence.output_hashes.payload, "run output_hashes.payload must be a string");
  assert(evidence.output_snapshots !== undefined, "run output_snapshots must be present");
  assert(isPlainObject(evidence.environment_summary), "run environment_summary must be an object");
  validateRunRevisionShape(evidence, "run evidence");
  assert(evidence.schema_version === RUN_SCHEMA_VERSION, "unexpected run schema version");
  assert(ALLOWED_STATUSES.has(evidence.status), `invalid run status: ${String(evidence.status)}`);
  assert(
    evidence.output_hashes.payload === evidence.deterministic_fingerprint,
    "run output_hashes.payload does not match deterministic_fingerprint"
  );
  if (evidence.status === "PASS_REPRODUCED") {
    assert(evidence.reason_code === null, "successful run evidence must not carry a reason_code");
  } else {
    assertString(evidence.reason_code, "failed run evidence must carry a reason_code string");
  }
}

export async function verifyRunEvidenceAgainstDisk(root, evidence) {
  validateRunEvidence(evidence);

  const contentRevision = await hashFiles(root, evidence.content_revision.files.map((item) => item.path));
  const kernelRevision = await hashFiles(root, evidence.kernel_revision.files.map((item) => item.path));
  const outputFingerprint = await createMutFingerprint(evidence.output_snapshots);

  assert(
    JSON.stringify(contentRevision.files) === JSON.stringify(evidence.content_revision.files),
    "run content_revision files do not match repository contents"
  );
  assert(
    JSON.stringify(kernelRevision.files) === JSON.stringify(evidence.kernel_revision.files),
    "run kernel_revision files do not match repository contents"
  );
  assert(
    contentRevision.fingerprint === evidence.content_revision.fingerprint,
    "run content_revision fingerprint does not match repository contents"
  );
  assert(
    kernelRevision.fingerprint === evidence.kernel_revision.fingerprint,
    "run kernel_revision fingerprint does not match repository contents"
  );
  assert(
    outputFingerprint === evidence.deterministic_fingerprint,
    "run deterministic_fingerprint does not match output_snapshots"
  );
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
  assertString(evidence.schema_version, "pair schema_version must be a string");
  assertString(evidence.pair_id, "pair pair_id must be a string");
  assertString(evidence.test_id, "pair test_id must be a string");
  assertString(evidence.run_a_ref, "pair run_a_ref must be a string");
  assertString(evidence.run_b_ref, "pair run_b_ref must be a string");
  assertBoolean(evidence.seed_match, "pair seed_match must be a boolean");
  assertBoolean(evidence.fingerprint_match, "pair fingerprint_match must be a boolean");
  assertBoolean(evidence.content_match, "pair content_match must be a boolean");
  assertString(evidence.comparator_result, "pair comparator_result must be a string");
  assertString(evidence.comparator_reason, "pair comparator_reason must be a string");
  assert(evidence.schema_version === PAIR_SCHEMA_VERSION, "unexpected pair schema version");
  assert(ALLOWED_STATUSES.has(evidence.comparator_result), `invalid pair status: ${String(evidence.comparator_result)}`);
}

export function reconcilePairEvidence(runA, runB, pairEvidence) {
  const comparison = compareRunEvidence(runA, runB);

  assert(pairEvidence.test_id === runA.test_id, "pair test_id does not match run A");
  assert(pairEvidence.test_id === runB.test_id, "pair test_id does not match run B");
  assert(pairEvidence.seed_match === comparison.seed_match, "pair seed_match does not match recomputed comparison");
  assert(
    pairEvidence.fingerprint_match === comparison.fingerprint_match,
    "pair fingerprint_match does not match recomputed comparison"
  );
  assert(pairEvidence.content_match === comparison.content_match, "pair content_match does not match recomputed comparison");
  assert(
    pairEvidence.comparator_result === comparison.comparator_result,
    "pair comparator_result does not match recomputed comparison"
  );
  assert(
    pairEvidence.comparator_reason === comparison.comparator_reason,
    "pair comparator_reason does not match recomputed comparison"
  );

  return comparison;
}

export function validateSummaryEvidence(summary) {
  assert(summary && typeof summary === "object" && !Array.isArray(summary), "summary must be an object");
  for (const key of ["schema_version", "generated_at", "tests", "overall_status"]) {
    assert(key in summary, `missing summary field: ${key}`);
  }
  assertString(summary.schema_version, "summary schema_version must be a string");
  assertString(summary.generated_at, "summary generated_at must be a string");
  assert(Array.isArray(summary.tests), "summary.tests must be an array");
  assertString(summary.overall_status, "summary overall_status must be a string");
  assert(summary.schema_version === SUMMARY_SCHEMA_VERSION, "unexpected summary schema version");
  assert(ALLOWED_STATUSES.has(summary.overall_status), `invalid summary status: ${String(summary.overall_status)}`);

  summary.tests.forEach((entry, index) => {
    assert(isPlainObject(entry), `summary.tests[${index}] must be an object`);
    for (const key of ["test_id", "run_a_ref", "run_b_ref", "pair_ref", "status"]) {
      assert(key in entry, `missing summary test field: ${key}`);
    }
    assertString(entry.test_id, `summary.tests[${index}].test_id must be a string`);
    assertString(entry.run_a_ref, `summary.tests[${index}].run_a_ref must be a string`);
    assertString(entry.run_b_ref, `summary.tests[${index}].run_b_ref must be a string`);
    assertString(entry.pair_ref, `summary.tests[${index}].pair_ref must be a string`);
    assertString(entry.status, `summary.tests[${index}].status must be a string`);
    assert(ALLOWED_STATUSES.has(entry.status), `invalid summary test status: ${String(entry.status)}`);
  });
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
