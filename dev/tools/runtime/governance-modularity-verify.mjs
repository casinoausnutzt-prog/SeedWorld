import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { listFilesRecursive, toPosixPath } from "./runtime-shared.mjs";
import { readJson } from "./docs-v2-shared.mjs";

const root = process.cwd();
const isDirectRun = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

const scanRoots = Object.freeze(["app/src/kernel", "app/src/game", "dev/tools/runtime"]);
const evidenceRel = "runtime/evidence/governance-modularity.json";

function resolveFileSizeRule(relPath, rules) {
  const defaultLines = Number(rules.maxLines || 260);
  const defaultBytes = Number(rules.maxBytes || 20000);
  const allowEntry = (rules.fileSizeAllowlist || []).find((item) => item.path === relPath);
  if (!allowEntry) {
    return { maxLines: defaultLines, maxBytes: defaultBytes, allowlisted: false, sunsetDate: null };
  }
  return {
    maxLines: Number(allowEntry.maxLines || defaultLines),
    maxBytes: Number(allowEntry.maxBytes || defaultBytes),
    allowlisted: true,
    sunsetDate: allowEntry.sunsetDate || null
  };
}

function isStateWriteViolation(relPath, code, rules) {
  if ((rules.stateWriteAllowlist || []).includes(relPath)) {
    return false;
  }
  if (relPath.endsWith("gameStateReducer.js")) {
    return false;
  }
  const assignmentPattern = /\bstate(?:\.[A-Za-z0-9_$\[\]'"`]+)+\s*(?:=|\+=|-=|\*=|\/=|\+\+|--)/m;
  const mutablePattern = /\bstate(?:\.[A-Za-z0-9_$\[\]'"`]+)+\.(push|splice|set|delete)\s*\(/m;
  return assignmentPattern.test(code) || mutablePattern.test(code);
}

function normalizeRel(candidate) {
  return toPosixPath(path.normalize(candidate).replace(/^[A-Za-z]:/, ""));
}

function resolveImportedPath(relPath, specifier) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const baseDir = path.posix.dirname(relPath);
    return normalizeRel(path.posix.join(baseDir, specifier));
  }
  if (specifier.startsWith("/")) {
    return toPosixPath(specifier.replace(/^\/+/, ""));
  }
  return specifier;
}

function extractImportSpecifiers(code) {
  const specs = [];
  const staticPattern = /\bfrom\s+["']([^"']+)["']/g;
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = staticPattern.exec(code))) {
    specs.push(match[1]);
  }
  while ((match = dynamicPattern.exec(code))) {
    specs.push(match[1]);
  }
  return specs;
}

function hasForbiddenBoundaryImport(relPath, code, rules) {
  if (!relPath.startsWith("app/src/kernel/") && !relPath.startsWith("app/src/game/")) {
    return false;
  }
  const forbidden = rules.forbiddenAuthoritativeImports || [];
  const specs = extractImportSpecifiers(code);
  for (const spec of specs) {
    const resolved = resolveImportedPath(relPath, spec);
    for (const prefix of forbidden) {
      const normalizedPrefix = toPosixPath(prefix);
      if (resolved === normalizedPrefix || resolved.startsWith(`${normalizedPrefix}`) || resolved.startsWith(normalizedPrefix)) {
        return true;
      }
    }
  }
  return false;
}

function isExpiredSunset(sunsetDate) {
  if (!sunsetDate) return false;
  const parsed = new Date(`${sunsetDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() < Date.now();
}

export async function buildGovernanceModularityEvidence(root, { readExisting = true } = {}) {
  const boundaries = await readJson(path.join(root, "app", "src", "sot", "repo-boundaries.json"));
  const rules = boundaries?.hygienePolicy?.modularityRules || {};
  const files = [];

  for (const relRoot of scanRoots) {
    const absRoot = path.join(root, relRoot);
    const absFiles = await listFilesRecursive(absRoot).catch((error) => {
      throw new Error(`[GOVERNANCE_MODULARITY] cannot read scan root '${relRoot}': ${String(error?.message || error)}`);
    });
    for (const absFile of absFiles) {
      const relPath = toPosixPath(path.relative(root, absFile));
      if (!/\.(?:js|mjs)$/.test(relPath)) continue;
      files.push(relPath);
    }
  }
  files.sort((a, b) => a.localeCompare(b, "en"));

  const issues = [];
  const evidenceItems = [];
  for (const relPath of files) {
    const abs = path.join(root, relPath);
    const raw = await readFile(abs, "utf8");
    const bytes = Buffer.byteLength(raw, "utf8");
    const lines = raw.split(/\r?\n/).length;
    const limits = resolveFileSizeRule(relPath, rules);
    evidenceItems.push({
      path: relPath,
      lines,
      bytes,
      limit_lines: limits.maxLines,
      limit_bytes: limits.maxBytes,
      allowlisted: limits.allowlisted,
      sunset_date: limits.sunsetDate
    });
    if (limits.allowlisted && isExpiredSunset(limits.sunsetDate)) {
      issues.push(`[ALLOWLIST_EXPIRED] ${relPath} sunsetDate=${limits.sunsetDate || "<invalid>"}`);
    }
    if (lines > limits.maxLines || bytes > limits.maxBytes) {
      issues.push(`[FILE_SIZE] ${relPath} lines=${lines}/${limits.maxLines} bytes=${bytes}/${limits.maxBytes}`);
    }
    if (isStateWriteViolation(relPath, raw, rules)) {
      issues.push(`[STATE_WRITE] ${relPath} contains direct state mutation outside reducer allowlist`);
    }
    if (hasForbiddenBoundaryImport(relPath, raw, rules)) {
      issues.push(`[BOUNDARY_IMPORT] ${relPath} imports forbidden UI/deprecated runtime boundary`);
    }
  }

  const expectedEvidence = {
    schema_version: 1,
    scanned_count: files.length,
    scanned_files: evidenceItems,
    issues
  };
  let evidence = null;
  if (readExisting) {
    const evidencePath = path.join(root, evidenceRel);
    try {
      evidence = await readJson(evidencePath);
    } catch (error) {
      issues.push(`[EVIDENCE_MISSING] ${evidenceRel}: ${String(error?.message || error)}`);
    }
    if (evidence) {
      const { generated_at: generatedAt, ...stableEvidence } = evidence;
      if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
        issues.push(`[EVIDENCE_TIMESTAMP] ${evidenceRel} missing or invalid generated_at`);
      }
      if (!isDeepStrictEqual(stableEvidence, expectedEvidence)) {
        issues.push(`[EVIDENCE_DRIFT] ${evidenceRel} does not match computed modularity coverage`);
      }
    }
  }

  return { evidencePath: path.join(root, evidenceRel), files, evidenceItems, issues, expectedEvidence, evidence };
}

async function main() {
  const { issues, files } = await buildGovernanceModularityEvidence(root);

  if (issues.length > 0) {
    console.error("[GOVERNANCE_MODULARITY] BLOCK");
    for (const issue of issues) {
      console.error(` - ${issue}`);
    }
    process.exit(1);
  }

  console.log(`[GOVERNANCE_MODULARITY] OK files=${files.length}`);
}

if (isDirectRun) {
  await main();
}
