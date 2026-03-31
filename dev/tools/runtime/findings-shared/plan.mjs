import path from "node:path";
import {
  REQUIRED_REPORT_REL,
  dedup,
  parseTaskId,
  reportFingerprint,
  sha256,
  stableJson,
  toPosixRel
} from "./core.mjs";

const DEFAULT_SOURCE_DOCS = Object.freeze(["docs/V2/SYSTEM_PLAN.md"]);
const STEP_SCOPE_MAP = Object.freeze({
  "versioning:verify": ["dev/tools/runtime/sync-versioning.mjs"],
  "governance:policy:verify": ["dev/tools/runtime/governance-policy-verify.mjs"],
  "governance:modularity:verify": ["dev/tools/runtime/governance-modularity-verify.mjs"],
  "governance:llm:verify": ["dev/tools/runtime/governance-llm-verify.mjs"],
  "governance:subagent:verify": ["dev/tools/runtime/governance-subagent-verify.mjs"],
  tests: ["dev/scripts/test-runner.mjs"],
  "evidence:verify": ["dev/scripts/verify-evidence.mjs"],
  "testline:verify": ["dev/tools/runtime/verify-testline-integrity.mjs"],
  "repo:hygiene:verify": ["dev/tools/runtime/repo-hygiene-verify.mjs"],
  "docs:v2:verify": ["dev/tools/runtime/sync-docs-v2.mjs"],
  "docs:v2:coverage": ["dev/tools/runtime/verify-docs-v2-coverage.mjs"],
  "docs:tasks:verify": ["dev/tools/runtime/scan-doc-tasks-verify.mjs"],
  "governance:coverage:verify": ["dev/tools/runtime/governance-coverage-verify.mjs"],
  "governance:findings:verify": ["dev/tools/runtime/governance-findings-verify.mjs"]
});

export function buildBlockers(report) {
  const failedSteps = dedup(
    (report.steps || [])
      .filter((step) => step.status === "FAILED")
      .map((step) => ({
        step_id: step.id || step.script || "unknown",
        script: step.script || "unknown",
        exit_code: step.exit_code,
        output_sha256: step.output_sha256 || "missing",
        reason: `required gate failed: ${step.id || step.script || "unknown"}`
      })),
    (item) => item.step_id
  );

  if (failedSteps.length > 0) {
    return failedSteps;
  }
  if (report.overall_status === "FAILED") {
    const fallback = report.failure_step || "unknown";
    return [
      {
        step_id: fallback,
        script: fallback,
        exit_code: null,
        output_sha256: "missing",
        reason: `required gate failed: ${fallback}`
      }
    ];
  }
  return [];
}

export function findingFingerprint({ report, blocker }) {
  return sha256(
    JSON.stringify({
      policy: report.policy || "unknown",
      run_mode: report.run_mode || "unknown",
      step_id: blocker.step_id,
      output_sha256: blocker.output_sha256 || "missing"
    })
  );
}

export function resolvePrefix(stepId) {
  if (stepId.startsWith("governance:llm") || stepId.startsWith("governance:subagent")) {
    return "LLM";
  }
  return "GOV";
}

export function resolveTrack(prefix) {
  return prefix === "LLM" ? "governance-llm-hardening" : "governance-hardening";
}

export function resolveScope(stepId) {
  return STEP_SCOPE_MAP[stepId] || ["dev/tools/runtime/run-required-checks.mjs"];
}

export function buildFindingTaskRecord({ taskId, blocker, reportRel }) {
  const prefix = resolvePrefix(blocker.step_id);
  return {
    schema_version: "2.0.0",
    task_id: taskId,
    title: `Blocker: ${blocker.step_id}`,
    status: "open",
    track: resolveTrack(prefix),
    source_docs: [...DEFAULT_SOURCE_DOCS],
    description: `${blocker.reason}. proof=${blocker.output_sha256}.`,
    scope_paths: [...resolveScope(blocker.step_id)],
    match_policy: "all_scope_paths_touched",
    finding_fingerprint: blocker.finding_fingerprint,
    finding_rule_id: blocker.step_id,
    finding_report: reportRel
  };
}

