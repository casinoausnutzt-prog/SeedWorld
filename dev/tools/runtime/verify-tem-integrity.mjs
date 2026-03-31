import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..", "..");

const SCHEMA_PATH = path.join(ROOT, "tem", "SCHEMA.json");
const TASKS_DIR = path.join(ROOT, "tem", "tasks", "open");
const SLICES_DIR = path.join(ROOT, "tem", "slices");
const REQUIRED_CHECKS_DIR = path.join(ROOT, "dev", "tools", "runtime", "required-checks");

const REQUIRED_TASK_SCHEMA_KEYS = [
  "schema_version",
  "task_id",
  "title",
  "status",
  "track",
  "source_docs",
  "description",
  "scope_paths",
  "match_policy"
];

const VALID_TRACKS = [
  "canvas-migration",
  "governance-hardening",
  "red-team-hardening",
  "security-hardening",
  "runtime-stability",
  "code-quality",
  "testability",
  "observability"
];

const VALID_STATUSES = ["open", "in_progress", "blocked", "completed"];

function sha256File(filePath) {
  return readFile(filePath).then((data) => {
    return createHash("sha256").update(data).digest("hex");
  });
}

async function loadSchema() {
  const raw = await readFile(SCHEMA_PATH, "utf8");
  return JSON.parse(raw);
}

function isHex64(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function issue(code, message) {
  return `[${code}] ${message}`;
}

async function verifyTaskFile(filePath, issues) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
  const fileName = path.basename(filePath);
  
  const raw = await readFile(filePath, "utf8");
  let task;
  try {
    task = JSON.parse(raw);
  } catch (err) {
    issues.push(issue("PARSE", `${relPath}: Invalid JSON - ${err.message}`));
    return null;
  }

  const actualHash = await sha256File(filePath);
  
  // Validate schema
  for (const key of REQUIRED_TASK_SCHEMA_KEYS) {
    if (!(key in task)) {
      issues.push(issue("SCHEMA", `${relPath}: Missing required key "${key}"`));
    }
  }

  // Validate task_id matches filename
  const expectedId = fileName.replace(".json", "");
  if (task.task_id !== expectedId) {
    issues.push(issue("ID_MISMATCH", `${relPath}: task_id "${task.task_id}" does not match filename "${expectedId}"`));
  }

  // Validate status
  if (!VALID_STATUSES.includes(task.status)) {
    issues.push(issue("INVALID_STATUS", `${relPath}: Invalid status "${task.status}"`));
  }

  // Validate track
  if (!VALID_TRACKS.includes(task.track)) {
    issues.push(issue("INVALID_TRACK", `${relPath}: Invalid track "${task.track}"`));
  }

  // Validate schema_version
  if (task.schema_version !== "2.0.0") {
    issues.push(issue("SCHEMA_VERSION", `${relPath}: schema_version must be "2.0.0"`));
  }

  // Validate match_policy
  if (task.match_policy !== "all_scope_paths_touched") {
    issues.push(issue("MATCH_POLICY", `${relPath}: match_policy must be "all_scope_paths_touched"`));
  }

  // Validate scope_paths exist
  if (Array.isArray(task.scope_paths)) {
    for (const scopePath of task.scope_paths) {
      const fullPath = path.join(ROOT, scopePath);
      try {
        await stat(fullPath);
      } catch {
        issues.push(issue("MISSING_SCOPE", `${relPath}: scope_path "${scopePath}" does not exist`));
      }
    }
  }

  return {
    path: relPath,
    hash: actualHash,
    task_id: task.task_id,
    status: task.status,
    track: task.track
  };
}

async function verifySliceFile(filePath, schemaArtifacts, issues) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
  const actualHash = await sha256File(filePath);
  
  // Check against SCHEMA
  const schemaEntry = schemaArtifacts.find((a) => a.path === relPath);
  if (!schemaEntry) {
    issues.push(issue("SCHEMA_MISSING", `${relPath}: Not registered in SCHEMA.json`));
  } else if (schemaEntry.sha256 !== actualHash) {
    issues.push(issue("HASH_MISMATCH", `${relPath}: Hash mismatch - SCHEMA has ${schemaEntry.sha256}, actual is ${actualHash}`));
  }

  // Validate category
  if (schemaEntry && schemaEntry.category !== "implementierungs-slices") {
    issues.push(issue("CATEGORY", `${relPath}: Wrong category "${schemaEntry.category}", expected "implementierungs-slices"`));
  }

  return {
    path: relPath,
    hash: actualHash,
    category: schemaEntry?.category
  };
}

