import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const writeMode = process.argv.includes("--write");
const subAgentDir = path.join(root, "Sub_Agent");
const manifestRel = "app/src/sot/sub-agent-manifest.v1.json";
const manifestAbs = path.join(root, manifestRel);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function collectSubAgentFiles() {
  const entries = await readdir(subAgentDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const out = [];
  for (const name of files) {
    const rel = `Sub_Agent/${name}`;
    const raw = await readFile(path.join(root, rel), "utf8");
    out.push({
      path: rel,
      sha256: sha256(raw),
      bytes: Buffer.byteLength(raw, "utf8")
    });
  }
  return out;
}

async function main() {
  const files = await collectSubAgentFiles();
  const combined = sha256(files.map((item) => `${item.path}:${item.sha256}`).join("|"));
  const requiredRoleFiles = files
    .map((item) => item.path)
    .filter((item) => /^Sub_Agent\/\d\d_.+\.md$/.test(item));

  const next = {
    schema_version: 1,
    policy_id: "governance-sub-agent.v1",
    generated_at: new Date().toISOString(),
    required_roles: requiredRoleFiles,
    combined_hash: combined,
    files
  };
  const nextText = `${JSON.stringify(next, null, 2)}\n`;

  let current = "";
  try {
    current = await readFile(manifestAbs, "utf8");
  } catch {
    current = "";
  }

  if (current !== nextText && writeMode) {
    await writeFile(manifestAbs, nextText, "utf8");
  }

  if (current !== nextText && !writeMode) {
    console.error("[SUB_AGENT_MANIFEST] DRIFT");
    console.error(`[SUB_AGENT_MANIFEST] expected_sha=${sha256(nextText)} current_sha=${sha256(current || "missing")}`);
    console.error("[SUB_AGENT_MANIFEST] FIX: npm run governance:subagent:sync");
    process.exit(1);
  }

  console.log(`[SUB_AGENT_MANIFEST] ${writeMode ? "WRITTEN" : "VERIFIED"} hash=${combined.slice(0, 16)}`);
}

await main();
