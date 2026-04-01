# Governance Entry Protocol

Dies ist das Entry-Dokument für Änderungen im Governance-Bereich. Alle Änderungen an `dev/governance/`, `dev/testline/` und `dev/hygiene/` müssen diesem Protokoll entsprechen.

## 1. Workflow

1.  **Beschreibung**: Klare und prägnante Beschreibung der Governance-Änderung und ihres Zwecks.
2.  **Referenzen**: Verweise auf Policy-Dokumente, Sicherheitsstandards oder Compliance-Anforderungen.
3.  **Impact-Analyse**: Bewertung des Einflusses auf die Integrität des Systems, die Sicherheit und die Reproduzierbarkeit.
4.  **Testplan**: Beschreibung der automatisierten Tests, die zur Validierung der Governance-Änderung durchgeführt werden (z.B. Integritätstests der Testline, Audit-Checks).

## 2. Guards

*   **Policy Enforcement**: Alle Änderungen müssen den definierten Governance-Policies entsprechen.
*   **Testline Integrity**: Die Testline muss nach jeder Änderung intakt und reproduzierbar bleiben.
*   **Hygiene Compliance**: Alle Hygiene-Checks müssen erfolgreich durchlaufen werden.
*   **LLM-Preflight Integration**: Änderungen an LLM-bezogenen Governance-Mechanismen müssen den LLM-Preflight-Prozess durchlaufen.

## 3. Done-Kriterien

*   `GOVERNANCE_ENTRY.md` existiert und ist vollständig ausgefüllt.
*   Alle Guards sind erfüllt.
*   Alle Tests sind bestanden.
*   Ein vollständiger Governance-Report liegt vor und ist verifiziert.
