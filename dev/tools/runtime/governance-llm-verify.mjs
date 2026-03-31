import path from "node:path";
import { readJson } from "./docs-v2-shared.mjs";
import {
  compareFileInventory,
  REQUIRED_READ_ORDER,
  collectReadState,
  findDuplicateValues,
  normalizeReadPath
} from "./llm-read-shared.mjs";
import {
  checkGovernanceDomain,
  errorPath,
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
const CONTRACT_REL = "app/src/sot/llm-read-contract.v1.json";

function normalizeList(values) {
  return (values || []).map((value) => normalizeReadPath(value));
}

function compareReadState(contract, state, issues) {
  const contractPaths = normalizeList(contract.required_read_order || []);
  if (contractPaths.join("|") !== REQUIRED_READ_ORDER.join("|")) {
    issues.push(issue("ORDER", "required_read_order does not match governance read order"));
  }

  if (state.files.map((item) => normalizeReadPath(item.relPath)).join("|") !== REQUIRED_READ_ORDER.join("|")) {
    issues.push(issue("STATE", "runtime read inventory does not match governance read order"));
  }

  compareFileInventory({
    label: "llm-read-contract",
    expectedEntries: contract.files,
    actualEntries: state.files,
    expectedPathOf: (entry) => entry.path,
    actualPathOf: (entry) => entry.relPath,
    exactOrder: true,
    emitIssue: (code, message) => issues.push(issue(code, message))
  });
}

async function main() {
  const issues = [];
  let docsV2 = null;
  let sourceOfTruth = null;
  let contract = null;
  let state = null;
  try {
    docsV2 = await readJson(path.join(root, "app", "src", "sot", "docs-v2.json"));
    sourceOfTruth = await readJson(path.join(root, "app", "src", "sot", "source-of-truth.json"));
    contract = await readJson(path.join(root, CONTRACT_REL));
    state = await collectReadState(root);
  } catch (error) {
    issues.push(issue("IO", `unable to load governance inputs: ${errorPath(error, CONTRACT_REL)}`));
  }

  if (!ensureObject(issues, "llm-read-contract", contract)) {
    failClosed("GOVERNANCE_LLM", issues);
    return;
  }
  if (!ensureExactKeys(issues, "llm-read-contract", contract, [
    "schema_version",
    "policy_id",
    "generated_at",
    "required_read_order",
    "combined_hash",
    "files"
  ])) {
    failClosed("GOVERNANCE_LLM", issues);
    return;
  }

  if (contract.schema_version !== 1) {
    issues.push(issue("SCHEMA", "llm-read-contract schema_version must be 1"));
  }
  if (contract.policy_id !== "governance-llm-read.v1") {
    issues.push(issue("SCHEMA", "llm-read-contract policy_id mismatch"));
  }
  if (!isIsoTimestamp(contract.generated_at)) {
    issues.push(issue("SCHEMA", "llm-read-contract generated_at invalid"));
  }
  if (!Array.isArray(contract.required_read_order) || contract.required_read_order.some((value) => typeof value !== "string")) {
    issues.push(issue("SCHEMA", "llm-read-contract required_read_order must be a string array"));
  }
  if (!Array.isArray(contract.files)) {
    issues.push(issue("SCHEMA", "llm-read-contract files must be an array"));
  }
  if (!isHex64(contract.combined_hash)) {
    issues.push(issue("SCHEMA", "llm-read-contract combined_hash invalid"));
  }

  const contractDuplicates = findDuplicateValues((contract.required_read_order || []).map((value) => normalizeReadPath(value)));
  if (contractDuplicates.length > 0) {
    issues.push(issue("DUPLICATE", `required_read_order duplicates=${contractDuplicates.join(",")}`));
  }

  if (Array.isArray(contract.files)) {
    const filePaths = contract.files.map((entry) => normalizeReadPath(entry?.path));
    const duplicateFilePaths = findDuplicateValues(filePaths);
    if (duplicateFilePaths.length > 0) {
      issues.push(issue("DUPLICATE", `contract file paths duplicates=${duplicateFilePaths.join(",")}`));
    }
    for (let index = 0; index < contract.files.length; index += 1) {
      const entry = contract.files[index];
      if (!ensureObject(issues, `llm-read-contract.files[${index}]`, entry)) {
        continue;
      }
      if (!ensureExactKeys(issues, `llm-read-contract.files[${index}]`, entry, ["path", "sha256", "bytes"])) {
        continue;
      }
      if (typeof entry.path !== "string" || !entry.path.trim()) {
        issues.push(issue("SCHEMA", `llm-read-contract.files[${index}] path invalid`));
      }
      if (!isHex64(entry.sha256)) {
        issues.push(issue("SCHEMA", `llm-read-contract.files[${index}] sha256 invalid`));
      }
      if (!Number.isInteger(entry.bytes) || entry.bytes < 0) {
        issues.push(issue("SCHEMA", `llm-read-contract.files[${index}] bytes invalid`));
      }
    }
  }

  if (state) {
    compareReadState(contract, state, issues);
  }

  if ((contract.required_read_order || []).join("|") !== REQUIRED_READ_ORDER.join("|")) {
    issues.push(issue("ORDER", "contract required_read_order drift"));
  }
  if (state && contract.combined_hash !== state.combinedHash) {
    issues.push(issue("PARITY", "llm-read-contract combined_hash drift"));
  }

  if (docsV2 && sourceOfTruth) {
    checkGovernanceDomain(sourceOfTruth, docsV2, issues);
  }

  failClosed("GOVERNANCE_LLM", issues);
  console.log(`[GOVERNANCE_LLM] OK hash=${state.combinedHash.slice(0, 16)} files=${state.files.length}`);
}

await main();
