import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJson } from "./docs-v2-shared.mjs";
import {
  compareFileInventory,
  collectFileState,
  findDuplicateValues,
  normalizeReadPath
} from "./llm-read-shared.mjs";
import {
  checkGovernanceDomain,
  errorPath as governanceErrorPath,
  failClosed,
  ensureExactKeys,
  ensureObject,
  isHex64,
  isIsoTimestamp,
  issue,
  validateContractEnvelope,
  validateFileEntries,
  validateStringList
} from "./llm-governance/shared.mjs";

const root = process.cwd();
const MANIFEST_REL = "app/src/sot/sub-agent-manifest.v1.json";

function errorPath(error, fallback) {
  return governanceErrorPath(error, fallback, root);
}

async function collectActualInventory() {
  const entries = await readdir(path.join(root, "Sub_Agent"), { withFileTypes: true });
  const relPaths = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => `Sub_Agent/${entry.name}`)
    .sort((a, b) => a.localeCompare(b, "en"));
  return collectFileState(root, relPaths);
}

function compareInventory(manifest, state, issues) {
  compareFileInventory({
    label: "sub-agent-manifest",
    expectedEntries: manifest.files,
    actualEntries: state.files,
    expectedPathOf: (entry) => entry.path,
    actualPathOf: (entry) => entry.relPath,
    exactOrder: true,
    emitIssue: (code, message) => issues.push(issue(code, message))
  });
}

function compareRequiredRoles(manifest, state, issues) {
  const roles = (manifest.required_roles || []).map((value) => normalizeReadPath(value));
  const expectedRoles = state.files
    .map((entry) => normalizeReadPath(entry.relPath))
    .filter((relPath) => /^Sub_Agent\/\d\d_.+\.md$/.test(relPath));
  if (roles.join("|") !== expectedRoles.join("|")) {
    issues.push(issue("PARITY", "required_roles does not match runtime role inventory"));
  }
}

async function main() {
  const issues = [];
  let sourceOfTruth = null;
  let docsV2 = null;
  let manifest = null;
  let state = null;
  try {
    sourceOfTruth = await readJson(path.join(root, "app", "src", "sot", "source-of-truth.json"));
    docsV2 = await readJson(path.join(root, "app", "src", "sot", "docs-v2.json"));
    manifest = await readJson(path.join(root, MANIFEST_REL));
    state = await collectActualInventory();
  } catch (error) {
    issues.push(issue("IO", `unable to load governance inputs: ${errorPath(error, MANIFEST_REL)}`));
  }

  if (!ensureObject(issues, "sub-agent-manifest", manifest)) {
    failClosed("GOVERNANCE_SUBAGENT", issues);
    return;
  }
  if (!ensureExactKeys(issues, "sub-agent-manifest", manifest, [
    "schema_version",
    "policy_id",
    "generated_at",
    "required_roles",
    "combined_hash",
    "files"
  ])) {
    failClosed("GOVERNANCE_SUBAGENT", issues);
    return;
  }

  if (manifest.schema_version !== 1) {
    issues.push(issue("SCHEMA", "sub-agent-manifest schema_version must be 1"));
  }
  if (manifest.policy_id !== "governance-sub-agent.v1") {
    issues.push(issue("SCHEMA", "sub-agent-manifest policy_id mismatch"));
  }
  if (!isIsoTimestamp(manifest.generated_at)) {
    issues.push(issue("SCHEMA", "sub-agent-manifest generated_at invalid"));
  }
  if (!Array.isArray(manifest.required_roles) || manifest.required_roles.some((value) => typeof value !== "string")) {
    issues.push(issue("SCHEMA", "sub-agent-manifest required_roles must be a string array"));
  }
  if (!Array.isArray(manifest.files)) {
    issues.push(issue("SCHEMA", "sub-agent-manifest files must be an array"));
  }
  if (!isHex64(manifest.combined_hash)) {
    issues.push(issue("SCHEMA", "sub-agent-manifest combined_hash invalid"));
  }

  const requiredRoleDuplicates = findDuplicateValues((manifest.required_roles || []).map((value) => normalizeReadPath(value)));
  if (requiredRoleDuplicates.length > 0) {
    issues.push(issue("DUPLICATE", `required_roles duplicates=${requiredRoleDuplicates.join(",")}`));
  }

  if (Array.isArray(manifest.files)) {
    const manifestDuplicates = findDuplicateValues(manifest.files.map((entry) => normalizeReadPath(entry?.path)));
    if (manifestDuplicates.length > 0) {
      issues.push(issue("DUPLICATE", `file paths duplicates=${manifestDuplicates.join(",")}`));
    }
    for (let index = 0; index < manifest.files.length; index += 1) {
      const entry = manifest.files[index];
      if (!ensureObject(issues, `sub-agent-manifest.files[${index}]`, entry)) {
        continue;
      }
      if (!ensureExactKeys(issues, `sub-agent-manifest.files[${index}]`, entry, ["path", "sha256", "bytes"])) {
        continue;
      }
      if (typeof entry.path !== "string" || !entry.path.trim()) {
        issues.push(issue("SCHEMA", `sub-agent-manifest.files[${index}] path invalid`));
      }
      if (!isHex64(entry.sha256)) {
        issues.push(issue("SCHEMA", `sub-agent-manifest.files[${index}] sha256 invalid`));
      }
      if (!Number.isInteger(entry.bytes) || entry.bytes < 0) {
        issues.push(issue("SCHEMA", `sub-agent-manifest.files[${index}] bytes invalid`));
      }
    }
  }

  if (state) {
    compareInventory(manifest, state, issues);
    compareRequiredRoles(manifest, state, issues);
  }
  if (state && manifest.combined_hash !== state.combinedHash) {
    issues.push(issue("PARITY", "sub-agent-manifest combined_hash drift"));
  }

  if (docsV2 && sourceOfTruth) {
    checkGovernanceDomain(sourceOfTruth, docsV2, issues);
  }

  failClosed("GOVERNANCE_SUBAGENT", issues);
  console.log(`[GOVERNANCE_SUBAGENT] OK files=${state.files.length} hash=${state.combinedHash.slice(0, 16)}`);
}

await main();
