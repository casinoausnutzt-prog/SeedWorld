import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { REQUIRED_READ_ORDER, collectReadState } from "./llm-read-shared.mjs";

const root = process.cwd();
const writeMode = process.argv.includes("--write");
const contractRel = "app/src/sot/llm-read-contract.v1.json";
const contractAbs = path.join(root, contractRel);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeContract(state) {
  return {
    schema_version: 1,
    policy_id: "governance-llm-read.v1",
    generated_at: new Date().toISOString(),
    required_read_order: REQUIRED_READ_ORDER,
    combined_hash: state.combinedHash,
    files: state.files.map((item) => ({
      path: item.relPath,
      sha256: item.sha256,
      bytes: item.bytes
    }))
  };
}

async function main() {
  const state = await collectReadState(root);
  const next = normalizeContract(state);
  const nextText = `${JSON.stringify(next, null, 2)}\n`;

  let current = "";
  try {
    current = await readFile(contractAbs, "utf8");
  } catch {
    current = "";
  }

  if (current !== nextText && writeMode) {
    await writeFile(contractAbs, nextText, "utf8");
  }

  if (current !== nextText && !writeMode) {
    console.error("[LLM_CONTRACT] DRIFT");
    console.error(`[LLM_CONTRACT] expected_sha=${sha256(nextText)} current_sha=${sha256(current || "missing")}`);
    console.error("[LLM_CONTRACT] FIX: npm run governance:llm:sync");
    process.exit(1);
  }

  console.log(`[LLM_CONTRACT] ${writeMode ? "WRITTEN" : "VERIFIED"} hash=${state.combinedHash.slice(0, 16)}`);
}

await main();
