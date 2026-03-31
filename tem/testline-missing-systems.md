# Testline Missing Systems Report

Stand: `2026-03-31`

Dieser Report ist jetzt nur noch eine knappe Orientierung fuer den reduzierten Pflichtpfad.
Die maschinenlesbare Wahrheit liegt in:

- `app/src/sot/REPO_HYGIENE_MAP.json`
- `dev/scripts/test-runner.mjs`
- `dev/scripts/verify-evidence.mjs`
- `dev/tools/runtime/verify-testline-integrity.mjs`

## Summary
- Pflichtpfad ist auf Reproduktions-Evidence reduziert.
- Geloeschte Browser-/Plugin-/Legacy-Dateien gehoeren nicht mehr in die Testline-Aussage.
- Historische Vollabdeckungs-Listen sind nicht mehr fuehrend.

## Aktiver Pflichtkern
- `dev/scripts/test-runner.mjs`
- `dev/scripts/verify-evidence.mjs`
- `dev/tools/runtime/verify-testline-integrity.mjs`
- `dev/tests/modules/00.runtime-governance-suite.module.mjs`
- `dev/tests/modules/10.determinism-seed-proof-suite.module.mjs`
- `dev/tests/modules/20.gameplay-state-suite.module.mjs`

## Regel
- Fuehrend ist nicht mehr "alles erreicht", sondern "reproduzierbarer Pflichtkern bewiesen".
