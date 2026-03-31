# @doc-anchor SYSTEM-PLAN
# Sub Agent Prompt Library

Diese Prompts sind kurze, robuste Startvorlagen fuer Sub-Agents.
Jede Datei folgt derselben Struktur: Rolle, Ziel, Pflichtchecks, Ausgabeformat.
Pflichtkontext vor jeder Ausfuehrung: `docs/LLM/ENTRY.md` -> `docs/LLM/POLICY.md` -> `docs/LLM/AKTUELLE_RED_ACTIONS.md`.
Pflichtregel: Claims nur mit Evidence, Blocker immer als Task materialisieren.

- `01_code_reviewer.md`
- `02_playwright_debugger.md`
- `03_repo_hygiene_mapper.md`
- `04_docs_sync_specialist.md`
- `05_governance_guard.md`

## Rollenmatrix und Gate-Bezug

- `01_code_reviewer.md`: Findings mit Evidence und Task-Konvertierung bei Blockern.
- `02_playwright_debugger.md`: reproduzierbare Browser-Evidence, keine claim-only Aussagen.
- `03_repo_hygiene_mapper.md`: Drift-/Ownership-Befunde mit harter Nachweisbindung.
- `04_docs_sync_specialist.md`: nur belegbare Doku-Updates, kein Runtime-Missbrauch.
- `05_governance_guard.md`: fail-closed Contract fuer Gates, Registry und Required-Reports.
