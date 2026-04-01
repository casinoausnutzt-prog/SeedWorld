# UI Entry Protocol

Dies ist das Entry-Dokument für Änderungen im UI-Bereich. Alle Änderungen an `app/src/ui/` und `app/public/` müssen diesem Protokoll entsprechen.

## 1. Workflow

1.  **Beschreibung**: Klare und prägnante Beschreibung der UI-Änderung und ihres Zwecks.
2.  **Referenzen**: Verweise auf relevante Design-Spezifikationen, Mockups oder User Stories.
3.  **Impact-Analyse**: Bewertung des Einflusses auf Performance, Zugänglichkeit und Benutzerfreundlichkeit.
4.  **Testplan**: Beschreibung der manuellen und automatisierten Tests, die zur Validierung der UI-Änderung durchgeführt werden.

## 2. Guards

*   **Read-Only UI**: Die UI darf den Kernel-State nur lesen und Aktionen über den `KernelController` dispatchen. Direkte State-Manipulation ist verboten.
*   **Performance Budget**: UI-Updates müssen innerhalb eines definierten Performance-Budgets liegen (z.B. 60 FPS).
*   **Accessibility**: Alle UI-Komponenten müssen den WCAG 2.1 AA-Richtlinien entsprechen.

## 3. Done-Kriterien

*   `UI_ENTRY.md` existiert und ist vollständig ausgefüllt.
*   Alle Guards sind erfüllt.
*   Alle Tests sind bestanden.
*   Visuelle Regressionstests sind durchgeführt und genehmigt.
