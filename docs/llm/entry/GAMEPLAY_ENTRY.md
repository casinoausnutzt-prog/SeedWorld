# Gameplay Entry Protocol

Dies ist das Entry-Dokument für Änderungen im Gameplay-Bereich. Alle Änderungen an `app/src/game/` und `engine/game/` müssen diesem Protokoll entsprechen.

## 1. Workflow

1.  **Beschreibung**: Klare und prägnante Beschreibung der Gameplay-Änderung und ihres Zwecks.
2.  **Referenzen**: Verweise auf Game Design Dokumente, Balancing-Spezifikationen oder Community-Feedback.
3.  **Impact-Analyse**: Bewertung des Einflusses auf Spielbalance, Spielerfahrung und Determinismus.
4.  **Testplan**: Beschreibung der manuellen und automatisierten Tests, die zur Validierung der Gameplay-Änderung durchgeführt werden (z.B. Unit-Tests, Integrationstests, Playtests).

## 2. Guards

*   **Deterministic Gameplay**: Alle Gameplay-Logik muss deterministisch sein und darf keine nicht-deterministischen APIs verwenden.
*   **Mutation Matrix Compliance**: Alle State-Änderungen müssen der `mutationMatrix` entsprechen.
*   **Game Balance**: Änderungen dürfen die Spielbalance nicht signifikant stören, es sei denn, dies ist explizit im Design dokumentiert.
*   **Modul-Vertrag**: Neue Gameplay-Module müssen den definierten Modul-Verträgen entsprechen.

## 3. Done-Kriterien

*   `GAMEPLAY_ENTRY.md` existiert und ist vollständig ausgefüllt.
*   Alle Guards sind erfüllt.
*   Alle Tests sind bestanden.
*   Playtests sind durchgeführt und Feedback wurde berücksichtigt.
