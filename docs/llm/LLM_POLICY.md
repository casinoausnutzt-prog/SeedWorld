# LLM Policy: SeedWorld Engine V3

Diese Policy definiert die Regeln für LLM-Agenten, die an der SeedWorld-Engine arbeiten. Die Einhaltung dieser Regeln wird durch mechanische Gates (`llm-preflight.mjs`) erzwungen.

## 1. Invarianten

1.  **Dispatch Patch Only**: Alle Zustandsänderungen müssen über `store.dispatch` erfolgen und als Patches zurückgegeben werden. Direkte State-Mutationen sind verboten.
2.  **Deterministic Sim**: Die Simulationslogik (`simStep`) muss zu 100% deterministisch sein. Die Verwendung von `Math.random()` oder `Date.now()` führt zum sofortigen Abbruch.
3.  **Manifest First**: Alle Änderungen an der State-Struktur oder den Action-Typen müssen zuerst im `runtimeManifest.js` definiert werden.
4.  **UI Read-Only**: Die Benutzeroberfläche darf den Kernel-State nur lesen. Sie darf keine eigene Wahrheit (Truth) besitzen.

## 2. Preflight-Prozess

Jeder LLM-Agent muss vor der Abgabe von Code den Preflight-Prozess durchlaufen:

1.  `npm run llm:preflight -- --paths <geänderte_dateien>`: Klassifizierung der Änderungen.
2.  `npm run llm:preflight:entry`: Prüfung der Entry-Dokumente.
3.  `npm run llm:preflight:spawn-proof`: Erbringung des Lesebeweises für die Invarianten.
4.  `npm run llm:preflight:check`: Finale Validierung.

## 3. Verbotene APIs

Die Verwendung folgender APIs im Kernel oder in der Gameplay-Logik ist strengstens untersagt:
*   `Math.random()`
*   `Date.now()`
*   `performance.now()`
*   `setTimeout()` / `setInterval()` (außerhalb des UI-Controllers)
*   Nicht-deterministische Iteration über Objekte (verwende sortierte Keys).

## 4. Sanktionen

Verstöße gegen diese Policy führen zum automatischen Scheitern der Governance-Checks und verhindern den Merge oder Push von Code.