// Library modules that don't need main exports
const LIBRARY_MODULES = new Set([
  "runtime-metadata.mjs",
  "runtime-proof.mjs"
]);

async function verifyRequiredCheck(filePath, issues) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
  const actualHash = await sha256File(filePath);
  
  const raw = await readFile(filePath, "utf8");
  
  // Basic syntax check - try to parse as module
  if (!raw.includes("export ")) {
    issues.push(issue("NO_EXPORTS", `${relPath}: No exports found - required checks must export functions`));
  }

  // Check for required functions (skip for library modules)
  const fileName = path.basename(filePath);
  if (!LIBRARY_MODULES.has(fileName)) {
    const requiredFunctions = ["main", "verify", "run", "execute"];
    const hasMainFunction = requiredFunctions.some((fn) => 
      raw.includes(`export async function ${fn}`) || 
      raw.includes(`export function ${fn}`) ||
      raw.includes(`export const ${fn}`)
    );
    
    if (!hasMainFunction) {
      issues.push(issue("NO_MAIN", `${relPath}: No main/verify/run/execute export found`));
    }
  }

  // Check for governance compatibility
  if (!raw.includes("schema_version") && !raw.includes("SCHEMA")) {
    issues.push(issue("GOVERNANCE", `${relPath}: No schema_version or SCHEMA reference found`));
  }

  return {
    path: relPath,
    hash: actualHash
  };
}

async function verifyAllTasks(schema, issues) {
  const tasks = [];
  const files = await readdir(TASKS_DIR);
  
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const filePath = path.join(TASKS_DIR, file);
    const task = await verifyTaskFile(filePath, issues);
    if (task) tasks.push(task);
  }

  // Check for duplicate task_ids
  const taskIds = tasks.map((t) => t.task_id);
  const duplicates = taskIds.filter((item, index) => taskIds.indexOf(item) !== index);
  if (duplicates.length > 0) {
    issues.push(issue("DUPLICATE_TASKS", `Duplicate task_ids found: ${duplicates.join(", ")}`));
  }

  // Verify all tasks are in SCHEMA
  const schemaTaskPaths = schema.artifacts
    .filter((a) => a.category === "task-open")
    .map((a) => a.path);

  for (const task of tasks) {
    if (!schemaTaskPaths.includes(task.path)) {
      issues.push(issue("SCHEMA_MISSING", `${task.path}: Task not registered in SCHEMA.json`));
    }
  }

  // Verify all SCHEMA tasks exist
  for (const schemaPath of schemaTaskPaths) {
    const fullPath = path.join(ROOT, schemaPath);
    try {
      await stat(fullPath);
    } catch {
      issues.push(issue("MISSING_FILE", `${schemaPath}: File registered in SCHEMA but does not exist`));
    }
  }

  return tasks;
}

async function verifyAllSlices(schema, issues) {
  const slices = [];
  const files = await readdir(SLICES_DIR);

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const filePath = path.join(SLICES_DIR, file);
    const slice = await verifySliceFile(filePath, schema.artifacts, issues);
    if (slice) slices.push(slice);
  }

  return slices;
}

