# Testing Policy

## Pflichtregel
`tests/MainTest.mjs` ist der einzige Einstiegspunkt fuer "run all tests".

## Ausfuehrung
- `npm test` -> fuehrt immer `MainTest` aus.
- `MainTest` laedt zuerst zwingend `tests/modules/00.mandatory.module.mjs`.
- Danach werden alle weiteren `*.module.mjs` Module ausgefuehrt.

## Neue Tests
Neue Tests werden ausschliesslich als Modul unter `tests/modules/` angelegt.
Sie duerfen nicht als eigener Top-Level-Runner ausgefuehrt werden.

Namenskonvention:
- Pflichttest: `00.mandatory.module.mjs`
- Weitere Tests: `NN.<name>.module.mjs`

## Kernel-Policy Test
`02.kernel-interface.module.mjs` prueft, dass App-Code nur ueber `src/kernel/interface.js` in den Kernel darf.

## Patch-Gate Test
`03.patch-dispatcher-gate.module.mjs` prueft:
- Block bei falschem/ungepatchtem Format
- Konflikt- und Direktverknuepfungs-Erkennung
- Pflicht-Bestaetigung vor Apply bei Risiko

## Seed-Guard Test
`06.seed-guard.module.mjs` prueft:
- Run blockiert ohne `seedHash`
- Run blockiert mit falschem `seedHash`
- Direkter Kernel-Bypass ohne `expectedSeedHash` blockiert

## Function-SoT Test
`07.function-sot-sync.module.mjs` prueft:
- Preflight blockiert bei unsynchroner `docs/FUNCTION_SOT.json`
- `npm run sync:docs` stellt Function-SoT wieder her

## Korner-Modul Test
`08.korner-module.module.mjs` prueft:
- Manifest + Snapshot im Korner-Modul
- String-Matrix ueber Interface und Doku ist synchron

## Store/Governance Test
`09.store-and-governance-gates.module.mjs` prueft:
- createStore erzwingt guardDeterminism=true
- dispatch validiert Action-Schema, Domain-Gate, mutationMatrix und Sanitization
- Root-Container-Replacement ist blockiert
- LLM-Governance-Pflichtkette ist erzwungen

## Deadman Trigger
`tests/MainTest.mjs` fuehrt vor und nach jedem Modul einen Deadman-Integritaetscheck ueber Gate-Dateien aus.
`11.deadman-trigger.module.mjs` prueft, dass Gate-Manipulationen sofort mit `[DEADMAN_TRIGGER]` fail-closed erkannt werden.

## Blueprint Scope Gate
`12.blueprint-scope-gate.module.mjs` prueft:
- exakt 3 Blueprint-Scopes als Pflichtvertrag
- Blockade bei Scope-Ueberschneidung
- Blockade bei fehlenden Machbarkeitskriterien

## Mobile Perf Guardrails
`13.mobile-perf-guardrails.module.mjs` prueft:
- Preflight liefert Perf-Telemetrie (`[PREFLIGHT][PERF] durationMs=...`)
- Preflight bleibt innerhalb `SEEDWORLD_PREFLIGHT_MAX_MS` (Default `5000`)
- App-Code wird fail-closed blockiert, sobald `setInterval(...)` als Hintergrundlast auftaucht

## Doku-Workflow
Wenn Dokumente mit Traceability-Bezug geaendert werden, gilt die Reihenfolge:
1. `npm run sync:docs`
2. `npm run preflight`
3. `npm test`

Das betrifft insbesondere `docs/KERNEL_SPEC.md`, `docs/TRACEABILITY.json`, `docs/FUNCTION_SOT.json`, `docs/STRING_MATRIX.json`, `docs/BLUEPRINT_SCOPES.json`, `docs/TESTING.md` und `docs/trace-lock.json`.
