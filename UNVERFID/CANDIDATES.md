# UNVERFID Isolation Candidates

Diese Dateien/Artefakte sind als potenziell redundant oder veraltet isoliert und noch nicht endgueltig geloescht.

## Isoliert

- `README-DEV.md` (verschoben nach `UNVERFID/README-DEV.md`)
  - Grund: Doppelung zum Root-README, Risiko widerspruechlicher Aussagen.
  - Status: pending review before delete or merge.

## Weitere Kandidaten (noch nicht verschoben)

- `docs/audit/` historische Snapshot-Berichte
  - Grund: hoher Informationswert, aber nicht immer fuer Runtime relevant.
  - Aktion: erst nach Team-Freigabe deduplizieren oder archivieren.

- `output/` lokal erzeugte Artefakte
  - Grund: Build/Test-Reste koennen unklar sein.
  - Aktion: Cleanup-Policy definieren (gitignored, retention).
