# UNVERFID Isolation Candidates

Diese Dateien/Artefakte sind als potenziell redundant oder veraltet isoliert und noch nicht endgueltig geloescht.

## Isoliert

- `README-DEV.md` (verschoben nach `UNVERFID/README-DEV.md`)
  - Grund: Doppelung zum Root-README, Risiko widerspruechlicher Aussagen.
  - Status: pending review before delete or merge.

- `docs/audit/` (verschoben nach `UNVERFID/docs-audit/`)
  - Grund: historischer Snapshot mit veralteten Pfaden/Annahmen.
  - Status: isolated pending consolidation into canonical docs.

- `sot/` (verschoben nach `UNVERFID/sot-legacy/`)
  - Grund: veraltete zweite SoT-Struktur neben `src/sot` und `docs/SOT`.
  - Status: isolated; `src/sot` ist jetzt die technische SoT-Quelle.

## Weitere Kandidaten (noch nicht verschoben)

- `output/` lokal erzeugte Artefakte
  - Grund: Build/Test-Reste koennen unklar sein.
  - Aktion: Cleanup-Policy definieren (gitignored, retention).
