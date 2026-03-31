import path from "node:path";
import { findDuplicateValues, normalizeReadPath } from "../llm-read-shared.mjs";

export const GOVERNANCE_DOMAIN_ID = "governance_procedure";
export const GOVERNANCE_DOMAIN_CLASS = "Governance-Procedure";
export const GOVERNANCE_BUCKET_ID = "governance-procedure";
export const GOVERNANCE_CONTROL_FILES = Object.freeze([
  "docs/LLM/ENTRY.md",
  "docs/LLM/POLICY.md",
  "docs/LLM/INDEX.md",
  "docs/LLM/AKTUELLE_RED_ACTIONS.md",
  "Sub_Agent/INDEX.md",
  "dev/tools/runtime/sync-llm-read-contract.mjs",
  "dev/tools/runtime/sync-sub-agent-manifest.mjs",
  "app/src/sot/llm-read-contract.v1.json",
  "app/src/sot/sub-agent-manifest.v1.json"
]);

const GOVERNANCE_AUTHORITATIVE_PATHS = Object.freeze([
  "docs/LLM/",
  "Sub_Agent/",
  "dev/tools/runtime/sync-llm-read-contract.mjs",
  "dev/tools/runtime/sync-sub-agent-manifest.mjs",
  "app/src/sot/llm-read-contract.v1.json",
  "app/src/sot/sub-agent-manifest.v1.json"
]);

const GOVERNANCE_BUCKET_PATHS = Object.freeze([
  "docs/LLM/",
  "Sub_Agent/",
  "app/src/sot/llm-read-contract.v1.json",
  "app/src/sot/sub-agent-manifest.v1.json"
]);

const GOVERNANCE_RESERVED_PATHS = Object.freeze([
  "docs/LLM/",
  "Sub_Agent/",
  "dev/tools/runtime/sync-llm-read-contract.mjs",
  "dev/tools/runtime/sync-sub-agent-manifest.mjs",
  "app/src/sot/llm-read-contract.v1.json",
  "app/src/sot/sub-agent-manifest.v1.json"
]);

export function issue(code, message) {
  return `[${code}] ${message}`;
}

export function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), "en"));
}

export function ensureObject(issues, label, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(issue("SCHEMA", `${label} must be an object`));
    return false;
  }
  return true;
}

export function ensureExactKeys(issues, label, value, expectedKeys) {
  const actualKeys = Object.keys(value || {});
  const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
  const extra = actualKeys.filter((key) => !expectedKeys.includes(key));
  if (missing.length === 0 && extra.length === 0) {
    return true;
  }
  const parts = [];
  if (missing.length > 0) {
    parts.push(`missing=${missing.sort((a, b) => a.localeCompare(b, "en")).join(",")}`);
  }
  if (extra.length > 0) {
    parts.push(`extra=${extra.sort((a, b) => a.localeCompare(b, "en")).join(",")}`);
  }
  issues.push(issue("SCHEMA", `${label} key mismatch ${parts.join(" ")}`));
  return false;
}

export function isHex64(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function errorPath(error, fallback, root = process.cwd()) {
  const candidate = normalizeReadPath(path.relative(root, String(error?.path || error?.fileName || fallback || "")));
  return candidate || normalizeReadPath(fallback || "unknown");
}

export function failClosed(prefix, issues) {
  const uniqueIssues = uniqueSorted(issues);
  if (uniqueIssues.length === 0) {
    return;
  }
  console.error(`[${prefix}] BLOCK`);
  for (const item of uniqueIssues) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

export function validateStringList(issues, label, values, duplicateLabel) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    issues.push(issue("SCHEMA", `${label} must be a string array`));
    return [];
  }
  const normalized = values.map((value) => normalizeReadPath(value));
  const duplicates = findDuplicateValues(normalized);
  if (duplicates.length > 0) {
    issues.push(issue("DUPLICATE", `${duplicateLabel} duplicates=${duplicates.join(",")}`));
  }
  return normalized;
}

export function validateFileEntries(issues, label, entries) {
  if (!Array.isArray(entries)) {
    issues.push(issue("SCHEMA", `${label} files must be an array`));
    return false;
  }
  const duplicatePaths = findDuplicateValues(entries.map((entry) => normalizeReadPath(entry?.path)));
  if (duplicatePaths.length > 0) {
    issues.push(issue("DUPLICATE", `${label} file paths duplicates=${duplicatePaths.join(",")}`));
  }
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!ensureObject(issues, `${label}.files[${index}]`, entry)) {
      continue;
    }
    if (!ensureExactKeys(issues, `${label}.files[${index}]`, entry, ["path", "sha256", "bytes"])) {
      continue;
    }
    if (typeof entry.path !== "string" || !entry.path.trim()) {
      issues.push(issue("SCHEMA", `${label}.files[${index}] path invalid`));
    }
    if (!isHex64(entry.sha256)) {
      issues.push(issue("SCHEMA", `${label}.files[${index}] sha256 invalid`));
    }
    if (!Number.isInteger(entry.bytes) || entry.bytes < 0) {
      issues.push(issue("SCHEMA", `${label}.files[${index}] bytes invalid`));
    }
  }
  return true;
}

