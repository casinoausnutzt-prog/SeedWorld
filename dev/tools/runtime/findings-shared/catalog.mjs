import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { sha256, toPosixRel } from "./core.mjs";

async function loadTaskDir(root, absDir) {
  const entries = await readdir(absDir, { withFileTypes: true }).catch(() => []);
  const tasks = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const absPath = path.join(absDir, entry.name);
    const raw = await readFile(absPath, "utf8");
    let task;
    try {
      task = JSON.parse(raw);
    } catch {
      throw new Error(`[GOVERNANCE_FINDINGS] invalid task JSON: ${toPosixRel(root, absPath)}`);
    }
    tasks.push({
      absPath,
      relPath: toPosixRel(root, absPath),
      raw,
      sha256: sha256(raw),
      task
    });
  }
  tasks.sort((a, b) => a.relPath.localeCompare(b.relPath, "en"));
  return tasks;
}

export async function loadTaskCatalog(root) {
  const [openTasks, archivedTasks] = await Promise.all([
    loadTaskDir(root, path.join(root, "tem", "tasks", "open")),
    loadTaskDir(root, path.join(root, "tem", "tasks", "archive"))
  ]);
  const tasks = [...openTasks, ...archivedTasks].sort((a, b) => a.relPath.localeCompare(b.relPath, "en"));
  const byTaskIdRows = new Map();
  const byFingerprintRows = new Map();

  for (const row of tasks) {
    const taskId = String(row.task?.task_id || "").trim();
    const fingerprint = String(row.task?.finding_fingerprint || "").trim();
    if (taskId) {
      if (!byTaskIdRows.has(taskId)) {
        byTaskIdRows.set(taskId, []);
      }
      byTaskIdRows.get(taskId).push(row);
    }
    if (fingerprint) {
      if (!byFingerprintRows.has(fingerprint)) {
        byFingerprintRows.set(fingerprint, []);
      }
      byFingerprintRows.get(fingerprint).push(row);
    }
  }

  const byTaskId = new Map();
  const byFingerprint = new Map();
  const invariantIssues = [];

  function noteAmbiguity(kind, value, rows) {
    invariantIssues.push({
      kind,
      value,
      files: [...rows.map((row) => row.relPath)].sort((a, b) => a.localeCompare(b, "en"))
    });
  }

  for (const [taskId, rows] of byTaskIdRows.entries()) {
    if (rows.length === 1) {
      byTaskId.set(taskId, rows[0]);
      continue;
    }
    noteAmbiguity("task_id", taskId, rows);
  }

  for (const [fingerprint, rows] of byFingerprintRows.entries()) {
    if (rows.length === 1) {
      byFingerprint.set(fingerprint, rows[0]);
      continue;
    }
    noteAmbiguity("finding_fingerprint", fingerprint, rows);
  }

  return {
    tasks,
    byTaskId,
    byFingerprint,
    invariantIssues
  };
}
