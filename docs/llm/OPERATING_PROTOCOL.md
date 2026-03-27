# OPERATING PROTOCOL

## LESEN
- Pflicht-Lesereihenfolge aus `docs/llm/ENTRY.md` einhalten.

## PRUEFEN
1. `node tools/llm-preflight.mjs classify --paths <csv>`
2. `node tools/llm-preflight.mjs entry --paths <csv>`
3. `node tools/llm-preflight.mjs ack --paths <csv>`
4. `node tools/llm-preflight.mjs check --paths <csv>`

## SCHREIBEN
- Nur nach gruenem `check`.
- Nur in klassifizierten Scopes.

## DOKU
- Bei Contract-/Kernel-Aenderungen Doku und Sync-Dateien nachziehen.
