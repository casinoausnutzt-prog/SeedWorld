# @doc-anchor SYSTEM-PLAN
# SeedWorld Engine V2 Architektur

Die SeedWorld Engine wurde komplett neu geschrieben, um 100% Determinismus und Reproduzierbarkeit zu garantieren, während gleichzeitig die Governance- und Policy-Schichten aus der Runtime in eine reine Dev-Umgebung ausgelagert wurden.

## 1. Kernarchitektur (Runtime)

Die Runtime-Engine (`engine/kernel/`) ist extrem leichtgewichtig und fokussiert sich ausschließlich auf deterministische Ausführung und State-Management.

*   **Engine.js**: Der zentrale Orchestrator. Nimmt Actions entgegen, leitet sie an Game-Module weiter und committet den neuen State.
*   **DeterministicRNG.js**: Ein Seed-basierter Pseudozufallsgenerator (SplitMix32). Garantiert, dass identische Seeds identische Zufallszahlen erzeugen.
*   **runtimeGuards.js**: Blockiert während der Tick-Ausführung alle nicht-deterministischen APIs (`Math.random`, `Date.now`, `performance.now`, etc.).
*   **stateManager.js**: Verwaltet den State als immutable Snapshots (Deep-Clone + Deep-Freeze). Verhindert Aliasing und versehentliche Mutationen.
*   **fingerprint.js**: Erzeugt reproduzierbare SHA-256 Hashes aus dem State (stabile Serialisierung).

## 2. Game-Module

Game-Module (`engine/game/`) sind reine Funktionen, die den Engine-Vertrag erfüllen müssen. Sie definieren:
*   `domain`: Der Namespace des Moduls (z.B. "game").
*   `actionSchema`: Welche Actions erlaubt sind und welche Felder sie benötigen.
*   `mutationMatrix`: Welche State-Pfade das Modul verändern darf.
*   `createInitialState(seed, rng)`: Generiert den Startzustand.
*   `reduce(state, action, rng)`: Die reine Reducer-Funktion für State-Übergänge.

## 3. Dev-Governance & Policy

Die Governance-Schicht (`dev/governance/`) läuft **nicht** mehr zur Runtime. Sie ist ein reines Dev-Tool (z.B. für CI/CD oder Pre-Commit-Hooks).

*   **policyEngine.mjs**: Führt Checks durch (Modul-Vertrag, Source-Code-Analyse auf verbotene Globals, Determinismus-Beweis).
*   **runChecks.mjs**: Das CLI-Tool, das die Pipeline ausführt und einen Report generiert.

## 4. LLM-Plugin-Layer

Der LLM-Layer (`dev/plugins/llm/`) ist als Dev-Plugin integriert. Er kann genutzt werden für:
*   **Code-Review**: Automatische Prüfung von Game-Modulen auf Determinismus-Verstöße.
*   **Determinismus-Audit**: Analyse von Reproduktionsbeweisen.
*   **Test-Generierung**: Automatische Erstellung von Unit-Tests für neue Game-Module.

## 5. Reproduktionsbeweis (Proof)

Das Modul `engine/proof/reproductionProof.js` führt denselben Seed und dieselben Actions in zwei isolierten Engine-Instanzen aus und vergleicht die resultierenden Fingerprints. Nur wenn beide zu 100% übereinstimmen, gilt der Determinismus als bewiesen (`PASS_REPRODUCED`).

## Testergebnisse

Die Test-Suite (`dev/tests/engine-test.mjs`) umfasst 36 Tests, die alle Kernkomponenten abdecken. Aktueller Status: **36/36 Bestanden (100%)**.