export function compareTaskMappingCore(actual, expected) {
  const actualCore = {
    schema_version: String(actual?.schema_version || ""),
    task_id: String(actual?.task_id || ""),
    title: String(actual?.title || ""),
    track: String(actual?.track || ""),
    source_docs: Array.isArray(actual?.source_docs) ? [...actual.source_docs] : [],
    description: String(actual?.description || ""),
    scope_paths: Array.isArray(actual?.scope_paths) ? [...actual.scope_paths] : [],
    match_policy: String(actual?.match_policy || ""),
    finding_fingerprint: String(actual?.finding_fingerprint || ""),
    finding_rule_id: String(actual?.finding_rule_id || ""),
    finding_report: String(actual?.finding_report || "")
  };
  const expectedCore = {
    schema_version: String(expected?.schema_version || ""),
    task_id: String(expected?.task_id || ""),
    title: String(expected?.title || ""),
    track: String(expected?.track || ""),
    source_docs: Array.isArray(expected?.source_docs) ? [...expected.source_docs] : [],
    description: String(expected?.description || ""),
    scope_paths: Array.isArray(expected?.scope_paths) ? [...expected.scope_paths] : [],
    match_policy: String(expected?.match_policy || ""),
    finding_fingerprint: String(expected?.finding_fingerprint || ""),
    finding_rule_id: String(expected?.finding_rule_id || ""),
    finding_report: String(expected?.finding_report || "")
  };

  return {
    actualCore,
    expectedCore,
    matches: stableJson(actualCore) === stableJson(expectedCore)
  };
}

export function taskMappingCoreSignature(task) {
  return stableJson({
    schema_version: String(task?.schema_version || ""),
    task_id: String(task?.task_id || ""),
    title: String(task?.title || ""),
    track: String(task?.track || ""),
    source_docs: Array.isArray(task?.source_docs) ? [...task.source_docs] : [],
    description: String(task?.description || ""),
    scope_paths: Array.isArray(task?.scope_paths) ? [...task.scope_paths] : [],
    match_policy: String(task?.match_policy || ""),
    finding_fingerprint: String(task?.finding_fingerprint || ""),
    finding_rule_id: String(task?.finding_rule_id || ""),
    finding_report: String(task?.finding_report || "")
  });
}

export function buildFindingTaskPlan({ report, blockers, catalog, reportRel = REQUIRED_REPORT_REL }) {
  if (catalog.invariantIssues.length > 0) {
    throw new Error(`[GOVERNANCE_FINDINGS] task catalog invariant break (${catalog.invariantIssues.join("; ")})`);
  }

  const sortedBlockers = [...blockers].sort((a, b) => {
    const fpA = findingFingerprint({ report, blocker: a });
    const fpB = findingFingerprint({ report, blocker: b });
    return `${fpA}:${a.step_id}`.localeCompare(`${fpB}:${b.step_id}`, "en");
  });

  const prefixMax = new Map();
  for (const row of catalog.tasks) {
    const parsed = parseTaskId(row.task?.task_id);
    if (!parsed || !Number.isFinite(parsed.number)) {
      continue;
    }
    prefixMax.set(parsed.prefix, Math.max(prefixMax.get(parsed.prefix) || 0, parsed.number));
  }

  const plan = [];
  for (const blocker of sortedBlockers) {
    const fingerprint = findingFingerprint({ report, blocker });
    const existing = catalog.byFingerprint.get(fingerprint) || null;
    const prefix = resolvePrefix(blocker.step_id);
    const nextNumber = (prefixMax.get(prefix) || 0) + 1;
    const taskId = existing?.task?.task_id || `${prefix}-${String(nextNumber).padStart(3, "0")}`;
    if (!existing) {
      prefixMax.set(prefix, Number(taskId.split("-")[1] || 0));
    }

    const expectedTask = buildFindingTaskRecord({
      taskId,
      blocker: {
        ...blocker,
        finding_fingerprint: fingerprint
      },
      reportRel
    });
    const taskRow = existing || null;
    const taskSha256 = taskRow?.sha256 || sha256(JSON.stringify(expectedTask, null, 2) + "\n");
    const fallbackAbsPath = path.join(process.cwd(), "tem", "tasks", "open", `${taskId}.json`);
    const taskRelPath = taskRow?.relPath || toPosixRel(process.cwd(), fallbackAbsPath);

    if (taskRow) {
      const comparison = compareTaskMappingCore(taskRow.task, expectedTask);
      if (!comparison.matches) {
        throw new Error(`[GOVERNANCE_FINDINGS] task mapping mismatch for ${taskId}`);
      }
    }

    plan.push({
      blocker,
      finding_fingerprint: fingerprint,
      task_id: taskId,
      task: expectedTask,
      task_sha256: taskSha256,
      task_rel_path: taskRelPath,
      state: taskRow ? "existing" : "created"
    });
  }

  const taskPlanHash = sha256(
    JSON.stringify(
      plan.map((entry) => ({
        task_id: entry.task_id,
        finding_fingerprint: entry.finding_fingerprint,
        finding_rule_id: entry.task.finding_rule_id,
        scope_paths: entry.task.scope_paths,
        match_policy: entry.task.match_policy,
        source_docs: entry.task.source_docs
      }))
    )
  );

  return {
    blockers: sortedBlockers,
    plan,
    taskPlanHash
  };
}
