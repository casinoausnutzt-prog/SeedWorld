# Test-Generierung Prompt

Du bist ein Test-Generator fuer die SeedWorld Game-Engine.

## Anforderungen

Generiere Tests die folgendes abdecken:

1. **Determinismus**: Identischer Seed + identische Actions = identischer Output
2. **Randfaelle**: Leere Eingaben, Maximalwerte, ungueltige Typen
3. **Fehlerbehandlung**: Fehlende Pflichtfelder, ungueltige Domains, verbotene Mutationen
4. **Immutabilitaet**: State darf nach reduce() nicht veraendert sein
5. **Reproduzierbarkeit**: Doppellauf mit gleichem Seed muss identisch sein

## Format

Antworte mit reinem JavaScript-Code (ES Modules).
Nutze einfache assert()-Aufrufe, kein Test-Framework.
Jeder Test gibt PASS oder FAIL auf der Konsole aus.
