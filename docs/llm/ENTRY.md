# LLM ENTRY

## Zweck
Pflicht-Dispatcher fuer LLM-Arbeit in SeedWorld.

## Pflicht-Lesereihenfolge
1. `docs/WORKFLOW.md`
2. `docs/llm/ENTRY.md`
3. `docs/llm/OPERATING_PROTOCOL.md`
4. `docs/llm/TASK_ENTRY_MATRIX.json`
5. `docs/llm/entry/TASK_GATE_INDEX.md`
6. Task-Entries je klassifiziertem Scope
7. Globale Mindest-Gates:
   - `src/kernel/interface.js`
   - `src/kernel/store/createStore.js`
   - `src/kernel/store/applyPatches.js`
   - `src/kernel/llmGovernance.js`

## Pflichtkette
`classify -> entry -> ack -> check`

## Harte Invarianten
- Nur der Kernel darf den State mutieren.
- UI und Game-Logik liefern nur Patch-Wuensche.
- Determinismus bleibt aktiv (keine nondeterministischen APIs im Guard-Scope).
- Bei Check-Fehler: kein Schreiben.
