import path from "node:path";
import { readJson } from "./docs-v2-shared.mjs";
import { REQUIRED_READ_ORDER, collectReadState } from "./llm-read-shared.mjs";

const root = process.cwd();

function hasAll(values, required) {
  const set = new Set(values || []);
  return required.every((item) => set.has(item));
}

function findDomain(sourceOfTruth, id) {
  return (sourceOfTruth.domains || []).find((entry) => entry.id === id) || null;
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const docsV2 = await readJson(path.join(root, "app", "src", "sot", "docs-v2.json"));
  const sourceOfTruth = await readJson(path.join(root, "app", "src", "sot", "source-of-truth.json"));
  const contract = await readJson(path.join(root, "app", "src", "sot", "llm-read-contract.v1.json"));
  const state = await collectReadState(root);

  ensure(
    Array.isArray(contract.required_read_order) &&
      contract.required_read_order.join("|") === REQUIRED_READ_ORDER.join("|"),
    "[GOVERNANCE_LLM] invalid required_read_order contract"
  );
  ensure(contract.combined_hash === state.combinedHash, "[GOVERNANCE_LLM] LLM read contract hash drift");

  const governanceDomain = findDomain(sourceOfTruth, "governance_procedure");
  const outOfScopeDomain = findDomain(sourceOfTruth, "out_of_scope");
  const archiveDomain = findDomain(sourceOfTruth, "archive");

  ensure(governanceDomain, "[GOVERNANCE_LLM] missing governance_procedure domain in source-of-truth");
  ensure(governanceDomain.class === "Governance-Procedure", "[GOVERNANCE_LLM] governance_procedure class mismatch");
  ensure(
    hasAll(governanceDomain.authoritative || [], ["docs/LLM/", "Sub_Agent/"]),
    "[GOVERNANCE_LLM] governance_procedure must include docs/LLM/ and Sub_Agent/"
  );

  ensure(
    !((outOfScopeDomain?.authoritative || []).includes("docs/LLM/")),
    "[GOVERNANCE_LLM] docs/LLM/ must not be Out-of-Scope"
  );
  ensure(
    !((archiveDomain?.authoritative || []).includes("Sub_Agent/")),
    "[GOVERNANCE_LLM] Sub_Agent/ must not be Archive"
  );

  const bucket = (docsV2.fullRepoCoverage?.buckets || []).find((entry) => entry.id === "governance-procedure");
  ensure(bucket, "[GOVERNANCE_LLM] missing docs-v2 bucket governance-procedure");
  ensure(bucket.class === "Governance-Procedure", "[GOVERNANCE_LLM] governance-procedure bucket class mismatch");
  ensure(
    hasAll(bucket.paths || [], ["docs/LLM/", "Sub_Agent/"]),
    "[GOVERNANCE_LLM] docs-v2 governance-procedure bucket must include docs/LLM/ and Sub_Agent/"
  );

  const requiredControlFiles = [
    "docs/LLM/ENTRY.md",
    "docs/LLM/POLICY.md",
    "docs/LLM/INDEX.md",
    "docs/LLM/AKTUELLE_RED_ACTIONS.md",
    "Sub_Agent/INDEX.md",
    "app/src/sot/llm-read-contract.v1.json",
    "app/src/sot/sub-agent-manifest.v1.json"
  ];
  ensure(
    hasAll(docsV2.registeredControlFiles || [], requiredControlFiles),
    "[GOVERNANCE_LLM] docs-v2 registeredControlFiles missing LLM/Sub_Agent contracts"
  );

  console.log(`[GOVERNANCE_LLM] OK hash=${state.combinedHash.slice(0, 16)} files=${REQUIRED_READ_ORDER.length}`);
}

await main();