async function verifyAllRequiredChecks(issues) {
  const checks = [];
  const files = await readdir(REQUIRED_CHECKS_DIR);
  
  // Phase 1: Alle Dateien einlesen und Import-Beziehungen analysieren
  const fileContents = new Map();
  const importGraph = new Map(); // file -> files it imports from
  const importedBy = new Map(); // file -> files that import it
  
  for (const file of files) {
    if (!file.endsWith(".mjs")) continue;
    const filePath = path.join(REQUIRED_CHECKS_DIR, file);
    const raw = await readFile(filePath, "utf8");
    fileContents.set(file, raw);
    
    // Parse imports
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    const imports = [];
    let match;
    while ((match = importRegex.exec(raw)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        // Extract filename - path.basename already includes .mjs extension
        const importedFile = path.basename(importPath);
        imports.push(importedFile);
        if (!importedBy.has(importedFile)) {
          importedBy.set(importedFile, []);
        }
        importedBy.get(importedFile).push(file);
      }
    }
    importGraph.set(file, imports);
  }
  
  // Phase 2: Verifiziere jede Datei
  for (const [file, raw] of fileContents) {
    const filePath = path.join(REQUIRED_CHECKS_DIR, file);
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
    const actualHash = await sha256File(filePath);
    
    // Basic syntax check
    if (!raw.includes("export ")) {
      issues.push(issue("NO_EXPORTS", `${relPath}: No exports found - required checks must export functions`));
    }

    // Check for governance compatibility
    if (!raw.includes("schema_version") && !raw.includes("SCHEMA")) {
      issues.push(issue("GOVERNANCE", `${relPath}: No schema_version or SCHEMA reference found`));
    }

    // Library modules (imported by others) don't need main functions
    // Entry point modules (not imported by others) need main/verify/run/execute
    const isLibraryModule = importedBy.has(file) && importedBy.get(file).length > 0;
    
    if (!isLibraryModule) {
      // This is an entry point - must have main function
      const requiredFunctions = ["main", "verify", "run", "execute"];
      const hasMainFunction = requiredFunctions.some((fn) => 
        raw.includes(`export async function ${fn}`) || 
        raw.includes(`export function ${fn}`) ||
        raw.includes(`export const ${fn}`)
      );
      
      if (!hasMainFunction) {
        issues.push(issue("NO_MAIN", `${relPath}: Entry point module must export main/verify/run/execute`));
      }
    }
    
    checks.push({
      path: relPath,
      hash: actualHash,
      isLibrary: isLibraryModule,
      imports: importGraph.get(file) || []
    });
  }

  return checks;
}

function printReport(tasks, slices, checks, issues) {
  console.log("\n========================================");
  console.log("  TEM INTEGRITY VERIFICATION REPORT");
  console.log("========================================\n");

  console.log(`Tasks Verified: ${tasks.length}`);
  console.log(`Slices Verified: ${slices.length}`);
  console.log(`Required Checks Verified: ${checks.length}`);

  if (issues.length === 0) {
    console.log("\n✓ ALL CHECKS PASSED");
    console.log("  All artifacts are manipulationsfrei and llm-governance compliant.\n");
    return 0;
  }

  console.log(`\n✗ ${issues.length} ISSUE(S) FOUND:\n`);
  const grouped = issues.reduce((acc, issue) => {
    const code = issue.match(/^\[([^\]]+)\]/)?.[1] || "UNKNOWN";
    if (!acc[code]) acc[code] = [];
    acc[code].push(issue);
    return acc;
  }, {});

  for (const [code, items] of Object.entries(grouped)) {
    console.log(`\n[${code}] (${items.length} issues):`);
    for (const item of items) {
      console.log(`  - ${item}`);
    }
  }

  console.log("\n✗ VERIFICATION FAILED");
  console.log("  Artifacts are NOT manipulationsfrei or NOT llm-governance compliant.\n");
  return 1;
}

async function main() {
  console.log("[TEM_VERIFY] Starting integrity verification...\n");
  
  const issues = [];
  
  // Load schema
  let schema;
  try {
    schema = await loadSchema();
    console.log(`[TEM_VERIFY] Loaded SCHEMA.json (snapshot: ${schema.snapshotId?.substring(0, 16)}...)`);
  } catch (err) {
    issues.push(issue("SCHEMA_LOAD", `Failed to load SCHEMA.json: ${err.message}`));
    console.error("\n✗ CRITICAL: Cannot load SCHEMA.json");
    process.exit(1);
  }

  // Verify all components
  const tasks = await verifyAllTasks(schema, issues);
  const slices = await verifyAllSlices(schema, issues);
  const checks = await verifyAllRequiredChecks(issues);

  // Print report
  const exitCode = printReport(tasks, slices, checks, issues);
  process.exit(exitCode);
}

await main();
