#!/usr/bin/env node
// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor DEV-GOVERNANCE-RUNNER
//
// CLI-Runner fuer die Governance-Pipeline.
// Verwendung:
//   node dev/governance/runChecks.mjs                  # verify-first (default)
//   node dev/governance/runChecks.mjs --sync           # sync-and-verify
//   node dev/governance/runChecks.mjs --verify-only    # nur verify, fail-closed

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "./policyEngine.mjs";
import { generateEvidenceReport } from "./evidenceReporter.mjs";
import { validateModuleContract, validateModuleSource } from "../../engine/kernel/moduleValidator.js";
import { runReproductionProof } from "../../engine/proof/reproductionProof.js";
import * as gameModule from "../../engine/game/gameModule.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const syncMode = args.includes("--sync");
const verifyOnly = args.includes("--verify-only");
const mode = syncMode ? "sync-and-verify" : "verify-first";

async function main() {
  console.log(`[GOVERNANCE] Modus: ${mode}`);
  console.log(`[GOVERNANCE] Repo-Root: ${root}`);
  console.log("");

  // 1. Modul-Vertrag pruefen
  const moduleReport = validateModuleContract(gameModule);
  console.log(`[GOVERNANCE] module:contract -> ${moduleReport.valid ? "PASS" : "FAIL"}`);
  if (!moduleReport.valid) {
    for (const err of moduleReport.errors) console.log(`  ERROR: ${err}`);
  }

  // 2. Modul-Source pruefen
  const gameModulePath = path.join(root, "engine/game/gameModule.js");
  const sourceCode = await readFile(gameModulePath, "utf-8");
  const sourceReport = validateModuleSource(sourceCode);
  console.log(`[GOVERNANCE] module:source -> ${sourceReport.valid ? "PASS" : "FAIL"}`);
  if (!sourceReport.valid) {
    for (const ref of sourceReport.forbiddenReferences) console.log(`  FORBIDDEN: ${ref}`);
  }
  for (const warn of sourceReport.warnings) console.log(`  WARNING: ${warn}`);

  // 3. Reproduktionsbeweis
  console.log(`[GOVERNANCE] determinism:proof -> running...`);
  const proofReport = await runReproductionProof({
    seed: "governance-check-seed",
    ticks: 16,
    registerModule: (engine) => engine.registerModule(gameModule)
  });
  console.log(`[GOVERNANCE] determinism:proof -> ${proofReport.status}`);
  console.log(`  Fingerprint A: ${proofReport.fingerprintA}`);
  console.log(`  Fingerprint B: ${proofReport.fingerprintB}`);
  console.log(`  Match: ${proofReport.fingerprintMatch}`);

  // 4. State-Immutability-Check
  const immutabilityCheck = proofReport.stateMatch && proofReport.snapshotMatch;

  // 5. Seed-Konsistenz
  const seedConsistent = proofReport.fingerprintMatch;

  // 6. Pipeline ausfuehren
  const context = {
    moduleReport,
    sourceReport,
    proofReport,
    immutabilityCheck,
    seedConsistent,
    evidencePath: path.join(root, "runtime/evidence")
  };

  const report = await runPipeline({ mode, context });

  // 7. Detaillierten Evidence-Bericht generieren
  const evidence = await generateEvidenceReport(context);
  console.log(`[GOVERNANCE] evidence:report -> GENERATED (ID: ${evidence.id})`);
  console.log(`  Path: ${evidence.path}`);
  console.log(`  Integrity Hash: ${evidence.hash}`);

  console.log("");
  console.log("=== GOVERNANCE REPORT ===");
  console.log(`Status: ${report.overall_status}`);
  console.log(`Policy: ${report.policy}`);
  console.log(`Modus:  ${report.mode}`);
  console.log("");
  for (const step of report.steps) {
    const icon = step.status === "PASS" ? "✓" : step.status === "FAIL" ? "✗" : "○";
    console.log(`  ${icon} ${step.id}: ${step.status}${step.error ? ` (${step.error})` : ""}`);
  }
  console.log("");

  if (report.overall_status === "PASS") {
    console.log("[GOVERNANCE] Alle Checks bestanden.");
    process.exit(0);
  } else {
    console.log(`[GOVERNANCE] Fehlgeschlagen bei: ${report.failure_step}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[GOVERNANCE] Fataler Fehler: ${error.message}`);
  process.exit(2);
});
