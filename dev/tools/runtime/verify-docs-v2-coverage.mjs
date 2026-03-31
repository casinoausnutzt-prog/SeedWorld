import { isDeepStrictEqual } from "node:util";
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
import { compareAlpha, listFilesRecursive, toPosixPath } from "./runtime-shared.mjs";

const root = process.cwd();

function matchesBucket(relPath, bucket) {
  for (const entry of bucket.paths || []) {
    if (pathMatchesPrefix(relPath, entry)) {
      return true;
    }
  }
  return false;
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

async function computeCoverageEvidence(docsV2) {
  const scanRoots = docsV2.fullRepoCoverage?.scanRoots || [];
  const buckets = docsV2.fullRepoCoverage?.buckets || [];
  const allFiles = [];

  for (const relRoot of scanRoots) {
    const absRoot = path.join(root, relRoot);
    const absFiles = await listFilesRecursive(absRoot);
    for (const absFile of absFiles) {
      allFiles.push(toPosixPath(path.relative(root, absFile)));
    }
  }

  for (const relFile of docsV2.fullRepoCoverage?.rootFiles || []) {
    allFiles.push(toPosixPath(relFile));
  }

  const uniqueFiles = [...new Set(allFiles)].sort(compareAlpha);
  const classified = [];
  const unclassified = [];

  for (const relPath of uniqueFiles) {
    const bucket = buckets.find((entry) => matchesBucket(relPath, entry));
    if (!bucket) {
      unclassified.push(relPath);
      continue;
    }
    classified.push({
      path: relPath,
      bucket_id: bucket.id,
      bucket_class: bucket.class
    });
  }

  const expectedEvidence = {
    scanned_files: uniqueFiles.length,
    classified_files: classified.length,
    unclassified_files: unclassified,
    buckets: buckets.map((bucket) => ({
      id: bucket.id,
      class: bucket.class,
      count: classified.filter((item) => item.bucket_id === bucket.id).length
    }))
  };
  const evidencePath = path.join(root, docsV2.fullRepoCoverage.evidence);
  const issues = [];
  let evidence = null;
  let evidenceMatch = null;
  try {
    evidence = await readJson(evidencePath);
  } catch (error) {
    issues.push({
      code: "EVIDENCE_MISSING",
      message: `${docsV2.fullRepoCoverage.evidence}: ${String(error?.message || error)}`
    });
  }

  if (evidence) {
    const { generated_at: generatedAt, ...stableEvidence } = evidence;
    if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
      issues.push({
        code: "EVIDENCE_TIMESTAMP",
        message: `${docsV2.fullRepoCoverage.evidence} missing or invalid generated_at`
      });
    }
    evidenceMatch = isDeepStrictEqual(stableEvidence, expectedEvidence);
  }

  if (unclassified.length > 0) {
    issues.push({
      code: "UNCLASSIFIED_SCANNED_FILE",
      message: "files are outside Documentation 2.0 classification",
      files: unclassified
    });
  }

  return {
    scanned_files: uniqueFiles,
    classified_count: classified.length,
    unclassified_files: unclassified,
    expected_evidence: expectedEvidence,
    evidence_match: evidenceMatch,
    issues
  };
}

async function main() {
  const docsV2 = await readJson(path.join(root, "app", "src", "sot", "docs-v2.json"));
  const contract = await resolveDocsV2ChangeContract(root, { argv: process.argv.slice(2) });
  const changedFiles = await collectChangedFiles(root, contract);
  const governanceRoots = normalizeDocsV2Prefixes(docsV2.governanceRoots || []);
  const [openTasks, archivedTasks] = await Promise.all([loadOpenTasks(root), loadArchivedTasks(root)]);
  const registered = new Set();

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
  const coverage = await computeCoverageEvidence(docsV2);
  const issues = [...coverage.issues];

  if (planViolations.length > 0) {
    issues.push({
      code: "PLAN_VIOLATION",
      message: "plan file still exists outside atomic task path",
      files: planViolations
    });
  }
  if (unregistered.length > 0) {
    issues.push({
      code: "UNREGISTERED_CHANGED_FILE",
      message: "changed file is not registered in Documentation 2.0",
      files: unregistered
    });
  }

  if (issues.length > 0) {
    emitResult({
      tool: "DOCS_V2_COVERAGE",
      status: "BLOCK",
      mode: contract.mode,
      ranges: contract.ranges,
      changed_files: changedFiles,
      governance_roots: governanceRoots,
      scanned_files: coverage.scanned_files,
      classified_count: coverage.classified_count,
      unclassified_files: coverage.unclassified_files,
      evidence_match: coverage.evidence_match,
      issues
    });
    process.exit(1);
  }

  emitResult({
    tool: "DOCS_V2_COVERAGE",
    status: "OK",
    mode: contract.mode,
    ranges: contract.ranges,
    changed_files: changedFiles,
    governance_roots: governanceRoots,
    scanned_files: coverage.scanned_files,
    classified_count: coverage.classified_count,
    evidence_match: coverage.evidence_match
  });
}

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

await main();
