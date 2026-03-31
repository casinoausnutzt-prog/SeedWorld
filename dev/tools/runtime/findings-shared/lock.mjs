import { randomBytes } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FINDINGS_LOCK_KEY_REL,
  FINDINGS_LOCK_TTL_MS,
  buildFindingsLockOwner,
  lockIntegrityError,
  normalizeFindingsLockOwner,
  parseIsoTimestamp,
  REQUIRED_REPORT_REL,
  readUtf8OrNull,
  reportFingerprint,
  sha256,
  toIsoTimestamp
} from "./core.mjs";

const FINDINGS_LOCK_POLICY = "governance-findings-lock.v1";
const LOCK_STATE_PENDING = "pending";
const LOCK_STATE_COMMITTED = "committed";

export function encodeFindingsLockPayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeFindingsLockPayload(encoded) {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

export function signFindingsLockPayload(key, encodedPayload) {
  return sha256(`${key}::${encodedPayload}`);
}

export function buildFindingsLockRecord({
  key,
  report,
  reportRel = REQUIRED_REPORT_REL,
  taskPlanHash,
  plan,
  state,
  createdAt = new Date().toISOString(),
  committedAt = null,
  evidenceSha256 = null,
  owner = null,
  leaseMs = FINDINGS_LOCK_TTL_MS
}) {
  const normalizedOwner = normalizeFindingsLockOwner(owner) || buildFindingsLockOwner();
  const createdAtMs = parseIsoTimestamp(createdAt);
  if (createdAtMs === null) {
    throw lockIntegrityError("invalid lock timestamp");
  }
  const normalizedLeaseMs = Number(leaseMs);
  if (!Number.isFinite(normalizedLeaseMs) || normalizedLeaseMs <= 0) {
    throw lockIntegrityError("invalid lock lease");
  }
  const expiresAt = toIsoTimestamp(createdAtMs + Math.floor(normalizedLeaseMs));
  const payload = {
    schema_version: 1,
    policy: FINDINGS_LOCK_POLICY,
    state,
    created_at: createdAt,
    committed_at: committedAt,
    lease_ms: Math.floor(normalizedLeaseMs),
    expires_at: expiresAt,
    report_path: reportRel,
    report_fingerprint: reportFingerprint(report),
    report_status: report.overall_status || "UNKNOWN",
    task_plan_hash: taskPlanHash,
    blocker_fingerprints: plan.map((entry) => entry.finding_fingerprint),
    task_ids: plan.map((entry) => entry.task_id),
    evidence_sha256: evidenceSha256,
    owner: normalizedOwner
  };
  const encodedPayload = encodeFindingsLockPayload(payload);
  return {
    payload: encodedPayload,
    signature: signFindingsLockPayload(key, encodedPayload)
  };
}

export function decodeFindingsLockRecord(raw, key) {
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("[GOVERNANCE_FINDINGS] invalid lock format");
  }

  const encoded = String(parsed?.payload || "");
  const signature = String(parsed?.signature || "");
  if (!encoded || !signature) {
    throw new Error("[GOVERNANCE_FINDINGS] incomplete lock");
  }

  const expectedSignature = signFindingsLockPayload(key, encoded);
  if (expectedSignature !== signature) {
    throw new Error("[GOVERNANCE_FINDINGS] lock signature mismatch");
  }

  let payload = null;
  try {
    payload = decodeFindingsLockPayload(encoded);
  } catch {
    throw new Error("[GOVERNANCE_FINDINGS] invalid lock payload");
  }

  if ((payload?.policy || "") !== FINDINGS_LOCK_POLICY) {
    throw lockIntegrityError("unexpected lock policy");
  }

  if (![LOCK_STATE_PENDING, LOCK_STATE_COMMITTED].includes(payload?.state)) {
    throw lockIntegrityError("invalid lock state");
  }

  if (!Array.isArray(payload?.blocker_fingerprints) || !Array.isArray(payload?.task_ids)) {
    throw lockIntegrityError("invalid lock invariants");
  }
  if (payload.blocker_fingerprints.length !== payload.task_ids.length) {
    throw lockIntegrityError("lock task mapping mismatch");
  }
  if (new Set(payload.blocker_fingerprints.map((value) => String(value || ""))).size !== payload.blocker_fingerprints.length) {
    throw lockIntegrityError("duplicate blocker fingerprints");
  }
  if (new Set(payload.task_ids.map((value) => String(value || ""))).size !== payload.task_ids.length) {
    throw lockIntegrityError("duplicate task ids");
  }

  const owner = normalizeFindingsLockOwner(payload?.owner);
  if (!owner) {
    throw lockIntegrityError("invalid owner metadata");
  }

  const createdAtMs = parseIsoTimestamp(payload?.created_at);
  if (createdAtMs === null) {
    throw lockIntegrityError("invalid created_at timestamp");
  }
  const expiresAtMs = parseIsoTimestamp(payload?.expires_at);
  if (expiresAtMs === null) {
    throw lockIntegrityError("invalid expires_at timestamp");
  }
  if (expiresAtMs <= createdAtMs) {
    throw lockIntegrityError("non-positive lease window");
  }
  const leaseMs = Number(payload?.lease_ms);
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
    throw lockIntegrityError("invalid lease duration");
  }
  if (Math.abs(expiresAtMs - createdAtMs - Math.floor(leaseMs)) > 1000) {
    throw lockIntegrityError("lease window mismatch");
  }
  if (payload?.committed_at !== null && payload?.committed_at !== undefined) {
    const committedAtMs = parseIsoTimestamp(payload.committed_at);
    if (committedAtMs === null) {
      throw lockIntegrityError("invalid committed_at timestamp");
    }
  }

  return {
    raw: parsed,
    payload,
    signature,
    encoded,
    payloadSha256: sha256(encoded),
    createdAtMs,
    expiresAtMs,
    isExpired(nowMs = Date.now()) {
      return nowMs > expiresAtMs;
    }
  };
}

