// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor HYGIENE-2.0-CORE
//
// Basis-Logik fuer die Repo-Hygiene 2.0.
// Bietet Funktionen zum Scannen von Dateien, Pruefen von Namenskonventionen
// und Validieren von Datei-Headern.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Scant ein Verzeichnis rekursiv und gibt alle Dateipfade zurueck. */
export async function scanDirectory(dir, options = {}) {
  const { exclude = [], include = [] } = options;
  const results = [];

  async function _scan(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      if (exclude.some(pattern => relativePath.includes(pattern))) continue;

      if (entry.isDirectory()) {
        await _scan(fullPath);
      } else {
        if (include.length === 0 || include.some(pattern => relativePath.endsWith(pattern))) {
          results.push(relativePath);
        }
      }
    }
  }

  await _scan(dir);
  return results;
}

/** Prueft, ob eine Datei die erforderlichen Doc-Anchors enthaelt. */
export async function checkAnchors(filePath, requiredAnchors = []) {
  const content = await readFile(filePath, "utf-8");
  const missing = [];
  for (const anchor of requiredAnchors) {
    if (!content.includes(`@doc-anchor ${anchor}`)) {
      missing.push(anchor);
    }
  }
  return { valid: missing.length === 0, missing };
}

/** Validiert Dateinamen gegen ein Regex-Pattern. */
export function validateFilename(filename, pattern) {
  return pattern.test(filename);
}

/** Erzeugt einen Hygiene-Report-Eintrag. */
export function createReportEntry(file, status, message, details = {}) {
  return {
    file,
    status, // "PASS", "FAIL", "WARN"
    message,
    timestamp: new Date().toISOString(),
    ...details
  };
}
