# SeedWorld Kernel Spec

### ANCHOR: KERNEL-DETERMINISM
Der Kernel ist seed-deterministisch. Gleicher Input-Seed erzeugt identische Tick-States und denselben MUT-Fingerprint.

### ANCHOR: KERNEL-GUARDS
Waehrend der Kernel-Ausfuehrung werden nicht-deterministische APIs blockiert: `Date.now`, `Date()` ohne Argumente, `Math.random`, `performance.now`, `crypto.getRandomValues`, `crypto.randomUUID`.

### ANCHOR: SEED-GUARD
Jeder Kernel-Run verlangt zwingend einen Seed-Abgleich: `seed` muss zu `expectedSeedHash` passen.
Fehlender oder falscher Seed-Hash fuehrt fail-closed zu `[SEED_GUARD]`.
Der Abgleich wird im Kernel selbst erzwungen und gilt damit auch bei direktem Aufruf ohne Interface.

### ANCHOR: KORNER-MODULE
`src/kernel/kornerCore.js` ist das konsolidierte Kernmodul fuer bisherige Koernerarbeit: Determinismus, Security-Management, Geldsystem-Simulation und Governance.
Das Modul stellt Manifest + Snapshot bereit und liefert die String-Matrix ueber die Kernel-Schnittstelle.

### ANCHOR: STRING-MATRIX
`docs/STRING_MATRIX.json` und `korner.string-matrix` muessen inhaltlich identisch sein.
Die Matrix kategorisiert Systembereiche fuer Determinismus, Security, Governance und Money-System.

### ANCHOR: STORE-DISPATCH-GATE
State-Mutationen sind hart auf `dispatch()` begrenzt (`src/kernel/store/createStore.js`).
`createStore()` verbietet das Abschalten von `guardDeterminism`, validiert Actions gegen Schema, blockiert direkte Input-Mutation in Reducer/SimStep durch gefrorene Inputs und friert den resultierenden State ein.

### ANCHOR: STORE-PATCH-GATE
Patch-Anwendung (`src/kernel/store/applyPatches.js`) prueft Domain-Gates, `mutationMatrix`-Pfadpraefixe, Sanitization und blockiert Root-Container-Replacements explizit.

### ANCHOR: LLM-GOVERNANCE-CHAIN
`src/kernel/llmGovernance.js` erzwingt die Pflichtkette fuer LLM/Contributors:
Action-Schema -> Mutation-Matrix -> Domain-Patch-Gate -> Determinism-Guard -> Sanitization.

### ANCHOR: DEADMAN-TRIGGER
`tools/runtime/deadmanGuard.mjs` erstellt einen Gate-Datei-Snapshot und erzwingt in `tests/MainTest.mjs` vor und nach jedem Modul einen Integritaetscheck.
Dadurch kann kein Test dauerhaft Gate-Dateien manipulieren, ohne sofort fail-closed mit `[DEADMAN_TRIGGER]` zu stoppen.

### ANCHOR: FUNCTION-SOT
`docs/FUNCTION_SOT.json` ist die synchronisationspflichtige Source of Truth fuer alle erkannten Funktionen im Projekt (Code + Runtime-Tools + Tests), kategorisiert nach Bereich.
Der Preflight blockiert jeden Start, wenn diese Datei nicht 100% mit dem aktuellen Codebestand uebereinstimmt.
Aenderungen an Funktionen muessen immer mit `npm run sync:docs` synchronisiert werden.

### ANCHOR: FINGERPRINT-MUT
MUT-Fingerprint basiert auf kanonischer JSON-Serialisierung und SHA-256.

### ANCHOR: KERNEL-ENTRYPOINT
Es gibt genau einen App-Entry in den Kernel: `src/kernel/interface.js` mit `executeKernelCommand(...)`.
Direkte Importe auf interne Kernel-Dateien ausserhalb von `src/kernel/*` sind verboten und werden im Preflight geblockt.

### ANCHOR: PATCH-DISPATCHER-GATE
Patchen laeuft nur ueber den Dispatcher Gate (`patch.plan`, `patch.apply`) in der Kernel-Schnittstelle.
Ungepatchte/falsch formatierte Payloads werden geblockt.
Konflikte oder direkte Verknuepfungen neuer zu bestehenden Funktionen werden gemeldet und erfordern explizite Bestaetigung.

### ANCHOR: PREFLIGHT-DOC-SYNC
Bei jedem Runtime-Start wird ein Preflight ausgefuehrt. Wenn Code oder Dokumentation nicht synchron sind, bricht der Start mit Fehler, Datei, Zeile und MUT-ID ab.

### ANCHOR: BLUEPRINT-SCOPE-GATE
`tools/runtime/validateBlueprintScopes.mjs` erzwingt fail-closed genau drei Blueprints (`docs/UI_PLAN.md`, `docs/MECHANICS_PLAN.md`, `docs/GAME_MASTER_PLAN.md`), blockiert Scope-Ueberschneidung und prueft pro Blueprint verbindliche Machbarkeitskriterien.
Der Preflight bricht bei Verstoessen mit `[PREFLIGHT][BLUEPRINT_POLICY]` ab.
