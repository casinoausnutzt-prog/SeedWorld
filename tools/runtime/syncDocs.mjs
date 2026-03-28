import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const orientationTarget = path.join(root, "docs", "ORIENTATION.md");
const indexTarget = path.join(root, "docs", "INDEX.md");
const today = new Date().toISOString().slice(0, 10);

const orientationContent = `# SeedWorld Orientation (Synced: ${today})

## 1) System Map

- \`src/ui/\`: Rendering und Input, keine direkten Domain-State Writes.
- \`src/game/\`: Gameplay-Regeln und erlaubte Patch-Berechnung.
- \`src/kernel/\`: Deterministische Domain-Grenzen und Mutationskontrolle.
- \`tools/patch/\`: Intake, Locking, Normalisierung, Orchestrierung.
- \`tests/\`: Einstieg \`tests/MainTest.mjs\`, Module unter \`tests/modules/\`.

## 2) Lokale Reihenfolge

\`\`\`bash
npm install
npm run sync:docs
npm run preflight
npm test
npm start
\`\`\`

## 3) Verifizierte Testlinie

- \`node scripts/smoke-test.mjs\`
- \`node scripts/runtime-guards-test.mjs\`
- \`node scripts/patch-flow-test.mjs\`
- \`node scripts/test-runner.mjs\`

## 4) Hinweise

- Patch-Server startet nur bei Direct-Run und blockiert keine Test-Imports.
- Terrain/DOM/SVG-Rendering ist getrennt: Canvas unten, DOM Mitte, SVG oben.
`;

const indexContent = `# SeedWorld Docs Index (Synced: ${today})

## Canonical Entry

- Root Start: \`README.md\`
- Runtime Entry: \`start-server.js\` + \`server/patchServer.mjs\`
- Test Entry: \`tests/MainTest.mjs\`

## Core Docs

- [ORIENTATION.md](./ORIENTATION.md)
- [WORKFLOW.md](./WORKFLOW.md)
- [DETERMINISM_INVENTORY.md](./DETERMINISM_INVENTORY.md)
- [REPO_HYGIENE_MAP.md](./REPO_HYGIENE_MAP.md)
- [deployment/DEPLOYMENT.md](./deployment/DEPLOYMENT.md)
- [wiki/Home.md](./wiki/Home.md)

## Governance & Release

- [llm-gate-policy.json](./llm-gate-policy.json)
- [release-manifest.json](./release-manifest.json)

## Isolation Zone

- [../UNVERFID/CANDIDATES.md](../UNVERFID/CANDIDATES.md)
`;

let currentOrientation = "";
try {
  currentOrientation = await readFile(orientationTarget, "utf8");
} catch {
  currentOrientation = "";
}

if (currentOrientation !== orientationContent) {
  await writeFile(orientationTarget, orientationContent, "utf8");
}

let currentIndex = "";
try {
  currentIndex = await readFile(indexTarget, "utf8");
} catch {
  currentIndex = "";
}

if (currentIndex !== indexContent) {
  await writeFile(indexTarget, indexContent, "utf8");
}

console.log("[SYNC_DOCS] OK");
