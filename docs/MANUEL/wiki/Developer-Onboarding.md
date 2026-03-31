# Developer Onboarding

Tags: `onboarding` `developer-experience` `checks` `testing`

## Setup

```bash
npm install
npm test
npm run evidence:verify
npm run testline:verify
npm run check:required
```

## Required quality line

```bash
npm run check:required
```

## Daily commands

- `npm run check:required`
- `node dev/tools/runtime/repo-hygiene-map.mjs --write`
- `node dev/tools/runtime/updateFunctionSot.mjs --write`

## Add a new kernel action

1. Generate a starter:

```bash
node tools/runtime/new-action-template.mjs <domain> <actionType> <requiredGate>
```

2. Register in `ActionRegistry` inside `KernelController`.
3. Add/adjust Doppel-Lauf-Tests.
4. Re-run `check:required`.

## Related Pages

- [Home](Home)
- [Cleanup and Removal Playbook](Cleanup-and-Removal-Playbook)
