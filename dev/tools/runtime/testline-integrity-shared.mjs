import path from "node:path";
import { readFile } from "node:fs/promises";
import { compareAlpha, listFilesRecursive, sha256Hex, toPosixPath } from "./runtime-shared.mjs";

export const TESTLINE_BASELINE_PATH = Object.freeze(["app", "src", "sot", "testline-integrity.json"]);
export const TESTLINE_MONITORED_ROOTS = Object.freeze([
  "dev/scripts",
  "dev/tests",
  "dev/tools/runtime"
]);
export const TESTLINE_MONITORED_EXTS = new Set([".js", ".mjs"]);

export async function collectTestlineFiles(root) {
  const relFiles = [];

  for (const relRoot of TESTLINE_MONITORED_ROOTS) {
    const absRoot = path.join(root, relRoot);
    const listed = await listFilesRecursive(absRoot, {
      filterFile: (_abs, entry) => TESTLINE_MONITORED_EXTS.has(path.extname(entry.name).toLowerCase())
    });

    for (const absPath of listed) {
      relFiles.push(toPosixPath(path.relative(root, absPath)));
    }
  }

  return [...new Set(relFiles)].sort(compareAlpha);
}

export async function buildTestlineHashes(root, relFiles) {
  const fileHashes = {};

  for (const relPath of relFiles) {
    const absPath = path.join(root, ...relPath.split("/"));
    const raw = await readFile(absPath, "utf8");
    fileHashes[relPath] = sha256Hex(raw);
  }

  return fileHashes;
}
