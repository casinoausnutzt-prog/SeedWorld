import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const REQUIRED_READ_ORDER = Object.freeze([
  "docs/INDEX.md",
  "docs/LLM/ENTRY.md",
  "docs/LLM/POLICY.md",
  "docs/LLM/AKTUELLE_RED_ACTIONS.md"
]);

export function normalizeReadPath(input) {
  return String(input || "")
    .trim()
    .split(path.sep)
    .join("/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "");
}

export function findDuplicateValues(values) {
  const counts = new Map();
  for (const value of values || []) {
    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => a.localeCompare(b, "en"));
}

export function compareFileInventory({
  label,
  expectedEntries,
  actualEntries,
  emitIssue,
  expectedPathOf = (entry) => entry.path,
  actualPathOf = (entry) => entry.relPath,
  exactOrder = true
}) {
  const expectedPaths = (expectedEntries || []).map((entry) => normalizeReadPath(expectedPathOf(entry)));
  const actualPaths = (actualEntries || []).map((entry) => normalizeReadPath(actualPathOf(entry)));
  const expectedSet = new Set(expectedPaths);
  const actualSet = new Set(actualPaths);

  const duplicateExpected = findDuplicateValues(expectedPaths);
  if (duplicateExpected.length > 0) {
    emitIssue("DUPLICATE", `${label} expected paths duplicates=${duplicateExpected.join(",")}`);
  }

  const duplicateActual = findDuplicateValues(actualPaths);
  if (duplicateActual.length > 0) {
    emitIssue("DUPLICATE", `${label} actual paths duplicates=${duplicateActual.join(",")}`);
  }

  const missing = [...expectedSet].filter((pathEntry) => !actualSet.has(pathEntry)).sort((a, b) => a.localeCompare(b, "en"));
  const extra = [...actualSet].filter((pathEntry) => !expectedSet.has(pathEntry)).sort((a, b) => a.localeCompare(b, "en"));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) {
      parts.push(`missing=${missing.join(",")}`);
    }
    if (extra.length > 0) {
      parts.push(`extra=${extra.join(",")}`);
    }
    emitIssue("PARITY", `${label} file-set mismatch ${parts.join(" ")}`);
  }

  if (expectedPaths.length !== actualPaths.length) {
    emitIssue(
      "PARITY",
      `${label} file entry count mismatch expected=${expectedPaths.length} actual=${actualPaths.length}`
    );
  }

  if (exactOrder && expectedPaths.join("|") !== actualPaths.join("|")) {
    emitIssue("ORDER", `${label} file order mismatch`);
  }

  const max = Math.max(expectedEntries.length, actualEntries.length);
  for (let index = 0; index < max; index += 1) {
    const expectedEntry = expectedEntries[index] || null;
    const actualEntry = actualEntries[index] || null;
    const position = `${index + 1}`;
    if (!expectedEntry) {
      emitIssue("EXTRA", `${label} file entry ${position} missing from expected set`);
      continue;
    }
    if (!actualEntry) {
      emitIssue("MISSING", `${label} file entry ${position} missing from actual set`);
      continue;
    }

    const expectedPath = normalizeReadPath(expectedPathOf(expectedEntry));
    const actualPath = normalizeReadPath(actualPathOf(actualEntry));
    if (expectedPath !== actualPath) {
      emitIssue("PARITY", `${label} file entry ${position} path mismatch expected=${expectedPath} actual=${actualPath}`);
    }

    if ("sha256" in expectedEntry || "sha256" in actualEntry) {
      if (expectedEntry.sha256 !== actualEntry.sha256) {
        emitIssue("PARITY", `${label} file entry ${position} sha256 mismatch path=${actualPath}`);
      }
      if (typeof expectedEntry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedEntry.sha256)) {
        emitIssue("SCHEMA", `${label} file entry ${position} sha256 invalid path=${expectedPath}`);
      }
    }

    if ("bytes" in expectedEntry || "bytes" in actualEntry) {
      if (expectedEntry.bytes !== actualEntry.bytes) {
        emitIssue("PARITY", `${label} file entry ${position} bytes mismatch path=${actualPath}`);
      }
      if (!Number.isInteger(expectedEntry.bytes) || expectedEntry.bytes < 0) {
        emitIssue("SCHEMA", `${label} file entry ${position} bytes invalid path=${expectedPath}`);
      }
    }
  }
}

export async function collectFileState(rootDir = process.cwd(), relPaths = REQUIRED_READ_ORDER) {
  const files = [];
  for (const relPath of relPaths) {
    const normalized = normalizeReadPath(relPath);
    const absPath = path.join(rootDir, ...normalized.split("/"));
    const raw = await readFile(absPath, "utf8");
    const fileHash = createHash("sha256").update(raw).digest("hex");
    const info = await stat(absPath);
    files.push({
      relPath: normalized,
      absPath,
      sha256: fileHash,
      bytes: Buffer.byteLength(raw, "utf8"),
      mtime: info.mtime.toISOString()
    });
  }

  const combinedHash = createHash("sha256")
    .update(files.map((x) => `${x.relPath}:${x.sha256}`).join("|"))
    .digest("hex");

  return { files, combinedHash };
}

export function getWorkspacePaths(rootDir = process.cwd()) {
  return {
    rootDir,
    docsDir: path.join(rootDir, "docs", "LLM"),
    statePath: path.join(rootDir, "runtime", ".patch-manager", "llm-read-state.json"),
    overridePath: path.join(rootDir, "runtime", ".patch-manager", "llm-override.json")
  };
}

export async function collectReadState(rootDir = process.cwd()) {
  return collectFileState(rootDir, REQUIRED_READ_ORDER);
}

export async function writeAckState(rootDir = process.cwd(), actor = "manual") {
  const paths = getWorkspacePaths(rootDir);
  const state = await collectReadState(rootDir);
  const payload = {
    version: 1,
    actor,
    rootDir,
    docsDir: paths.docsDir,
    requiredReadOrder: REQUIRED_READ_ORDER,
    combinedHash: state.combinedHash,
    acknowledgedAt: new Date().toISOString(),
    files: state.files
  };

  await mkdir(path.dirname(paths.statePath), { recursive: true });
  await writeFile(paths.statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { payload, statePath: paths.statePath };
}
