# Cleanup and Removal Playbook

Tags: `cleanup` `hygiene` `deletion` `dependency-analysis`

Use this before deleting files or features.

## Step 1: Build hygiene map

```bash
node dev/tools/runtime/repo-hygiene-map.mjs --write
```

Review:

- [../../SOT/REPO_HYGIENE_MAP.md](../../SOT/REPO_HYGIENE_MAP.md)
- [../../../src/sot/REPO_HYGIENE_MAP.json](../../../src/sot/REPO_HYGIENE_MAP.json)

## Step 2: Inspect one candidate

```bash
node dev/tools/runtime/repo-hygiene-why.mjs <relative-path>
```

Example:

```bash
node dev/tools/runtime/repo-hygiene-why.mjs app/src/ui/UIController.js
```

## Step 3: Remove only when all are true

- `isEntrypoint = false`
- `inboundCount = 0`
- no required runtime contract depends on it
- tests still pass after removal

## Step 4: Validate

```bash
npm test
npm run evidence:verify
npm run testline:verify
```

## Important

Unreachable/zero-inbound is a strong signal, not an automatic delete order.  
Maschinennahe SoT und Pflichttests gehen vor historischem Doku-Komfort.

## Related Pages

- [Home](Home)
- [Developer Onboarding](Developer-Onboarding)
- [Architecture](Architecture)
