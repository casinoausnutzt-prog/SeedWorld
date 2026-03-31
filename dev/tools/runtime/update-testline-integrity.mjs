import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildTestlineHashes,
  collectTestlineFiles,
  TESTLINE_BASELINE_PATH,
  TESTLINE_MONITORED_ROOTS
} from "./testline-integrity-shared.mjs";

const root = process.cwd();
const baselinePath = path.join(root, ...TESTLINE_BASELINE_PATH);

async function main() {
  const previous = JSON.parse(await readFile(baselinePath, "utf8"));
  const relFiles = await collectTestlineFiles(root);
  const hashes = await buildTestlineHashes(root, relFiles);
  const payload = {
    ...previous,
    generatedAt: new Date().toISOString(),
    monitoredRoots: [...TESTLINE_MONITORED_ROOTS],
    monitoredFiles: relFiles,
    fileHashes: hashes
  };
  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[TESTLINE_INTEGRITY] baseline updated: ${baselinePath}`);
  console.log(`[TESTLINE_INTEGRITY] files: ${relFiles.length}`);
}

await main();
