#!/usr/bin/env node
// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor DOCS-2.0-SYNC-RUNNER
//
// CLI-Runner fuer die Docs 2.0 Synchronisation.
// Synchronisiert SOT-Dateien, archiviert erledigte Tasks
// und erzeugt Fuehrungsseiten aus registrierten JSON-Daten.

import { loadSOT, generateGuidePage, syncStringMatrix, archiveTasks } from "./sync.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = process.cwd();
const SOT_DIR = path.join(REPO_ROOT, "app/src/sot");
const DOCS_DIR = path.join(REPO_ROOT, "docs/V2");
const TASKS_DIR = path.join(REPO_ROOT, "tem/tasks/open");
const ARCHIVE_DIR = path.join(REPO_ROOT, "tem/tasks/archive");

const CONFIG = {
  sotFiles: [
    "docs-v2.json",
    "source-of-truth.json",
    "repo-boundaries.json"
  ],
  guidePages: [
    { template: "docs/V2/HOME.md", sot: "docs-v2.json", output: "docs/V2/HOME.md" },
    { template: "docs/V2/SYSTEM_PLAN.md", sot: "source-of-truth.json", output: "docs/V2/SYSTEM_PLAN.md" }
  ],
  stringMatrixSource: [
    "app/src/game/gameConfig.js",
    "app/src/game/gameConstants.js"
  ],
  stringMatrixOutput: path.join(SOT_DIR, "STRING_MATRIX.json")
};

async function main() {
  console.log("[DOCS SYNC] Starte Docs 2.0 Synchronisation...");
  console.log(`[DOCS SYNC] Repo-Root: ${REPO_ROOT}`);

  // 1. SOT-Dateien laden
  const sotData = {};
  for (const file of CONFIG.sotFiles) {
    const filePath = path.join(SOT_DIR, file);
    sotData[file] = await loadSOT(filePath).catch(() => ({}));
  }

  // 2. Fuehrungsseiten erzeugen
  for (const page of CONFIG.guidePages) {
    const templatePath = path.join(REPO_ROOT, page.template);
    const outputPath = path.join(REPO_ROOT, page.output);
    const data = sotData[page.sot];
    await generateGuidePage(templatePath, data, outputPath);
    console.log(`[DOCS SYNC] Fuehrungsseite erzeugt: ${page.output}`);
  }

  // 3. String-Matrix synchronisieren
  const sourceFiles = CONFIG.stringMatrixSource.map(f => path.join(REPO_ROOT, f));
  const matrix = await syncStringMatrix(sourceFiles, CONFIG.stringMatrixOutput);
  console.log(`[DOCS SYNC] String-Matrix synchronisiert: ${CONFIG.stringMatrixOutput} (${matrix.strings.length} Strings)`);

  // 4. Erledigte Tasks archivieren
  const archived = await archiveTasks(TASKS_DIR, ARCHIVE_DIR);
  console.log(`[DOCS SYNC] ${archived.length} Tasks archiviert.`);

  console.log("");
  console.log("=== DOCS SYNC COMPLETED ===");
  console.log(`Zeitpunkt: ${new Date().toISOString()}`);
  console.log("");
}

main().catch(error => {
  console.error(`[DOCS SYNC] Fataler Fehler: ${error.message}`);
  process.exit(1);
});
