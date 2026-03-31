import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const FINDINGS_EVIDENCE_REL = "runtime/evidence/governance-findings.json";
export const REQUIRED_REPORT_REL = "runtime/evidence/required-check-report.json";
export const FINDINGS_LOCK_REL = "runtime/.patch-manager/.vault/governance-findings.lock";
export const FINDINGS_LOCK_KEY_REL = "runtime/.patch-manager/.vault/.k";

const DEFAULT_FINDINGS_LOCK_TTL_MS = 15 * 60 * 1000;

function readPositiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return fallback;
}

export const FINDINGS_LOCK_TTL_MS = readPositiveIntegerEnv(
  "GOVERNANCE_FINDINGS_LOCK_TTL_MS",
  DEFAULT_FINDINGS_LOCK_TTL_MS
);

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function toPosixRel(root, absPath) {
  return path.relative(root, absPath).replace(/\\/g, "/");
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function stableJson(value) {
  return JSON.stringify(value);
}

export function parseIsoTimestamp(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function toIsoTimestamp(ms) {
  return new Date(ms).toISOString();
}

export function normalizeFindingsLockOwner(owner) {
  const normalized = {
    id: String(owner?.id || ""),
    pid: Number(owner?.pid),
    ppid: Number(owner?.ppid),
    node: String(owner?.node || ""),
    platform: String(owner?.platform || ""),
    hostname: String(owner?.hostname || "")
  };
  if (
    !normalized.id ||
    !Number.isFinite(normalized.pid) ||
    normalized.pid < 1 ||
    !Number.isFinite(normalized.ppid) ||
    normalized.ppid < 0 ||
    !normalized.node ||
    !normalized.platform ||
    !normalized.hostname
  ) {
    return null;
  }
  return normalized;
}

export function buildFindingsLockOwner() {
  return {
    id: randomBytes(16).toString("hex"),
    pid: process.pid,
    ppid: process.ppid,
    node: process.version,
    platform: process.platform,
    hostname: os.hostname()
  };
}

export function lockIntegrityError(message) {
  return new Error(`[GOVERNANCE_FINDINGS] lock-integrity violation: ${message}`);
}

export function mappingViolationError(message) {
  return new Error(`[GOVERNANCE_FINDINGS] mapping violation: ${message}`);
}

export function dedup(items, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function parseTaskId(taskId) {
  const m = /^([A-Z]+)-(\d+)$/.exec(String(taskId || ""));
  if (!m) return null;
  return { prefix: m[1], number: Number(m[2]) };
}

export function nextTaskId(prefix, tasks) {
  let max = 0;
  for (const task of tasks) {
    const parsed = parseTaskId(task.task_id);
    if (parsed && parsed.prefix === prefix && Number.isFinite(parsed.number)) {
      max = Math.max(max, parsed.number);
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function reportFingerprint(report) {
  return sha256(
    JSON.stringify({
      policy: report.policy || "unknown",
      run_mode: report.run_mode || "unknown",
      overall_status: report.overall_status || "UNKNOWN",
      failure_step: report.failure_step || null,
      steps: (report.steps || []).map((step) => ({
        id: step.id || step.script || "unknown",
        status: step.status || "UNKNOWN",
        exit_code: step.exit_code ?? null,
        output_sha256: step.output_sha256 || "missing"
      }))
    })
  );
}

export async function readUtf8OrNull(absPath) {
  try {
    return await readFile(absPath, "utf8");
  } catch {
    return null;
  }
}

export async function readJsonOrNull(absPath) {
  const raw = await readUtf8OrNull(absPath);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadReport(root, relPath = REQUIRED_REPORT_REL) {
  const abs = path.join(root, relPath);
  const raw = await readFile(abs, "utf8");
  return {
    reportRel: relPath,
    reportAbs: abs,
    reportRaw: raw,
    report: JSON.parse(raw),
    reportSha: sha256(raw)
  };
}

export async function ensureDirectory(absPath) {
  await mkdir(path.dirname(absPath), { recursive: true });
}