export async function ensureFindingsLockKey(root) {
  const keyPath = path.join(root, FINDINGS_LOCK_KEY_REL);
  await mkdir(path.dirname(keyPath), { recursive: true });
  const existing = await readUtf8OrNull(keyPath);
  if (existing && existing.trim()) {
    return existing.trim();
  }
  const nextKey = randomBytes(32).toString("hex");
  try {
    await writeFile(keyPath, `${nextKey}\n`, { flag: "wx" });
    return nextKey;
  } catch (error) {
    if (String(error?.code || "") !== "EEXIST") {
      throw error;
    }
    const current = await readUtf8OrNull(keyPath);
    if (current && current.trim()) {
      return current.trim();
    }
    throw new Error("[GOVERNANCE_FINDINGS] lock key missing");
  }
}

export async function writeTextAtomic(absPath, text) {
  await mkdir(path.dirname(absPath), { recursive: true });
  const existing = await readUtf8OrNull(absPath);
  if (existing !== null) {
    if (existing !== text) {
      throw new Error(`[GOVERNANCE_FINDINGS] refusing to overwrite existing file: ${absPath}`);
    }
    return { created: false, absPath };
  }

  const tmpPath = path.join(
    path.dirname(absPath),
    `.${path.basename(absPath)}.${process.pid}.${Date.now()}.${randomBytes(6).toString("hex")}.tmp`
  );
  await writeFile(tmpPath, text, "utf8");
  try {
    await rename(tmpPath, absPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    const current = await readUtf8OrNull(absPath);
    if (current === text) {
      return { created: false, absPath };
    }
    throw error;
  }
  return { created: true, absPath };
}

export async function replaceTextAtomic(absPath, expectedText, nextText) {
  await mkdir(path.dirname(absPath), { recursive: true });
  const existing = await readUtf8OrNull(absPath);
  if (existing === null) {
    throw new Error(`[GOVERNANCE_FINDINGS] refusing to replace missing file: ${absPath}`);
  }
  if (existing === nextText) {
    return { replaced: false, absPath };
  }
  if (existing !== expectedText) {
    throw new Error(`[GOVERNANCE_FINDINGS] refusing to overwrite existing file: ${absPath}`);
  }

  const tmpPath = path.join(
    path.dirname(absPath),
    `.${path.basename(absPath)}.${process.pid}.${Date.now()}.${randomBytes(6).toString("hex")}.tmp`
  );
  await writeFile(tmpPath, nextText, "utf8");
  try {
    await rename(tmpPath, absPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    const current = await readUtf8OrNull(absPath);
    if (current === nextText) {
      return { replaced: true, absPath };
    }
    throw error;
  }
  return { replaced: true, absPath };
}
