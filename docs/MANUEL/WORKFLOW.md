# Workflow

## Pflichtlinie

```bash
npm test
npm run evidence:verify
npm run testline:verify
npm run check:required
```

## Reihenfolge

1. Kernel- oder Content-Aenderung lokal ausfuehren.
2. Doppel-Lauf-Testlinie ausfuehren.
3. Evidence vergleichen.
4. Testline-Schlusstest bestaetigen.
5. Erst dann committen/pushen.

## Regeln

- Kein Pflichttest ohne zwei Laeufe.
- Kein Pflichttest ohne Evidence.
- Kein Gesamtstatus ohne Testline-Schlusstest.
- Kein `PASS` ohne Reproduktionsbeweis.
- Browser-, Patch- und Serverreste sind nicht fuehrend.
