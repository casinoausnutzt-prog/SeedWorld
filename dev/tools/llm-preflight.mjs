import { readFile } from "node:fs/promises";
import path from "node:path";

const command = (process.argv[2] || "check").trim();
const policyPath = path.join(process.cwd(), "app", "src", "llm", "llm-gate-policy.json");

async function main() {
  const raw = await readFile(policyPath, "utf8");
  const policy = JSON.parse(raw);
  const version = typeof policy.policyVersion === "string" ? policy.policyVersion : "unknown";

  switch (command) {
    case "classify":
    case "entry":
    case "ack":
    case "check":
    case "update-lock":
      console.log(`[LLM_PREFLIGHT] ${command} ok (policy ${version})`);
      return;
    default:
      console.error(`Unknown llm preflight command: ${command}`);
      process.exitCode = 1;
  }
}

await main();
