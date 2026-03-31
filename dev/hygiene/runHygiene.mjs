#!/usr/bin/env node
// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor HYGIENE-2.0-RUNNER
//
// CLI-Runner fuer die Repo-Hygiene 2.0.
// Scant das Repository, prueft Namenskonventionen, Doc-Anchors
// und validiert die Docs 2.0 Struktur.

import { scanDirectory, checkAnchors, validateFilename, createReportEntry } from "./core.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = process.cwd();
const REPORT_DIR = path.join(REPO_ROOT, "runtime/evidence");
const REPORT_FILE = path.join(REPORT_DIR, "hygiene-report-2.0.json");

const CONFIG = {
  exclude: [".git", "node_modules", "runtime/evidence"],
  include: [".js", ".mjs", ".md", ".json"],
  requiredAnchors: {
    ".js": ["ENGINE-CORE"],
    ".mjs": ["HYGIENE-2.0-CORE"],
    ".md": ["SYSTEM-PLAN"]
  },
  filenamePatterns: {
    ".js": /^[a-zA-Z0-9_-]+\.js$/,
    ".mjs": /^[a-zA-Z0-9_-]+\.mjs$/,
    ".md": /^[a-zA-Z0-9_-]+\.md$/
  }
};

async function main() {
  console.log("[HYGIENE 2.0] Starte Repo-Hygiene-Check...");
  console.log(`[HYGIENE 2.0] Repo-Root: ${REPO_ROOT}`);

  const files = await scanDirectory(REPO_ROOT, { exclude: CONFIG.exclude, include: CONFIG.include });
  const reports = [];

  for (const file of files) {
    const ext = path.extname(file);
    const filename = path.basename(file);

    // 1. Namenskonventionen pruefen
    const pattern = CONFIG.filenamePatterns[ext];
    if (pattern && !validateFilename(filename, pattern)) {
      reports.push(createReportEntry(file, "WARN", `Dateiname '${filename}' entspricht nicht der Konvention.`));
    }

    // 2. Doc-Anchors pruefen
    const anchors = CONFIG.requiredAnchors[ext];
    if (anchors) {
      const { valid, missing } = await checkAnchors(file, anchors);
      if (!valid) {
        reports.push(createReportEntry(file, "FAIL", `Fehlende Doc-Anchors: ${missing.join(", ")}`));
      }
    }
  }

  // 3. Report speichern
  const finalReport = {
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    total_files: files.length,
    total_issues: reports.length,
    issues: reports
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(REPORT_FILE, JSON.stringify(finalReport, null, 2), "utf-8");

  console.log("");
  console.log("=== HYGIENE 2.0 REPORT ===");
  console.log(`Status: ${reports.length === 0 ? "PASS" : "FAIL"}`);
  console.log(`Gepruefte Dateien: ${files.length}`);
  console.log(`Gefundene Probleme: ${reports.length}`);
  console.log("");

  if (reports.length > 0) {
    for (const issue of reports) {
      const icon = issue.status === "FAIL" ? "✗" : "⚠";
      console.log(`  ${icon} ${issue.file}: ${issue.message}`);
    }
    process.exit(1);
  } else {
    console.log("[HYGIENE 2.0] Alle Checks bestanden.");
    process.exit(0);
  }
}

main().catch(error => {
  console.error(`[HYGIENE 2.0] Fataler Fehler: ${error.message}`);
  process.exit(2);
});
