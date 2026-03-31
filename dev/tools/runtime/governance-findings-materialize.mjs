import path from "node:path";
import {
  FINDINGS_EVIDENCE_REL,
  FINDINGS_LOCK_REL,
  REQUIRED_REPORT_REL,
  loadReport,
  readJsonOrNull,
  readUtf8OrNull,
  reportFingerprint
} from "./findings-shared/core.mjs";
import {
  buildBlockers,
  buildFindingTaskPlan,
  compareEvidenceBlockers,
  compareTaskMappings
} from "./findings-shared/plan.mjs";
import {
  assertFindingsState,
  buildFindingsEvidenceRecord
} from "./findings-shared/evidence.mjs";
import {
  buildFindingsLockOwner,
  buildFindingsLockRecord,
  decodeFindingsLockRecord,
  ensureFindingsLockKey,
  replaceTextAtomic,
  writeTextAtomic
} from "./findings-shared/lock.mjs";
import { loadTaskCatalog } from "./findings-shared/catalog.mjs";

const root = process.cwd();

async function main() {
  const reportData = await loadReport(root, REQUIRED_REPORT_REL);
  const report = reportData.report;
  const evidenceAbs = path.join(root, FINDINGS_EVIDENCE_REL);
  const lockAbs = path.join(root, FINDINGS_LOCK_REL);
  const key = await ensureFindingsLockKey(root);
  const catalog = await loadTaskCatalog(root);
  const blockers = buildBlockers(report);
  const expectation = buildFindingTaskPlan({
    report,
    blockers,
    catalog,
    reportRel: reportData.reportRel
  });
  const expectedCreatedTaskIds = expectation.plan.filter((entry) => entry.state === "created").map((entry) => entry.task_id);
  const lockOwner = buildFindingsLockOwner();

  const existingLockRaw = await readUtf8OrNull(lockAbs);
  const existingEvidenceRaw = await readUtf8OrNull(evidenceAbs);
  let pendingLockRaw = null;

  if (existingLockRaw) {
    const decodedLock = decodeFindingsLockRecord(existingLockRaw, key);
    if (decodedLock.payload.state !== "committed") {
      const stale = decodedLock.isExpired();
      const lockPlanTaskIds = [...decodedLock.payload.task_ids].map((value) => String(value || ""));
      const lockPlanBlockers = [...decodedLock.payload.blocker_fingerprints].map((value) => String(value || ""));
      if (
        (decodedLock.payload.report_fingerprint || "") !== reportFingerprint(report) ||
        (decodedLock.payload.report_path || "") !== reportData.reportRel ||
        (decodedLock.payload.task_plan_hash || "") !== expectation.taskPlanHash ||
        JSON.stringify(lockPlanTaskIds) !== JSON.stringify(expectation.plan.map((entry) => entry.task_id)) ||
        JSON.stringify(lockPlanBlockers) !== JSON.stringify(expectation.plan.map((entry) => entry.finding_fingerprint))
      ) {
        throw new Error("[GOVERNANCE_FINDINGS] stale findings lock does not match current plan");
      }
      if (!stale) {
        throw new Error("[GOVERNANCE_FINDINGS] active findings lock present");
      }

      const takeoverLock = buildFindingsLockRecord({
        key,
        report,
        reportRel: reportData.reportRel,
        taskPlanHash: expectation.taskPlanHash,
        plan: expectation.plan,
        state: "pending",
        owner: lockOwner
      });
      pendingLockRaw = `${JSON.stringify(takeoverLock, null, 2)}\n`;
      await replaceTextAtomic(lockAbs, existingLockRaw, pendingLockRaw);
    } else {
      pendingLockRaw = existingLockRaw;
      let existingEvidence = null;
      try {
        existingEvidence = existingEvidenceRaw ? JSON.parse(existingEvidenceRaw) : null;
      } catch {
        throw new Error("[GOVERNANCE_FINDINGS] invalid evidence JSON");
      }
      if (!existingEvidence) {
        throw new Error("[GOVERNANCE_FINDINGS] committed lock without evidence");
      }
      const state = assertFindingsState({
        report,
        reportRel: reportData.reportRel,
        catalog,
        evidence: existingEvidence,
        lock: existingLockRaw,
        lockKey: key
      });
      console.log(
        JSON.stringify({
          kind: "governance-findings",
          action: "materialize",
          status: "already_materialized",
          blockers: state.expectation.plan.length,
          created: state.expectation.plan.filter((entry) => entry.state === "created").length,
          task_plan: state.expectation.taskPlanHash.slice(0, 12)
        })
      );
      return;
    }
  }

  if (!pendingLockRaw) {
    const pendingLock = buildFindingsLockRecord({
      key,
      report,
      reportRel: reportData.reportRel,
      taskPlanHash: expectation.taskPlanHash,
      plan: expectation.plan,
      state: "pending",
      owner: lockOwner
    });
    pendingLockRaw = `${JSON.stringify(pendingLock, null, 2)}\n`;
    await writeTextAtomic(lockAbs, pendingLockRaw);
  }

  if (existingEvidenceRaw) {
    let existingEvidence = null;
    try {
      existingEvidence = JSON.parse(existingEvidenceRaw);
    } catch {
      throw new Error("[GOVERNANCE_FINDINGS] invalid legacy evidence JSON");
    }
    if ((existingEvidence.report_fingerprint || "") && existingEvidence.report_fingerprint !== reportFingerprint(report)) {
      throw new Error("[GOVERNANCE_FINDINGS] legacy evidence/report fingerprint mismatch");
    }
    if ((existingEvidence.report_status || "UNKNOWN") !== (report.overall_status || "UNKNOWN")) {
      throw new Error("[GOVERNANCE_FINDINGS] legacy evidence/report status mismatch");
    }
    if (Array.isArray(existingEvidence.blockers) && existingEvidence.blockers.length > 0) {
      const blockerComparison = compareEvidenceBlockers(expectation.plan, existingEvidence);
      if (!blockerComparison.matches) {
        throw new Error("[GOVERNANCE_FINDINGS] legacy evidence blocker mismatch");
      }
    }
    if (Array.isArray(existingEvidence.task_mappings) && existingEvidence.task_mappings.length > 0) {
      const mappingComparison = compareTaskMappings(expectation.plan, existingEvidence);
      if (!mappingComparison.matches) {
        throw new Error("[GOVERNANCE_FINDINGS] legacy evidence mapping mismatch");
      }
    }
  }

  for (const entry of expectation.plan) {
    if (entry.state !== "created") {
      continue;
    }
    const taskAbs = path.join(root, ...entry.task_rel_path.split("/"));
    await writeTextAtomic(taskAbs, `${JSON.stringify(entry.task, null, 2)}\n`);
  }

  const committedLock = buildFindingsLockRecord({
    key,
    report,
    reportRel: reportData.reportRel,
    taskPlanHash: expectation.taskPlanHash,
    plan: expectation.plan,
    state: "committed",
    committedAt: new Date().toISOString(),
    owner: lockOwner
  });
  const committedLockRaw = `${JSON.stringify(committedLock, null, 2)}\n`;
  const committedLockDecoded = decodeFindingsLockRecord(committedLockRaw, key);
  const evidence = buildFindingsEvidenceRecord({
    report,
    reportRel: reportData.reportRel,
    plan: expectation.plan,
    taskPlanHash: expectation.taskPlanHash,
    lockRecord: committedLockDecoded
  });
  const evidenceRaw = `${JSON.stringify(evidence, null, 2)}\n`;
  if (existingEvidenceRaw) {
    await replaceTextAtomic(evidenceAbs, existingEvidenceRaw, evidenceRaw);
  } else {
    await writeTextAtomic(evidenceAbs, evidenceRaw);
  }
  await replaceTextAtomic(lockAbs, pendingLockRaw, committedLockRaw);

  const finalCatalog = await loadTaskCatalog(root);
  const finalEvidence = await readJsonOrNull(evidenceAbs);
  const finalLockRaw = await readUtf8OrNull(lockAbs);
  assertFindingsState({
    report,
    reportRel: reportData.reportRel,
    catalog: finalCatalog,
    evidence: finalEvidence,
    lock: finalLockRaw,
    lockKey: key,
    expectedCreatedTaskIds
  });

  console.log(
    JSON.stringify({
      kind: "governance-findings",
      action: "materialize",
      status: "materialized",
      blockers: expectation.plan.length,
      created: expectation.plan.filter((entry) => entry.state === "created").length,
      task_plan: expectation.taskPlanHash.slice(0, 12)
    })
  );
}

await main().catch((error) => {
  console.error(
    JSON.stringify({
      kind: "governance-findings",
      action: "materialize",
      status: "error",
      message: String(error?.message || error)
    })
  );
  process.exit(1);
});
