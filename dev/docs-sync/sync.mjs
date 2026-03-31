// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor DOCS-2.0-SYNC
//
// Synchronisations-Mechanismus fuer Docs 2.0.
// Verbindet SOT-Dateien (Source of Truth) mit der Dokumentation.
// Erzeugt Fuehrungsseiten aus registrierten JSON-Daten.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/** Laedt eine SOT-Datei (JSON) und gibt die Daten zurueck. */
export async function loadSOT(filePath) {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`[DOCS_SYNC] Fehler beim Laden der SOT-Datei '${filePath}': ${error.message}`);
  }
}

/** Erzeugt eine Markdown-Fuehrungsseite aus SOT-Daten. */
export async function generateGuidePage(templatePath, data, outputPath) {
  let template = await readFile(templatePath, "utf-8");
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    template = template.replaceAll(placeholder, String(value));
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, template, "utf-8");
  return outputPath;
}

/** Synchronisiert die String-Matrix mit den aktiven Spiel-Strings. */
export async function syncStringMatrix(sourceFiles, matrixPath) {
  const matrix = await loadSOT(matrixPath).catch(() => ({ strings: [] }));
  const foundStrings = new Set();

  for (const file of sourceFiles) {
    const content = await readFile(file, "utf-8");
    const matches = content.matchAll(/["']([A-Z0-9_]{3,})["']/g);
    for (const match of matches) {
      foundStrings.add(match[1]);
    }
  }

  const updatedMatrix = {
    version: (matrix.version || 0) + 1,
    last_sync: new Date().toISOString(),
    strings: [...foundStrings].sort()
  };

  await writeFile(matrixPath, JSON.stringify(updatedMatrix, null, 2), "utf-8");
  return updatedMatrix;
}

/** Archiviert erledigte Tasks. */
export async function archiveTasks(openTasksDir, archiveDir) {
  const { readdir, rename } = await import("node:fs/promises");
  const files = await readdir(openTasksDir);
  const archived = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const content = await readFile(path.join(openTasksDir, file), "utf-8");
    const task = JSON.parse(content);

    if (task.status === "DONE" || task.status === "ARCHIVED") {
      await mkdir(archiveDir, { recursive: true });
      await rename(path.join(openTasksDir, file), path.join(archiveDir, file));
      archived.push(file);
    }
  }
  return archived;
}
