import path from "node:path";
import {
  collectChangedFiles,
  loadArchivedTasks,
  loadOpenTasks,
  normalizeDocsV2Prefixes,
  pathMatchesPrefix,
  readJson,
  resolveDocsV2ChangeContract
} from "./docs-v2-shared.mjs";
import { compareAlpha } from "./runtime-shared.mjs";

const root = process.cwd();

function isJsonTask(relPath) {
  return relPath.startsWith("tem/tasks/open/") || relPath.startsWith("tem/tasks/archive/");
}

function isPlanCandidate(relPath, docsV2) {
  if (!relPath.endsWith(".md") && !relPath.endsWith(".json")) {
    return false;
  }
  if (isJsonTask(relPath)) {
    return false;
  }
  if ((docsV2.humanPlanViews || []).includes(relPath)) {
    return false;
  }
  if ((docsV2.registeredControlFiles || []).includes(relPath)) {
    return false;
  }
  return relPath.startsWith("tem/") || relPath.startsWith("docs/IN PLANUNG/");
}

function addRegistered(set, relPath) {
  if (typeof relPath === "string" && relPath.trim()) {
    set.add(relPath);
  }
}

function addBucketPaths(set, bucket) {
  for (const relPath of bucket?.paths || []) {
    addRegistered(set, relPath);
  }
}

function isRegisteredPath(relPath, registered) {
  if (registered.has(relPath)) {
    return true;
  }
  for (const candidate of registered) {
    if (candidate.endsWith("/") && pathMatchesPrefix(relPath, candidate)) {
      return true;
    }
  }
  return false;
}

function emitResult(result) {
  const line = JSON.stringify(result);
  if (result.status === "BLOCK") {
    console.error(line);
    return;
  }
  console.log(line);
}

async function main() {
  const docsV2 = await readJson(path.join(root, "app", "src", "sot", "docs-v2.json"));
  const contract = await resolveDocsV2ChangeContract(root, { argv: process.argv.slice(2) });
  const [openTasks, archivedTasks] = await Promise.all([loadOpenTasks(root), loadArchivedTasks(root)]);
  const changedFiles = await collectChangedFiles(root, contract);
  const registered = new Set();
  const governanceRoots = normalizeDocsV2Prefixes(docsV2.governanceRoots || []);

  for (const relPath of docsV2.registeredControlFiles || []) {
    addRegistered(registered, relPath);
  }
  for (const relPath of docsV2.generatedDocs || []) {
    addRegistered(registered, relPath);
  }
  for (const relPath of governanceRoots) {
    addRegistered(registered, relPath);
  }
  for (const bucket of docsV2.fullRepoCoverage?.buckets || []) {
    addBucketPaths(registered, bucket);
  }
  for (const task of [...openTasks, ...archivedTasks]) {
    addRegistered(registered, task.file_path);
    addRegistered(registered, task.archived_from);
    for (const relPath of task.scope_paths || []) {
      addRegistered(registered, relPath);
    }
    for (const relPath of task.source_docs || []) {
      addRegistered(registered, relPath);
    }
  }

  const planViolations = changedFiles.filter((relPath) => isPlanCandidate(relPath, docsV2)).sort(compareAlpha);
  const unregistered = changedFiles.filter((relPath) => !isRegisteredPath(relPath, registered)).sort(compareAlpha);

  if (planViolations.length > 0 || unregistered.length > 0) {
    emitResult({
      tool: "DOCS_V2_GUARDS",
      status: "BLOCK",
      mode: contract.mode,
      ranges: contract.ranges,
      changed_files: changedFiles,
      governance_roots: governanceRoots,
      registered_count: registered.size,
      plan_violations: planViolations,
      unregistered_files: unregistered
    });
    process.exit(1);
  }

  emitResult({
    tool: "DOCS_V2_GUARDS",
    status: "OK",
    mode: contract.mode,
    ranges: contract.ranges,
    changed_files: changedFiles,
    governance_roots: governanceRoots,
    registered_count: registered.size
  });
}

await main();
