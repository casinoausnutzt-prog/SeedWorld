# SeedWorld System Hardening Report

Stand: 2026-03-25
Status: FINAL
Geltungsbereich: gesamtes Projekt unter `/root/SeedWorld`

## Zweck

Dieser Bericht verdichtet den aktuellen Architekturstand, die vorhandenen Reports und die wirksamen Betriebsregeln in einen autoritativen Gesamttext.

Er ersetzt keine technischen Source-of-Truth-Dateien, legt aber den finalen Hardening-Status ausfuehrbar aus.

## Quellenlage und Einordnung

Konsolidierte Quellen:
- `README.md`
- `docs/KERNEL_SPEC.md`
- `docs/TESTING.md`
- `docs/TRACEABILITY.json`
- `docs/FUNCTION_SOT.json`
- `docs/STRING_MATRIX.json`
- `docs/trace-lock.json`
- `docs/GO_NO_GO_PLAN.md`
- `docs/QA_ARCHITECTURE_AUDIT.md`
- aktueller Code unter `src/`, `tests/`, `tools/runtime/`

Einordnung aelterer Reports:
- `docs/QA_ARCHITECTURE_AUDIT.md` ist eine historische Momentaufnahme eines frueheren Blocker-Stands.
- `docs/GO_NO_GO_PLAN.md` ist ein Arbeits- und Freigabeplan.
- Fuer den aktuellen Endstand hat dieser Bericht Vorrang als zusammenfassender Referenztext.

## Executive Summary

SeedWorld befindet sich im aktuell verifizierten Zustand in einem operativ gehaerteten, lokal betreibbaren Gruen-Status.

Verifiziert am 2026-03-25:
- `npm run preflight`: PASS
- `npm test`: PASS
- `tests/MainTest.mjs`: 11 von 11 Modulen PASS

Finale Kernaussagen:
- Es gibt genau einen App-Einstieg in den Kernel: `src/kernel/interface.js`.
- Jeder produktive Kernel-Run ist seed-deterministisch und verlangt zwingend einen gueltigen `seedHash`.
- Nicht-deterministische APIs werden waehrend des Kernel-Runs fail-closed blockiert.
- Store-, Patch- und LLM-Governance-Pfade sind domain-begrenzt, schema-validiert, sanitisiert und gegen Root-/Prototype-Manipulation gehaertet.
- Dokumentation und Code stehen unter einem harten Sync-Gate aus `TRACEABILITY`, `FUNCTION_SOT`, `trace-lock` und Runtime-Preflight.
- Der Betriebsmodus ist bewusst klein, lokal und dependency-frei; genau das ist ein Teil der Sicherheits- und Performance-Strategie.

## Aktuelle Architektur

Laufpfad:
1. `index.html` laedt die mobile-first Einseitenoberflaeche.
2. `src/main.js` spricht ausschliesslich mit `executeKernelCommand(...)` aus `src/kernel/interface.js`.
3. Die Kernel-Schnittstelle delegiert an deterministischen Run, Patch-Dispatcher, Korner-Snapshot und LLM-Governance.
4. Vor regularem Start erzwingt `npm start` immer `npm run preflight`.
5. Vor Freigabe erzwingt `npm test` immer den zentralen Runner `tests/MainTest.mjs`.

Kernel-Kern:
- `src/kernel/deterministicKernel.js`: deterministischer Simulationslauf mit Tick-Grenze `1..256`
- `src/kernel/seedGuard.js`: verpflichtender Seed-Hash-Abgleich
- `src/kernel/runtimeGuards.js`: Blockade von `Date.now`, leerem `Date()`, `Math.random`, `performance.now`, `crypto.getRandomValues`, `crypto.randomUUID`
- `src/kernel/fingerprint.js`: kanonische Serialisierung plus SHA-256-MUT-Fingerprint
- `src/kernel/kornerCore.js`: konsolidiertes Manifest und String-Matrix fuer Determinismus, Security, Governance und Money-System

Governance- und State-Gates:
- `src/kernel/store/createStore.js`: dispatch-only Mutationen, Action-Schema, Freeze, Determinism-Guard
- `src/kernel/store/applyPatches.js`: Domain-Gate, mutationMatrix, Sanitization, Root-Block, Prototype-Pfad-Block
- `src/kernel/llmGovernance.js`: verpflichtende Kette `Action-Schema -> Mutation-Matrix -> Domain-Patch-Gate -> Determinism-Guard -> Sanitization`
- `src/kernel/patchDispatcher.js`: `patch.plan` und `patch.apply` mit Konfliktanalyse und Confirm-Gate

Traceability- und Test-System:
- `docs/FUNCTION_SOT.json`: 126 aktuell erkannte Funktionen als synchronisationspflichtige Funktions-SoT
- `docs/TRACEABILITY.json`: 13 Doku-Anker, 10 Trackfiles, 7 verbotene Kernel-Pattern
- `docs/trace-lock.json`: Hash-, Line- und MUT-Lock fuer Trackfiles
- `tests/MainTest.mjs`: einziger "run all tests"-Entry