export function validateContractEnvelope(issues, label, value, { policyId, listField }) {
  if (!ensureObject(issues, label, value)) {
    return false;
  }
  if (
    !ensureExactKeys(issues, label, value, [
      "schema_version",
      "policy_id",
      "generated_at",
      listField,
      "combined_hash",
      "files"
    ])
  ) {
    return false;
  }
  if (value.schema_version !== 1) {
    issues.push(issue("SCHEMA", `${label} schema_version must be 1`));
  }
  if (value.policy_id !== policyId) {
    issues.push(issue("SCHEMA", `${label} policy_id mismatch`));
  }
  if (!isIsoTimestamp(value.generated_at)) {
    issues.push(issue("SCHEMA", `${label} generated_at invalid`));
  }
  if (!Array.isArray(value[listField]) || value[listField].some((item) => typeof item !== "string")) {
    issues.push(issue("SCHEMA", `${label} ${listField} must be a string array`));
  }
  if (!Array.isArray(value.files)) {
    issues.push(issue("SCHEMA", `${label} files must be an array`));
  }
  if (!isHex64(value.combined_hash)) {
    issues.push(issue("SCHEMA", `${label} combined_hash invalid`));
  }
  return true;
}

export function checkGovernanceDomain(sourceOfTruth, docsV2, issues) {
  const domains = Array.isArray(sourceOfTruth?.domains) ? sourceOfTruth.domains : [];
  if (!Array.isArray(sourceOfTruth?.domains)) {
    issues.push(issue("SCHEMA", "source-of-truth.domains must be an array"));
    return;
  }

  const governanceDomain = domains.find((entry) => entry.id === GOVERNANCE_DOMAIN_ID) || null;
  if (!governanceDomain) {
    issues.push(issue("DOMAIN", "missing governance_procedure domain in source-of-truth"));
    return;
  }
  if (governanceDomain.class !== GOVERNANCE_DOMAIN_CLASS) {
    issues.push(issue("DOMAIN", "governance_procedure class mismatch"));
  }

  const governanceAuthoritative = Array.isArray(governanceDomain.authoritative)
    ? governanceDomain.authoritative.map((value) => normalizeReadPath(value))
    : [];
  for (const requiredPath of GOVERNANCE_AUTHORITATIVE_PATHS) {
    if (!governanceAuthoritative.includes(requiredPath)) {
      issues.push(issue("DOMAIN", `governance_procedure missing authoritative path ${requiredPath}`));
    }
  }

  for (const domain of domains) {
    if (domain.id === GOVERNANCE_DOMAIN_ID) {
      continue;
    }
    const authoritative = Array.isArray(domain.authoritative) ? domain.authoritative : [];
    for (const pathEntry of authoritative) {
      const normalized = normalizeReadPath(pathEntry);
      const isReserved = GOVERNANCE_RESERVED_PATHS.some(
        (reserved) => normalized === reserved || normalized.startsWith(reserved)
      );
      if (isReserved) {
        issues.push(issue("DOMAIN", `${domain.id} illegally claims governance path ${normalized}`));
      }
    }
  }

  const bucket = (docsV2?.fullRepoCoverage?.buckets || []).find((entry) => entry.id === GOVERNANCE_BUCKET_ID) || null;
  if (!bucket) {
    issues.push(issue("DOMAIN", "missing docs-v2 bucket governance-procedure"));
  } else {
    if (bucket.class !== GOVERNANCE_DOMAIN_CLASS) {
      issues.push(issue("DOMAIN", "docs-v2 governance-procedure bucket class mismatch"));
    }
    const bucketPaths = Array.isArray(bucket.paths) ? bucket.paths.map((value) => normalizeReadPath(value)) : [];
    if (bucketPaths.join("|") !== GOVERNANCE_BUCKET_PATHS.join("|")) {
      issues.push(issue("DOMAIN", "docs-v2 governance-procedure bucket paths mismatch"));
    }
  }

  const registered = Array.isArray(docsV2?.registeredControlFiles)
    ? docsV2.registeredControlFiles.map((value) => normalizeReadPath(value))
    : [];
  const duplicateRegistered = findDuplicateValues(registered);
  if (duplicateRegistered.length > 0) {
    issues.push(issue("DUPLICATE", `docs-v2 registeredControlFiles duplicates=${duplicateRegistered.join(",")}`));
  }
  for (const requiredPath of GOVERNANCE_CONTROL_FILES) {
    if (!registered.includes(requiredPath)) {
      issues.push(issue("DOMAIN", `docs-v2 missing control registration for ${requiredPath}`));
    }
  }
}
