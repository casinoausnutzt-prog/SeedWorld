import { FINDINGS_LOCK_REL, REQUIRED_REPORT_REL, lockIntegrityError, mappingViolationError, reportFingerprint, stableJson } from "./core.mjs";
import { buildBlockers, buildFindingTaskPlan, compareTaskMappingCore } from "./plan.mjs";
import { decodeFindingsLockRecord } from "./lock.mjs";

const FINDINGS_EVIDENCE_POLICY = "governance-findings.v1";
const LOCK_STATE_COMMITTED = "committed";

export function buildFindingsEvidenceRecord({
  report,
  reportRel = REQUIRED_REPORT_REL,
  plan,
  taskPlanHash,
  lockRecord,
  generatedAt = new Date().toISOString()
}) {
  return {
    schema_version: 1,
    generated_at: generatedAt,
    policy: FINDINGS_EVIDENCE_POLICY,
    report_path: reportRel,
    report_fingerprint: reportFingerprint(report),
    report_status: report.overall_status || "UNKNOWN",
    task_plan_hash: taskPlanHash,
    lock: {
      path: FINDINGS_LOCK_REL,
      state: lockRecord?.payload?.state || "pending",
      signature: lockRecord?.signature || null,
      payload_sha256: lockRecord?.payloadSha256 || null,
      created_at: lockRecord?.payload?.created_at || null,
      committed_at: lockRecord?.payload?.committed_at || null,
      expires_at: lockRecord?.payload?.expires_at || null,
      lease_ms: lockRecord?.payload?.lease_ms || null,
      owner: lockRecord?.payload?.owner || null
    },
    blockers: plan.map((entry) => ({
      step_id: entry.blocker.step_id,
      script: entry.blocker.script,
      exit_code: entry.blocker.exit_code,
      output_sha256: entry.blocker.output_sha256,
      reason: entry.blocker.reason,
      finding_fingerprint: entry.finding_fingerprint,
      task_id: entry.task_id,
      task_path: entry.task_rel_path,
      task_sha256: entry.task_sha256,
      state: entry.state
    })),
    task_mappings: plan.map((entry) => ({
      step_id: entry.blocker.step_id,
      finding_fingerprint: entry.finding_fingerprint,
      task_id: entry.task_id,
      task_path: entry.task_rel_path,
      task_sha256: entry.task_sha256,
      scope_paths: entry.task.scope_paths,
      match_policy: entry.task.match_policy,
      state: entry.state
    })),
    created_task_ids: plan.filter((entry) => entry.state === "created").map((entry) => entry.task_id)
  };
}

export function compareEvidenceBlockers(expectedPlan, evidence) {
  const expected = expectedPlan.map((entry) => ({
    step_id: entry.blocker.step_id,
    finding_fingerprint: entry.finding_fingerprint,
    task_id: entry.task_id,
    task_path: entry.task_rel_path,
    task_sha256: entry.task_sha256
  }));
  const actual = (evidence?.blockers || []).map((entry) => ({
    step_id: String(entry?.step_id || ""),
    finding_fingerprint: String(entry?.finding_fingerprint || ""),
    task_id: String(entry?.task_id || ""),
    task_path: String(entry?.task_path || ""),
    task_sha256: String(entry?.task_sha256 || "")
  }));
  return {
    expected,
    actual,
    matches: stableJson(expected) === stableJson(actual)
  };
}

export function compareTaskMappings(expectedPlan, evidence) {
  const expected = expectedPlan.map((entry) => ({
    step_id: entry.blocker.step_id,
    finding_fingerprint: entry.finding_fingerprint,
    task_id: entry.task_id,
    task_path: entry.task_rel_path,
    task_sha256: entry.task_sha256,
    scope_paths: entry.task.scope_paths,
    match_policy: entry.task.match_policy
  }));
  const actual = (evidence?.task_mappings || []).map((entry) => ({
    step_id: String(entry?.step_id || ""),
    finding_fingerprint: String(entry?.finding_fingerprint || ""),
    task_id: String(entry?.task_id || ""),
    task_path: String(entry?.task_path || ""),
    task_sha256: String(entry?.task_sha256 || ""),
    scope_paths: Array.isArray(entry?.scope_paths) ? [...entry.scope_paths] : [],
    match_policy: String(entry?.match_policy || "")
  }));
  return {
    expected,
    actual,
    matches: stableJson(expected) === stableJson(actual)
  };
}

