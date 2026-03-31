// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor REBUTTAL-2.0
//
// Rebuttal-Logik fuer SeedWorld.
// Verwaltet Rebuttal-Eintraege fuer fehlgeschlagene Tests.
// Bietet Funktionen fuer Review-Prozesse und Justifizierungen.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

/** Erzeugt einen neuen Rebuttal-Eintrag. */
export async function createRebuttalEntry(testId, reason, justification, dir) {
  const entry = {
    testId,
    reason,
    justification,
    timestamp: new Date().toISOString(),
    status: "PENDING_REVIEW"
  };

  const fileName = `${testId}-rebuttal.json`;
  const filePath = path.join(dir, fileName);

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
  return filePath;
}

/** Listet alle ausstehenden Rebuttals auf. */
export async function listPendingRebuttals(dir) {
  const files = await readdir(dir);
  const pending = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const content = await readFile(path.join(dir, file), "utf-8");
    const entry = JSON.parse(content);

    if (entry.status === "PENDING_REVIEW") {
      pending.push(entry);
    }
  }
  return pending;
}

/** Akzeptiert oder lehnt ein Rebuttal ab. */
export async function reviewRebuttal(testId, decision, reviewer, dir) {
  const fileName = `${testId}-rebuttal.json`;
  const filePath = path.join(dir, fileName);

  const content = await readFile(filePath, "utf-8");
  const entry = JSON.parse(content);

  entry.status = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";
  entry.reviewer = reviewer;
  entry.reviewed_at = new Date().toISOString();

  await writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
  return entry;
}

/** Synchronisiert Rebuttals mit der Testline-Logik. */
export async function syncRebuttalsWithTestline(rebuttals, testlineResults) {
  const syncedResults = testlineResults.map(result => {
    const rebuttal = rebuttals.find(r => r.testId === result.testId && r.status === "ACCEPTED");
    if (rebuttal) {
      return { ...result, status: "PASS_WITH_REBUTTAL", rebuttalReason: rebuttal.reason };
    }
    return result;
  });
  return syncedResults;
}