## Finaler Sicherheitszustand

### 1. Determinismus

Der deterministische Vertrag ist im aktuellen Stand wirksam:
- gleicher Seed plus gleicher `seedHash` erzeugt denselben MUT-Fingerprint
- anderer Seed erzeugt einen anderen Fingerprint
- Tick-Lauf ist hart auf maximal 256 Schritte begrenzt
- nicht-deterministische APIs werden waehrend Kernel- und Store-Ausfuehrung geblockt

Das ist nicht nur dokumentiert, sondern durch Preflight und Pflichtmodule testseitig abgesichert.

### 2. Seed- und Integritaetsschutz

Der Seed-Hash-Abgleich ist final verpflichtend und fail-closed:
- fehlender `seedHash` blockiert
- ungueltiger `seedHash` blockiert
- falscher `seedHash` blockiert
- direkter Kernel-Bypass ohne erwarteten Hash ist kein erlaubter Betriebsmodus

Die UI kann den Hash fuer Komfort berechnen, der eigentliche Sicherheitsvertrag bleibt aber im Kernel selbst verankert.

### 3. Kernel-Kapselung

Die Single-Entry-Regel ist final:
- App-Code ausserhalb von `src/kernel/` darf keine internen Kernel-Dateien direkt importieren
- erlaubt ist nur `src/kernel/interface.js`
- Preflight scannt `src/` aktiv auf direkte und einfache umgehende Kernel-Importmuster

Damit ist die Architektur nicht nur stilistisch, sondern technisch gegen Drift gehaertet.

### 4. Patch- und State-Sicherheit

Patch- und Store-Mutationen sind aktuell gehaertet gegen:
- ungepatchte oder falsch formatierte Dispatcher-Payloads
- doppelte oder bereits vorhandene Funktionsnamen
- direkte Kopplung neuer zu bestehender Funktionen ohne explizite Bestaetigung
- domain-fremde Patch-Anwendung
- mutationMatrix-Verletzungen
- Root-Container-Replacement
- Prototype-Pollution-Pfade
- unzulaessige Datentypen, `NaN`, `Infinity`, Funktionen, Symbole und `bigint`

Der Store arbeitet nur ueber `dispatch()` und friert Eingaben und Ergebnisse ein. Das reduziert Seiteneffekte und erschwert stilles Wegmutieren von Guard-Regeln.

### 5. Dokumentations- und Release-Sicherheit

SeedWorld ist final nicht nur code-, sondern dokumentationsgehaertet:
- `TRACEABILITY.json` ist gehasht und gegen Manipulation gelockt
- `FUNCTION_SOT.json` muss bytegenau zum aktuellen Code passen
- `KERNEL_SPEC.md` muss alle Pflicht-Anker enthalten
- alle Trackfiles muessen die geforderten `@doc-anchor` und `@mut-point` Marker enthalten
- `trace-lock.json` bindet Hash und Zeilenstand der Trackfiles
- Preflight stoppt bei jeder Abweichung fail-closed und nennt Datei, Zeile und MUT-ID

Das Projekt hat damit einen expliziten Sync-Gate vor jedem regularem Start.

## Betriebsregeln

Verbindliche Regeln fuer normalen Betrieb:
1. Startpfad ist `npm start`.
2. Testpfad ist `npm test`.
3. Direkte Kernel-Nutzung ausserhalb von `src/kernel/interface.js` ist nicht erlaubt.
4. Produktive Kernel-Runs muessen `seed` und passenden `seedHash` liefern.
5. State-Aenderungen laufen nur ueber `dispatch()` oder den Dispatcher-Gate, nie ueber direkte Objektmutation.
6. LLM- oder Contributor-getriebene Patches muessen die komplette Governance-Kette durchlaufen.
7. Fail-closed ist das Standardverhalten; "trotz Fehler weiterlaufen" ist kein gueltiger Betriebsmodus.

Team- und Repo-Regeln:
1. Keine fremden Aenderungen revertieren.
2. Sync-Artefakte nur ueber die vorhandenen Runtime-Tools aktualisieren.
3. Gleichzeitige Schreibvorgaenge auf SoT- und Lock-Dateien laufen unter Repo-Lock.
4. Historische Reports duerfen nicht als aktueller Freigabestatus zitiert werden, wenn Preflight/Test inzwischen gruen sind.

## Patch-Disziplin

Jeder inhaltliche Patch am Kernel oder an seinen Vertraegen folgt derselben Disziplin:
1. Aenderung im Code oder in den verankerten Doku-Dateien vornehmen.
2. Falls Funktionsbestand betroffen ist: `npm run sync:docs`.
3. Danach immer `npm run preflight`.
4. Danach immer `npm test`.

Dispatcher-spezifische Regeln:
1. Nur Payloads mit `patched: true` und `target: "kernel"` sind gueltig.
2. Erlaubte Operation ist aktuell nur `addFunction`.
3. `patch.plan` ist vor `patch.apply` der Pflichtweg, sobald Konflikte oder Kopplungen moeglich sind.
4. Wenn `patch.plan` `needs_confirmation` liefert, darf `patch.apply` nur mit passendem Token und `accept: true` erfolgen.
5. Gleiches `patchId` darf nicht mehrfach angewendet werden.

