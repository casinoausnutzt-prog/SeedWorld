import path from "node:path";
import {
  FINDINGS_EVIDENCE_REL,
  FINDINGS_LOCK_KEY_REL,
  FINDINGS_LOCK_REL,
  REQUIRED_REPORT_REL,
  loadReport,
  readUtf8OrNull
} from "./findings-shared/core.mjs";
import { loadTaskCatalog } from "./findings-shared/catalog.mjs";
import { assertFindingsState } from "./findings-shared/evidence.mjs";

const root = process.cwd();

function emitVerifyResult(result) {
  console.log(
    JSON.stringify({
      kind: "governance-findings",
      action: "verify",
      ...result
    })
  );
}

function failVerify(code, message, extra = {}) {
  console.error(
    JSON.stringify({
      kind: "governance-findings",
      action: "verify",
      status: "error",
      code,
      message,
      ...extra
    })
  );
  process.exit(1);
}

function classifyViolation(message) {
  const text = String(message || "");
  if (
    text.includes("mapping violation") ||
    text.includes("task catalog invariant break") ||
    text.includes("task mapping mismatch") ||
    text.includes("task core mismatch") ||
    text.includes("task sha mismatch") ||
    text.includes("missing task mapping") ||
    text.includes("created-task invariant break")
  ) {
    return "mapping";
  }
  if (
    text.includes("lock-integrity violation") ||
    text.includes("lock ") ||
    text.startsWith("lock") ||
    text.includes(" evidence") ||
    text.startsWith("evidence") ||
    text.includes(" report") ||
    text.startsWith("report")
  ) {
    return "lock_integrity";
  }
  return "unknown";
}

async function main() {
  const reportData = await loadReport(root, REQUIRED_REPORT_REL);
  const evidenceAbs = path.join(root, FINDINGS_EVIDENCE_REL);
  const lockAbs = path.join(root, FINDINGS_LOCK_REL);
  const keyAbs = path.join(root, FINDINGS_LOCK_KEY_REL);

  const keyRaw = await readUtf8OrNull(keyAbs);
  if (!keyRaw || !keyRaw.trim()) {
    failVerify("missing_lock_key", "missing lock key", {
      fix: "run npm run governance:findings:materialize"
    });
  }

  const lockRaw = await readUtf8OrNull(lockAbs);
  if (!lockRaw) {
    failVerify("missing_lock_file", "missing lock file", {
      fix: "run npm run governance:findings:materialize"
    });
  }

  const evidenceRaw = await readUtf8OrNull(evidenceAbs);
  if (!evidenceRaw) {
    failVerify("missing_evidence_file", "missing evidence file", {
      fix: "run npm run governance:findings:materialize"
    });
  }

  let evidence = null;
  try {
    evidence = JSON.parse(evidenceRaw);
  } catch {
    failVerify("invalid_evidence_json", "invalid evidence JSON");
  }

  const catalog = await loadTaskCatalog(root);
  try {
    const state = assertFindingsState({
      report: reportData.report,
      reportRel: reportData.reportRel,
      catalog,
      evidence,
      lock: lockRaw,
      lockKey: keyRaw.trim()
    });
    emitVerifyResult({
      status: "ok",
      blockers: state.expectation.plan.length,
      created: state.expectation.plan.filter((entry) => entry.state === "created").length,
      task_plan: state.expectation.taskPlanHash.slice(0, 12)
    });
  } catch (error) {
    const message = String(error?.message || error);
    failVerify("verification_failed", message, {
      violation: classifyViolation(message)
    });
  }
}

await main().catch((error) => {
  const message = String(error?.message || error);
  failVerify("unexpected_failure", message);
});
