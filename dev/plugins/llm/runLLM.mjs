#!/usr/bin/env node
// @doc-anchor DEV-LLM-RUNNER
//
// CLI-Runner fuer das LLM-Plugin.
// Verwendung:
//   node dev/plugins/llm/runLLM.mjs review         # Code-Review des Game-Moduls
//   node dev/plugins/llm/runLLM.mjs audit           # Determinismus-Audit
//   node dev/plugins/llm/runLLM.mjs generate-tests  # Test-Generierung
//   node dev/plugins/llm/runLLM.mjs --model gpt-4.1-nano  # Modell waehlen

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LLMClient, reviewModuleSource, auditDeterminism, generateTests } from "./llmPlugin.mjs";
import { runReproductionProof } from "../../../engine/proof/reproductionProof.js";
import * as gameModule from "../../../engine/game/gameModule.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("--")) || "review";
const modelFlag = args.indexOf("--model");
const model = modelFlag >= 0 && args[modelFlag + 1] ? args[modelFlag + 1] : "gpt-4.1-mini";

async function main() {
  const client = new LLMClient({ model });
  console.log(`[LLM] Modell: ${model}`);
  console.log(`[LLM] Kommando: ${command}`);
  console.log("");

  if (command === "review") {
    const sourceCode = await readFile(path.join(root, "engine/game/gameModule.js"), "utf-8");
    const result = await reviewModuleSource(client, sourceCode, "gameModule");
    console.log("=== CODE REVIEW ===");
    console.log(result.review);
  } else if (command === "audit") {
    console.log("[LLM] Fuehre Reproduktionsbeweis aus...");
    const proofReport = await runReproductionProof({
      seed: "llm-audit-seed",
      ticks: 16,
      registerModule: (engine) => engine.registerModule(gameModule)
    });
    console.log(`[LLM] Proof-Status: ${proofReport.status}`);
    const result = await auditDeterminism(client, proofReport);
    console.log("");
    console.log("=== DETERMINISMUS AUDIT ===");
    console.log(result.audit);
  } else if (command === "generate-tests") {
    const sourceCode = await readFile(path.join(root, "engine/game/gameModule.js"), "utf-8");
    const result = await generateTests(client, sourceCode, "gameModule");
    console.log("=== GENERIERTE TESTS ===");
    console.log(result.tests);
  } else {
    console.log(`[LLM] Unbekanntes Kommando: ${command}`);
    console.log("Verfuegbar: review, audit, generate-tests");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[LLM] Fehler: ${error.message}`);
  process.exit(2);
});
