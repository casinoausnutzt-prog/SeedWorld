import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  TASK_SCHEMA_VERSION,
  archiveTasksRoot,
  docsV2Root,
  loadArchivedTasks,
  loadOpenTasks,
  readJson,
  taskDigest
} from "./docs-v2-shared.mjs";
import { compareAlpha } from "./runtime-shared.mjs";

const root = process.cwd();
const writeMode = process.argv.includes("--write");

function relLink(relPath) {
  return `../../${relPath}`;
}

function renderHome(openTasks, archivedTasks, sot) {
  return `# Documentation 2.0

Documentation 2.0 verbindet drei Dinge in einem System: menschenlesbare Wahrheit, maschinenlesbare Planung und ein Archiv der abgeschlossenen Slices. Fuehrend sind weiter Kernel-Wahrheit, Reproduktionsbeweis und autoritative Inhalte. Neu ist nur, dass Plan und Archiv jetzt als atomare JSON-Tasks mit dem Codepfad gekoppelt sind.

## Einstieg

- Wahrheit lesen: [TRUTH](./TRUTH.md)
- Offene Aufgaben lesen: [PLAN](./PLAN.md)
- Abgeschlossene Aufgaben lesen: [ARCHIVE](./ARCHIVE.md)
- Maschinenbasis: [app/src/sot/docs-v2.json](${relLink("app/src/sot/docs-v2.json")})

## Status

- Offene Tasks: ${openTasks.length}
- Archivierte Tasks: ${archivedTasks.length}
- Task-Schema: \`${TASK_SCHEMA_VERSION}\`
- SoT-Review: \`${sot.lastReviewed}\`
- Harte Guards: rohe Plan-Dateien blocken, unregistrierte neue Dateien blocken
`;
}

function renderTruth(sourceOfTruth, repoBoundaries, docsV2) {
  const lines = [
    "# Human Truth",
    "",
    "Diese Seite macht die fuehrende SoT menschenlesbar. Sie ersetzt die JSON-Dateien nicht, sondern erklaert sie knapp.",
    "",
    "## Fuehrende Quellen",
    "",
    `- [source-of-truth.json](${relLink("app/src/sot/source-of-truth.json")})`,
    `- [repo-boundaries.json](${relLink("app/src/sot/repo-boundaries.json")})`,
    `- [docs-v2.json](${relLink("app/src/sot/docs-v2.json")})`,
    "",
    "## Klassen",
    ""
  ];

  for (const [name, description] of Object.entries(sourceOfTruth.classes || {}).sort((a, b) => compareAlpha(a[0], b[0]))) {
    lines.push(`- \`${name}\`: ${description}`);
  }

  lines.push("");
  lines.push("## Repo-Grenzen");
  lines.push("");
  for (const owner of repoBoundaries.owners || []) {
    lines.push(`- \`${owner.name}\`: ${owner.purpose}`);
  }

  lines.push("");
  lines.push("## Doku-2.0-System");
  lines.push("");
  lines.push(`- Offene Tasks liegen unter \`${docsV2.roots.openTasks}\`.`);
  lines.push(`- Archivierte Tasks liegen unter \`${docsV2.roots.archiveTasks}\`.`);
  lines.push(`- Der Scanner schreibt Evidence nach \`${docsV2.scanner.evidence}\`.`);
  lines.push(`- Der Guard laeuft ueber \`${docsV2.guards.entry}\`.`);
  lines.push("- Nur atomare Einzel-Tasks duerfen in den offenen Planungspfad.");
  lines.push("");
  lines.push("## Systemplan");
  lines.push("");
  for (const area of docsV2.systemPlan?.areas || []) {
    lines.push(`- \`${area.id}\`: ${area.truth} Roots: ${area.roots.map((item) => `\`${item}\``).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderPlan(openTasks) {
  const lines = [
    "# Planning Path",
    "",
    "Offene Planung liegt nur noch als atomare Einzel-Tasks vor. Ein Task bleibt offen, bis sein deklarierter Scope im aktuellen Aenderungssatz vollstaendig getroffen wurde. Dann verschiebt der Scanner ihn ins Archiv.",
    "",
    "## Open Tasks",
    ""
  ];

  if (openTasks.length === 0) {
    lines.push("- Keine offenen Tasks.");
  } else {
    for (const task of openTasks) {
      lines.push(`### ${task.task_id} ${task.title}`);
      lines.push("");
      lines.push(`- JSON: \`${task.file_path}\``);
      lines.push(`- Track: \`${task.track}\``);
      lines.push(`- Match: \`${task.match_policy}\``);
      lines.push(`- Source: ${task.source_docs.map((item) => `\`${item}\``).join(", ")}`);
      lines.push(`- Scope: ${task.scope_paths.map((item) => `\`${item}\``).join(", ")}`);
      lines.push(`- Description: ${task.description}`);
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderArchive(archivedTasks) {
  const lines = [
    "# Archive",
    "",
    "Archivierte Tasks wurden vom Scanner aus dem offenen Planungspfad entfernt, weil ihr deklarierter Scope im Aenderungssatz getroffen wurde.",
    "",
    "## Archived Tasks",
    ""
  ];

  if (archivedTasks.length === 0) {
    lines.push("- Noch keine archivierten Tasks.");
  } else {
    const ordered = [...archivedTasks].sort((a, b) => compareAlpha(String(b.archived_at || ""), String(a.archived_at || "")));
    for (const task of ordered) {
      lines.push(`### ${task.task_id} ${task.title}`);
      lines.push("");
      lines.push(`- JSON: \`${task.file_path}\``);
      lines.push(`- Archived At: \`${task.archived_at}\``);
      lines.push(`- Reason: ${task.archive_reason}`);
      lines.push(`- Changed Files: ${(task.archive_changed_files || []).map((item) => `\`${item}\``).join(", ")}`);
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

async function syncOrVerify(absPath, expected) {
  let current = "";
  try {
    current = await readFile(absPath, "utf8");
  } catch {
    current = "";
  }
  if (writeMode) {
    await writeFile(absPath, expected, "utf8");
    return;
  }
  if (current !== expected) {
    throw new Error(`[DOCS_V2] drift detected: ${path.relative(root, absPath)}`);
  }
}

async function main() {
  await mkdir(docsV2Root(root), { recursive: true });
  await mkdir(archiveTasksRoot(root), { recursive: true });
  const [sourceOfTruth, repoBoundaries, docsV2, openTasks, archivedTasks] = await Promise.all([
    readJson(path.join(root, "app", "src", "sot", "source-of-truth.json")),
    readJson(path.join(root, "app", "src", "sot", "repo-boundaries.json")),
    readJson(path.join(root, "app", "src", "sot", "docs-v2.json")),
    loadOpenTasks(root),
    loadArchivedTasks(root)
  ]);

  const home = renderHome(openTasks, archivedTasks, docsV2);
  const truth = renderTruth(sourceOfTruth, repoBoundaries, docsV2);
  const plan = renderPlan(openTasks);
  const archive = renderArchive(archivedTasks);

  await syncOrVerify(path.join(docsV2Root(root), "HOME.md"), home);
  await syncOrVerify(path.join(docsV2Root(root), "TRUTH.md"), truth);
  await syncOrVerify(path.join(docsV2Root(root), "PLAN.md"), plan);
  await syncOrVerify(path.join(docsV2Root(root), "ARCHIVE.md"), archive);

  console.log(`[DOCS_V2] ${writeMode ? "WRITTEN" : "VERIFIED"} open=${openTasks.length} archived=${archivedTasks.length} digest=${taskDigest([...openTasks, ...archivedTasks])}`);
}

await main();