export function assertFindingsState({
  report,
  reportRel = REQUIRED_REPORT_REL,
  catalog,
  evidence,
  lock,
  lockKey,
  expectedCreatedTaskIds = null
}) {
  const reportHash = reportFingerprint(report);
  const blockers = buildBlockers(report);
  const expectation = buildFindingTaskPlan({ report, blockers, catalog, reportRel });
  const decodedLock = decodeFindingsLockRecord(lock, lockKey);

  if (decodedLock.payload.state !== LOCK_STATE_COMMITTED) {
    throw lockIntegrityError("lock is not committed");
  }
  if ((decodedLock.payload.report_fingerprint || "") !== reportHash) {
    throw lockIntegrityError("lock/report fingerprint mismatch");
  }
  if ((decodedLock.payload.report_path || "") !== reportRel) {
    throw lockIntegrityError("lock/report path mismatch");
  }
  if ((decodedLock.payload.task_plan_hash || "") !== expectation.taskPlanHash) {
    throw lockIntegrityError("lock task-plan hash mismatch");
  }
  const actualTaskIds = [...(decodedLock.payload.task_ids || [])].map((value) => String(value || ""));
  const expectedTaskIds = expectation.plan.map((entry) => entry.task_id);
  if (stableJson(actualTaskIds) !== stableJson(expectedTaskIds)) {
    throw lockIntegrityError("lock task-id invariant break");
  }
  const actualBlockerFingerprints = [...(decodedLock.payload.blocker_fingerprints || [])].map((value) => String(value || ""));
  const expectedBlockerFingerprints = expectation.plan.map((entry) => entry.finding_fingerprint);
  if (stableJson(actualBlockerFingerprints) !== stableJson(expectedBlockerFingerprints)) {
    throw lockIntegrityError("lock blocker-fingerprint invariant break");
  }

  if (!evidence) {
    throw lockIntegrityError("missing evidence file");
  }
  if ((evidence.report_fingerprint || "") !== reportHash) {
    throw lockIntegrityError("report fingerprint mismatch");
  }
  if ((evidence.report_status || "UNKNOWN") !== (report.overall_status || "UNKNOWN")) {
    throw lockIntegrityError("report/evidence status mismatch");
  }
  if ((evidence.task_plan_hash || "") !== expectation.taskPlanHash) {
    throw lockIntegrityError("evidence task-plan hash mismatch");
  }
  if ((evidence.lock?.path || "") !== FINDINGS_LOCK_REL) {
    throw lockIntegrityError("evidence lock-path mismatch");
  }
  if ((evidence.lock?.signature || "") !== decodedLock.signature) {
    throw lockIntegrityError("evidence lock-signature mismatch");
  }
  if ((evidence.lock?.payload_sha256 || "") !== decodedLock.payloadSha256) {
    throw lockIntegrityError("evidence/lock payload mismatch");
  }
  if ((evidence.lock?.state || "") !== LOCK_STATE_COMMITTED) {
    throw lockIntegrityError("evidence lock state mismatch");
  }
  if ((evidence.lock?.expires_at || "") !== decodedLock.payload.expires_at) {
    throw lockIntegrityError("evidence lock expires-at mismatch");
  }
  if (Number(evidence.lock?.lease_ms || 0) !== Number(decodedLock.payload.lease_ms || 0)) {
    throw lockIntegrityError("evidence lock lease mismatch");
  }
  if (stableJson(evidence.lock?.owner || null) !== stableJson(decodedLock.payload.owner || null)) {
    throw lockIntegrityError("evidence lock owner mismatch");
  }

  const blockerComparison = compareEvidenceBlockers(expectation.plan, evidence);
  if (!blockerComparison.matches) {
    throw mappingViolationError("evidence blocker set mismatch");
  }

  const mappingComparison = compareTaskMappings(expectation.plan, evidence);
  if (!mappingComparison.matches) {
    throw mappingViolationError("evidence task mapping mismatch");
  }
  if (Array.isArray(expectedCreatedTaskIds)) {
    const actualCreatedTaskIds = Array.isArray(evidence.created_task_ids) ? [...evidence.created_task_ids] : [];
    if (stableJson(actualCreatedTaskIds) !== stableJson(expectedCreatedTaskIds)) {
      throw mappingViolationError("evidence created-task invariant break");
    }
  }

  for (const entry of expectation.plan) {
    const catalogRow = catalog.byFingerprint.get(entry.finding_fingerprint);
    if (!catalogRow) {
      throw mappingViolationError(`missing task mapping: ${entry.task_id}`);
    }
    const comparison = compareTaskMappingCore(catalogRow.task, entry.task);
    if (!comparison.matches) {
      throw mappingViolationError(`task core mismatch: ${entry.task_id}`);
    }
    if (catalogRow.sha256 !== entry.task_sha256) {
      throw mappingViolationError(`task sha mismatch: ${entry.task_id}`);
    }
  }

  return {
    reportHash,
    blockers,
    expectation,
    lock: decodedLock
  };
}
