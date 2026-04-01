# Kernel Entry Protocol

Dies ist das Entry-Dokument für Änderungen im Kernel-Bereich. Alle Änderungen an `app/src/kernel/` und `engine/kernel/` müssen diesem Protokoll entsprechen.

## 1. Workflow

1.  **Beschreibung**: Klare und prägnante Beschreibung der Kernel-Änderung und ihres Zwecks.
2.  **Referenzen**: Verweise auf Architektur-Dokumente, Spezifikationen oder Forschungsergebnisse.
3.  **Impact-Analyse**: Bewertung des Einflusses auf Determinismus, Performance und Systemstabilität.
4.  **Testplan**: Beschreibung der automatisierten Tests, die zur Validierung der Kernel-Änderung durchgeführt werden (z.B. Replay-Tests, Unit-Tests, Property-Based Tests).

## 2. Guards

*   **Strict Determinism**: Der Kernel muss zu 100% deterministisch sein. Keine nicht-deterministischen APIs erlaubt.
*   **Mutation Matrix Compliance**: Alle State-Änderungen müssen der `mutationMatrix` entsprechen.
*   **Immutability**: Reducer und SimStep dürfen ihren Input-State nicht mutieren.
*   **Fail-Closed**: Bei Verletzung einer Invariante muss das System sofort abbrechen.

## 3. Done-Kriterien

*   `KERNEL_ENTRY.md` existiert und ist vollständig ausgefüllt.
*   Alle Guards sind erfüllt.
*   Alle Tests sind bestanden.
*   Reproduktionsbeweise sind erbracht und verifiziert.
