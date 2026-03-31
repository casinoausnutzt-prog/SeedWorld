import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { readJson } from "./docs-v2-shared.mjs";

const root = process.cwd();

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const sourceOfTruth = await readJson(path.join(root, "app", "src", "sot", "source-of-truth.json"));
  const docsV2 = await readJson(path.join(root, "app", "src", "sot", "docs-v2.json"));
  const manifest = await readJson(path.join(root, "app", "src", "sot", "sub-agent-manifest.v1.json"));

  ensure(manifest.schema_version === 1, "[GOVERNANCE_SUBAGENT] manifest schema_version must be 1");
  ensure(Array.isArray(manifest.files) && manifest.files.length > 0, "[GOVERNANCE_SUBAGENT] manifest files missing");
  ensure(
    Array.isArray(manifest.required_roles) && manifest.required_roles.length > 0,
    "[GOVERNANCE_SUBAGENT] manifest required_roles missing"
  );

  const subAgentFiles = [];
  for (const item of manifest.files) {
    const relPath = String(item.path || "");
    const raw = await readFile(path.join(root, relPath), "utf8");
    const digest = sha256(raw);
    ensure(item.sha256 === digest, `[GOVERNANCE_SUBAGENT] hash drift in ${relPath}`);
    subAgentFiles.push(relPath);
  }
  const combined = sha256(manifest.files.map((item) => `${item.path}:${item.sha256}`).join("|"));
  ensure(combined === manifest.combined_hash, "[GOVERNANCE_SUBAGENT] combined_hash mismatch");

  const missingRoleFiles = manifest.required_roles.filter((relPath) => !subAgentFiles.includes(relPath));
  ensure(missingRoleFiles.length === 0, `[GOVERNANCE_SUBAGENT] missing required role files: ${missingRoleFiles.join(", ")}`);

  const governanceDomain = (sourceOfTruth.domains || []).find((entry) => entry.id === "governance_procedure");
  ensure(governanceDomain, "[GOVERNANCE_SUBAGENT] missing governance_procedure domain");
  ensure(
    (governanceDomain.authoritative || []).includes("Sub_Agent/"),
    "[GOVERNANCE_SUBAGENT] Sub_Agent/ must be authoritative in governance_procedure"
  );

  const requiredControlFiles = new Set(docsV2.registeredControlFiles || []);
  for (const relPath of subAgentFiles) {
    ensure(requiredControlFiles.has(relPath), `[GOVERNANCE_SUBAGENT] docs-v2 missing control registration for ${relPath}`);
  }

  console.log(`[GOVERNANCE_SUBAGENT] OK files=${subAgentFiles.length} hash=${combined.slice(0, 16)}`);
}

await main();
