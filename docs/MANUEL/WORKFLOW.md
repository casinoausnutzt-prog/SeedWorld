# Workflow

## Pflichtlinie

```bash
npm test
npm run evidence:verify
npm run testline:verify
npm run docs:v2:verify
npm run check:required
```

## Reihenfolge

1. Kernel- oder Content-Aenderung lokal ausfuehren.
2. Doppel-Lauf-Testlinie ausfuehren.
3. Doku-2.0-Guard gegen rohe Plan-Dateien und unregistrierte Dateien passieren.
4. Evidence vergleichen.
5. Doku-2.0-Plan und Archiv automatisch mitsynchronisieren.
6. Testline-Schlusstest bestaetigen.
7. Erst dann committen/pushen.

## Regeln

- Kein Pflichttest ohne zwei Laeufe.
- Kein Pflichttest ohne Evidence.
- Kein offener Planungspfad ausserhalb von `tem/tasks/open/*.json`.
- Kein Gesamtstatus ohne Testline-Schlusstest.
- Kein `PASS` ohne Reproduktionsbeweis.
- Browser-, Patch- und Serverreste sind nicht fuehrend.
