import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { compareAlpha, listFilesRecursive, sha256Hex, toPosixPath } from "./runtime-shared.mjs";

export const TASK_SCHEMA_VERSION = "2.0.0";
export const docsV2Root = (root) => path.join(root, "docs", "V2");
export const openTasksRoot = (root) => path.join(root, "tem", "tasks", "open");
export const archiveTasksRoot = (root) => path.join(root, "tem", "tasks", "archive");
export const docsV2EvidencePath = (root) => path.join(root, "runtime", "evidence", "docs-v2-scan.json");

export function normalizeDocsV2Prefixes(values = []) {
  const seen = new Set(), out = [];
  for (const value of values) {
    const raw = toPosixPath(String(value || "").trim());
    if (!raw) continue;
    const normalized = raw.endsWith("/") ? raw : `${raw}/`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.sort(compareAlpha);
}

export function pathMatchesPrefix(relPath, prefix) {
  const normalizedPath = toPosixPath(String(relPath || "").trim());
  const normalizedPrefix = toPosixPath(String(prefix || "").trim()).replace(/\/?$/, "/");
  return !!normalizedPath && !!normalizedPrefix && (normalizedPath === normalizedPrefix.slice(0, -1) || normalizedPath.startsWith(normalizedPrefix));
}

export function parseDocsV2RangeArgs(argv = []) {
  const ranges = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === "--range") {
    const range = String(argv[++i] || "").trim();
    if (range) ranges.push(range);
  }
  return { ranges: [...new Set(ranges)] };
}

