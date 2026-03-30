# Legacy Audit 2026-03-30

## Scope

- Code-first sync and audit on current repository state.
- Sources of truth:
  - `app/src/sot/REPO_HYGIENE_MAP.json`
  - `app/src/sot/FUNCTION_SOT.json`
  - `dev/patches/patch-matrix.json`

## Synchronization Status

- `npm run sync:docs` -> OK
- `npm run sot:verify` -> OK
- `npm run patch:matrix:validate` -> OK

## Matrix and Mapping Notes

- Patch matrix validator was adjusted to read from `dev/patches/*` and to validate the current contract-style matrix format.
- `sync:docs` and `sot:verify` are now clean against code as reference.

## Dead Function Candidates (Legacy/Unreachable)

Method:
- Read `unreachableCode` from `REPO_HYGIENE_MAP.json`.
- Count functions in those files from `FUNCTION_SOT.json`.

Current result:
- Unreachable code files: `62`
- Functions total in SoT: `687`
- Functions inside unreachable files: `405`

Top unreachable files by function count (candidates, not delete orders):
- `dev/tools/runtime/preflight-mutation-guard.mjs` -> 38
- `app/src/ui/DevUIController.js` -> 32
- `app/src/ui/plugins/ExampleUIPlugin.js` -> 26
- `app/src/plugins/radialBuildController.js` -> 24
- `app/src/ui/GameUIController.js` -> 23
- `app/src/ui/MainMenuController.js` -> 21
- `app/src/ui/BaseUIController.js` -> 15
- `dev/tools/runtime/release-guard.mjs` -> 14
- `dev/tools/runtime/evidence-lock.mjs` -> 11
- `dev/tools/patch/patchMatrix.js` -> 11
- `app/src/workers/worldRenderWorker.js` -> 11
- `dev/tools/runtime/repo-hygiene-map.mjs` -> 11

## Dead String Candidates (Legacy Path/String Usage)

Method:
- Search string occurrences containing `patches/`.
- Classify by active runtime usage vs. legacy-only context.

Findings:
- Active/runtime references:
  - `app/server/staticHandler.mjs` exposes `/patches/patch-schema.json` and `/patches/patch-matrix.json`.
  - `dev/tools/patch/lib/normalize.mjs` and `dev/tools/patch/lib/orchestrator.mjs` use `patches/` targets by policy.
  - `app/src/llm/llm-gate-policy.json` allows `patches/` writes.
- Legacy-only references:
  - `legacy/UNVERFID/ops-docker-legacy/docker/Dockerfile`
  - `legacy/UNVERFID/sot-legacy/llm-governance/patch-gate-policy.json`

Assessment:
- No immediate dead-string removal in active runtime paths.
- Legacy folder references are candidates for archival cleanup only.

## Actionable Next Pass

- For each unreachable file candidate, confirm whether it is:
  - runtime dead code,
  - tooling-only entrypoint (false positive),
  - or intentionally parked legacy.
- Run removal in small batches with `sync:docs` + `sot:verify` after each batch.