Diese Disziplin ist Teil des Sicherheitsmodells und keine optionale Teamkonvention.

## Sync-Gates

Der finale Sync-Mechanismus besteht aus vier Schichten:

### 1. Function-SoT-Gate

`tools/runtime/updateFunctionSot.mjs` erzeugt `docs/FUNCTION_SOT.json` unter Repo-Lock neu.

Preflight vergleicht die gespeicherte Datei anschliessend mit einer frisch generierten Version. Jede Abweichung blockiert den Start.

### 2. Trace-Lock-Gate

`tools/runtime/updateTraceLock.mjs` schreibt:
- SHA-256 von `docs/TRACEABILITY.json`
- SHA-256 aller Trackfiles
- komplette Zeilenabbilder der Trackfiles
- erkannte `@mut-point` Marker

Dadurch kann Preflight bei Drift die erste betroffene Zeile und die naechste MUT-ID melden.

### 3. Anchor- und Pattern-Gate

Preflight prueft:
- Pflicht-Anker in `docs/KERNEL_SPEC.md`
- Pflicht-Anker und MUT-Points in allen Trackfiles
- verbotene nicht-deterministische API-Muster in Kernel-Dateien
- Single-Interface-Policy in `src/`

### 4. Repo-Lock-Gate

`tools/runtime/repoLock.mjs` serialisiert schreibende Doku-/Lock-Operationen ueber `.seedworld-repo.lock`.

Damit werden gleichzeitige Regenerierungen von `FUNCTION_SOT.json` und `trace-lock.json` gegeneinander abgesichert.

## Mobile-Performance-Grenzen

SeedWorld ist kein generisches Frontend, sondern ein absichtlich kleiner lokaler Prototype. Daraus folgen harte Betriebsgrenzen.

Aktuelle statische Oberflaechen-Groesse:
- `index.html`: 1795 Byte
- `src/main.js`: 2757 Byte
- `src/styles.css`: 2176 Byte
- statische UI-Huelle zusammen: 6728 Byte

Finale Performance-Regeln:
1. Keine externen Runtime-Abhaengigkeiten fuer die UI einfuehren.
2. Kein Netzwerk-Fetch, Polling, Timer-Loop, Canvas-, WebGL- oder Animations-Loop im Standard-Run ohne neue explizite Budgetentscheidung.
3. Die mobile-first Einspaltenstruktur unterhalb `720px` bleibt der Default.
4. Interaktive Controls muessen touch-tauglich bleiben; kleine dichte Desktop-Controls sind nicht Zielzustand.
5. Kernel-Runs bleiben im UI-Pfad auf den bereits erzwungenen Bereich `1..256` beschraenkt.
6. Neue Features duerfen den Startpfad `npm start -> preflight -> lokaler Server -> eine Seite` nicht aufbrechen.
7. Wenn groessere UI- oder Simulationslast eingefuehrt wird, muss vorher eine neue messbare Performance-Grenze dokumentiert und getestet werden.

Diese Grenzen sind bewusst konservativ. Die aktuelle Sicherheit profitiert davon, dass die Laufzeitoberflaeche klein, lokal und ohne Fremdcode bleibt.

## Aufloesung historischer Blocker

Die aelteren Reports dokumentieren reale Zwischenstaende, sind aber nicht mehr der aktuelle Status.

Im heutigen verifizierten Stand gilt:
- der historische rote Zustand aus `docs/QA_ARCHITECTURE_AUDIT.md` ist nicht mehr der operative Zustand
- die im `docs/GO_NO_GO_PLAN.md` beschriebenen Freigabe-Gates sind aktuell erfuellt
- der verbindliche Seed-Hash-Vertrag ist im Code, in `README.md`, `docs/KERNEL_SPEC.md` und `docs/TESTING.md` konsistent verankert

Deshalb ist der aktuelle Abschlussstatus kein "blocked", sondern ein gruener, kontrollierter Betriebsstand mit fail-closed Gates.

## Freigabeentscheidung

Freigabe fuer den aktuellen lokalen Prototyp: JA

Begruendung:
- Runtime-Preflight ist gruen
- MainTest ist gruen
- Kernel-Kapselung, Seed-Guard, Determinismus-Guards, Patch-Gates und Sync-Gates sind aktiv
- die Restkomplexitaet bleibt klein und damit auditierbar

Nicht Teil dieser Freigabe:
- Backend
- Persistenz
- Multiplayer/Sync
- Produktions-Build-Pipeline
- beliebiges Hochskalieren der UI- oder Simulationslast ohne neue Budgetierung

## Praktischer Pflichtablauf bei Aenderungen

Pflichtablauf:
1. Code oder verankerte Doku aendern.
2. `npm run sync:docs`
3. `npm run preflight`
4. `npm test`

Wenn einer dieser Schritte rot ist, ist der Aenderungsstand nicht freigabefaehig.