function readGitValue(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function resolveCiRange(env) {
  const eventName = String(env.GITHUB_EVENT_NAME || "").trim();
  if (!eventName) {
    if (String(env.CI || "").toLowerCase() === "true" || !!env.GITHUB_ACTIONS) throw new Error("[DOCS_V2_RANGE] missing GITHUB_EVENT_NAME in CI");
    return null;
  }
  const eventPath = String(env.GITHUB_EVENT_PATH || "").trim();
  if (!eventPath) throw new Error(`[DOCS_V2_RANGE] missing GITHUB_EVENT_PATH for ${eventName}`);
  const payload = JSON.parse(readFileSync(eventPath, "utf8"));
  if (eventName === "push") {
    const before = String(payload?.before || "").trim();
    const after = String(payload?.after || "").trim();
    if (!before || !after || /^0+$/.test(before) || /^0+$/.test(after)) throw new Error("[DOCS_V2_RANGE] invalid push range contract");
    return { mode: "ci-push", ranges: [`${before}..${after}`] };
  }
  if (eventName === "pull_request" || eventName === "pull_request_target") {
    const baseSha = String(payload?.pull_request?.base?.sha || "").trim();
    const headSha = String(payload?.pull_request?.head?.sha || "").trim();
    if (!baseSha || !headSha || /^0+$/.test(baseSha) || /^0+$/.test(headSha)) throw new Error(`[DOCS_V2_RANGE] invalid ${eventName} range contract`);
    return { mode: `ci-${eventName}`, ranges: [`${baseSha}..${headSha}`] };
  }
  throw new Error(`[DOCS_V2_RANGE] unsupported CI event '${eventName}'`);
}

export async function resolveDocsV2ChangeContract(root, { argv = [], env = process.env } = {}) {
  const explicit = parseDocsV2RangeArgs(argv).ranges;
  if (explicit.length > 0) return { mode: "explicit-range", ranges: explicit };
  const ciRange = resolveCiRange(env);
  if (ciRange) return ciRange;
  const upstream = readGitValue(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  return upstream ? { mode: "local-upstream", ranges: [`${upstream}..HEAD`] } : { mode: "working-tree", ranges: [] };
}

export const readJson = async (absPath) => JSON.parse(await readFile(absPath, "utf8"));
export const writeJson = async (absPath, value) => { await writeFile(absPath, `${JSON.stringify(value, null, 2)}\n`, "utf8"); };

export function validateTask(task, relPath = "task") {
  if (!task || typeof task !== "object") throw new Error(`[DOCS_V2] invalid task object in ${relPath}`);
  const checks = [
    [task.schema_version === TASK_SCHEMA_VERSION, `[DOCS_V2] unsupported schema_version in ${relPath}: ${task.schema_version}`],
    [/^[A-Z0-9-]+$/.test(String(task.task_id || "")), `[DOCS_V2] invalid task_id in ${relPath}`],
    [["open", "archived"].includes(String(task.status || "")), `[DOCS_V2] invalid status in ${relPath}: ${task.status}`],
    [Array.isArray(task.scope_paths) && task.scope_paths.length > 0, `[DOCS_V2] missing scope_paths in ${relPath}`],
    [["all_scope_paths_touched", "any_scope_path_touched"].includes(String(task.match_policy || "")), `[DOCS_V2] invalid match_policy in ${relPath}: ${task.match_policy}`],
    [Array.isArray(task.source_docs) && task.source_docs.length > 0, `[DOCS_V2] missing source_docs in ${relPath}`]
  ];
  for (const [ok, message] of checks) if (!ok) throw new Error(message);
}

async function loadTaskDir(root, absDir, expectedStatus) {
  const tasks = [];
  for (const entry of await readdir(absDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const absPath = path.join(absDir, entry.name);
    const relPath = toPosixPath(path.relative(root, absPath));
    const task = await readJson(absPath);
    validateTask(task, relPath);
    if (task.status !== expectedStatus) throw new Error(`[DOCS_V2] status mismatch in ${relPath}: expected ${expectedStatus} got ${task.status}`);
    tasks.push({ ...task, file_path: relPath });
  }
  tasks.sort((a, b) => compareAlpha(a.task_id, b.task_id));
  return tasks;
}

export const loadOpenTasks = (root) => loadTaskDir(root, openTasksRoot(root), "open");
export const loadArchivedTasks = (root) => loadTaskDir(root, archiveTasksRoot(root), "archived");

function parsePorcelainPath(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  return trimmed.includes(" -> ") ? trimmed.split(" -> ").pop() || null : trimmed;
}

export async function collectChangedFiles(root, contract = null) {
  const changed = new Set(), ranges = Array.isArray(contract?.ranges) ? contract.ranges.filter(Boolean) : [], add = (relCandidate) => {
    if (relCandidate && !relCandidate.startsWith("runtime/")) changed.add(relCandidate);
  };
  if (ranges.length > 0) {
    for (const range of ranges) {
      const output = await runGit(root, ["diff", "--name-only", "--diff-filter=ACMRD", range]);
      for (const line of output.split(/\r?\n/)) add(toPosixPath(String(line || "").trim()));
    }
    return [...changed].sort(compareAlpha);
  }
  const output = await runGit(root, ["status", "--porcelain"]);
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const candidate = parsePorcelainPath(line.slice(3));
    if (!candidate) continue;
    const relCandidate = toPosixPath(candidate);
    if (relCandidate.endsWith("/")) {
      try {
        for (const absFile of await listFilesRecursive(path.join(root, relCandidate))) {
          const nestedRel = toPosixPath(path.relative(root, absFile));
          if (!nestedRel.startsWith("runtime/")) changed.add(nestedRel);
        }
        continue;
      } catch {
        changed.add(relCandidate);
        continue;
      }
    }
    if (!relCandidate.startsWith("runtime/")) changed.add(relCandidate);
  }
  return [...changed].sort(compareAlpha);
}

async function runGit(root, args) {
  return await new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `git ${args.join(" ")} failed with code ${code}`)));
  });
}

export function taskMatchesChangeSet(task, changedFiles) {
  const touched = task.scope_paths.filter((relPath) => changedFiles.includes(relPath));
  return { matched: task.match_policy === "all_scope_paths_touched" ? touched.length === task.scope_paths.length : touched.length > 0, touched_paths: touched.sort(compareAlpha) };
}

export async function archiveTask(root, task, archiveMeta) {
  const fromPath = path.join(root, task.file_path), archiveName = `${task.task_id}.json`, toPath = path.join(archiveTasksRoot(root), archiveName);
  const archivedTask = { ...task, status: "archived", file_path: toPosixPath(path.relative(root, toPath)), archived_at: archiveMeta.archived_at, archive_reason: archiveMeta.archive_reason, archive_changed_files: archiveMeta.archive_changed_files, archived_from: task.file_path };
  validateTask(archivedTask, task.file_path);
  await writeJson(fromPath, archivedTask);
  await rename(fromPath, toPath);
  return { ...archivedTask, file_path: toPosixPath(path.relative(root, toPath)) };
}

export const renderTaskBullet = (task) => `- \`${task.task_id}\` ${task.title}`;
export const taskDigest = (tasks) => sha256Hex(tasks.map((task) => `${task.task_id}:${task.status}:${task.file_path}`).join("|"));
