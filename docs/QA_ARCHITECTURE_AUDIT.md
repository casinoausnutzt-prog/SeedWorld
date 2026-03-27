# QA Architecture Audit

Stand: 2026-03-25
Projekt: SeedWorld
Rolle: QA Lead

## Urteil

Gesamtstatus: BLOCKED

Kurzbegruendung:
- Die Zielarchitektur ist klar formuliert: ein einziger Kernel-Entry, deterministischer Kernel, Patch-Dispatcher-Gate, Runtime-Preflight und MainTest als zentraler Runner.
- Der aktuelle Repo-Zustand harmoniert aber nicht vollstaendig mit dieser Architektur.
- Zwei technische P0-Blocker verhindern aktuell eine Freigabe:
  - Preflight blockiert den App-Start und `MainTest`.
  - Ein gueltiger Kernel-Run scheitert im Fingerprint-Pfad trotz korrektem `seedHash`.

## Belegte Checks

Ausgefuehrt:
- `npm run preflight`
- `npm test`
- isolierter Patch-Gate-Check via `executeKernelCommand("patch.plan"|"patch.apply")`
- isolierter Seed-Guard-/Run-Check via `executeKernelCommand("run")`
- Lock-Hash-Vergleich fuer `src/kernel/interface.js`

Ergebnisse:
- `npm run preflight`: FAIL
- `npm test`: FAIL
- Patch-Dispatcher-Gate: PASS im isolierten Direktcheck
- Seed-Guard ohne `seedHash`: PASS als Fail-Closed-Check
- Kernel-Run mit gueltigem `seedHash`: FAIL im Fingerprint
- `trace-lock.json` fuer `src/kernel/interface.js`: synchron

## 1) Harmoniert die Architektur?

Antwort: teilweise, aber nicht vollstaendig.

### Kernel

Positiv:
- `src/kernel/interface.js` kapselt die Commands `run`, `patch.plan`, `patch.apply`, `patch.state`.
- `src/kernel/deterministicKernel.js` nutzt einen lokalen deterministischen RNG-Pfad.
- `src/kernel/runtimeGuards.js` blockiert die vorgesehenen nondeterministischen APIs waehrend des Kernel-Runs.
- `src/kernel/seedGuard.js` erzwingt den Seed-Hash fail-closed.

Negativ:
- Der erfolgreiche `run`-Pfad ist faktisch defekt, weil `createMutFingerprint()` an Arrays scheitert.
- Damit harmonieren Kernel-Design und Laufzeitverhalten aktuell nicht.

Belege:
- `src/kernel/interface.js:19`
- `src/kernel/deterministicKernel.js:33`
- `src/kernel/runtimeGuards.js:42`
- `src/kernel/seedGuard.js:34`
- `src/kernel/fingerprint.js:74`

### Interface

Soll:
- Laut Spezifikation darf App-Code nur ueber `src/kernel/interface.js` in den Kernel.

Ist:
- `src/main.js` importiert direkt `sha256Hex` aus `src/kernel/fingerprint.js`.
- Der Preflight erkennt das korrekt als Architekturbruch.

Belege:
- `src/main.js:1`
- `src/main.js:2`
- `docs/KERNEL_SPEC.md:17`
- `tools/runtime/preflight.mjs:138`

Bewertung:
- Interface-Architektur ist definiert, aber aktuell verletzt.

### Dispatcher

Positiv:
- Das Patch-Gate ist klar getrennt.
- Format, Konflikte, direkte Verknuepfungen und Confirm-Pflicht werden technisch durchgesetzt.
- Das Verhalten konnte isoliert reproduziert werden.

Belege:
- `src/kernel/patchDispatcher.js:58`
- `src/kernel/patchDispatcher.js:102`
- `src/kernel/patchDispatcher.js:167`
- `src/kernel/patchDispatcher.js:186`

Bewertung:
- Dieser Teil harmoniert aktuell am besten.

### Preflight

Positiv:
- Doku-Anker, Code-Anker, Mut-Points, verbotene Patterns, Interface-Policy und Trace-Lock werden geprueft.
- Fail-Closed-Verhalten ist vorhanden und klar.

Negativ:
- Weil `src/main.js` die Interface-Policy verletzt, blockiert Preflight den gesamten operativen Fluss.
- Das ist aus QA-Sicht korrekt, aber es bedeutet: Architektur und aktueller App-Code sind nicht im Einklang.

Belege:
- `tools/runtime/preflight.mjs:82`
- `tools/runtime/preflight.mjs:138`
- `tools/runtime/preflight.mjs:171`

### Tests / MainTest

Positiv:
- `tests/MainTest.mjs` ist der einzige zentrale Einstieg und laedt zuerst das Pflichtmodul.
- Die Modulstruktur ist sauber und nachvollziehbar.

Negativ:
- `MainTest` ist momentan nicht freigabefaehig, weil das Pflichtmodul sofort am roten Preflight scheitert.
- Die Testarchitektur ist also gut angelegt, aber der aktuelle Stand ist nicht gruen.

Belege:
- `tests/MainTest.mjs:19`
- `tests/modules/00.mandatory.module.mjs:10`

## 2) Ermoeglicht die Architektur deterministisches, voll dokumentiertes Arbeiten?

Antwort: als Design ja, im aktuellen Stand nein.

### Determinismus

Positiv:
- Seed-Guard ist streng.
- Runtime-Guards sind vorhanden.
- Deterministische RNG-Quelle ist im Kernel implementiert.

Blockierend:
- Der produktive Lauf mit korrektem `seedHash` endet derzeit nicht erfolgreich.
- Ursache ist `stableStringifyInternal()` in `src/kernel/fingerprint.js`: Arrays werden wegen der Reihenfolge der Typpruefung als unzulaessig behandelt.

Beleg:
- `src/kernel/fingerprint.js:74`
- `src/kernel/fingerprint.js:80`

Konkreter beobachteter Fehler:
- `TypeError: stableStringify unterstuetzt nur Arrays, Dates und Plain-Objects; gesehen: [object Array]`

### Voll dokumentiertes Arbeiten

Positiv:
- `docs/KERNEL_SPEC.md`, `docs/TESTING.md`, `docs/TRACEABILITY.json` und `docs/trace-lock.json` bilden ein klares Doku-/Trace-System.
- Der Lock fuer `src/kernel/interface.js` ist aktuell synchron.

Negativ:
- Die Scope-Doku behauptet einen optionalen Hash-Vergleich, waehrend Kernel, README und Tests zwingenden Seed-Abgleich verlangen.
- Dadurch ist die Architektur nicht voll konsistent dokumentiert.

Belege:
- `docs/SCOPE.md:10`
- `docs/KERNEL_SPEC.md:9`
- `docs/TESTING.md:28`
- `README.md:4`

Bewertung:
- Dokumentationssystem vorhanden und technisch ernst gemeint.
- Aber die Spezifikation ist inhaltlich noch nicht voll synchron.

## 3) Blocker und Risiken mit Prioritaet

### P0: Interface-Architekturbruch in `src/main.js`

Befund:
- `src/main.js` importiert `./kernel/fingerprint.js` direkt.
- Preflight blockiert deshalb zurecht mit `KERNEL_INTERFACE_BREACH`.

Belege:
- `src/main.js:1`
- `tools/runtime/preflight.mjs:163`

Auswirkung:
- `npm run preflight` rot
- `npm test` rot
- Architektur "genau ein Kernel-Entry" derzeit nicht eingehalten

Status:
- harter Blocker

### P0: Gueltiger Kernel-Run scheitert im Fingerprint

Befund:
- Ein `run` mit gueltigem `seedHash` scheitert waehrend der MUT-Fingerprint-Erzeugung.
- Ursache ist die Reihenfolge in `stableStringifyInternal()`: `!isPlainObject(value)` wird vor `Array.isArray(value)` ausgewertet.

Belege:
- `src/kernel/fingerprint.js:74`
- `src/kernel/fingerprint.js:80`
- `src/kernel/deterministicKernel.js:64`

Auswirkung:
- Deterministischer Erfolgs-Run nicht funktionsfaehig
- Kernversprechen des Projekts derzeit nicht erfuellt

Status:
- harter Blocker

### P1: Dokumentationskonflikt zum Seed-Hash-Vertrag

Befund:
- `docs/SCOPE.md` spricht von optionalem Hash-Vergleich.
- README, Kernel-Spec und Tests verlangen inzwischen zwingenden Seed-Abgleich.

Belege:
- `docs/SCOPE.md:10`
- `docs/KERNEL_SPEC.md:10`
- `docs/TESTING.md:30`
- `README.md:24`

Auswirkung:
- Architektur ist nicht voll dokumentationskonsistent
- QA- und Nutzererwartung koennen auseinanderlaufen

Status:
- mittlerer Blocker fuer Doku-Freigabe

### P2: `updateTraceLock.mjs` erzeugt nondeterministische Metadaten

Befund:
- `generatedAt` wird mit `new Date().toISOString()` geschrieben.

Beleg:
- `tools/runtime/updateTraceLock.mjs:34`

Auswirkung:
- Kein unmittelbarer Kernel-Blocker.
- Fuer voll reproduzierbare Doku-Artefakte ist das ein Rest-Risiko, auch wenn die eigentlichen File-Hashes deterministisch bleiben.

Status:
- niedriges Risiko

## 4) Klare Freigabe oder Block

Freigabe: NEIN

Block:
- formal blockiert

Begruendung:
1. Der zentrale Architekturvertrag "nur ein App-Kernel-Entry" ist aktuell im App-Code verletzt.
2. Der Kernel kann seinen Hauptpfad `run` derzeit nicht erfolgreich zu Ende fuehren.
3. `MainTest` ist dadurch nicht gruen und das Projekt ist nicht in einem freigabefaehigen Zustand.

## Was aktuell trotzdem tragfaehig wirkt

- Patch-Dispatcher-Gate
- Seed-Guard als Fail-Closed-Mechanismus
- Preflight als Architektur- und Doku-Guard
- MainTest-Modulstruktur als Test-Architektur

## Zwingend vor einer Freigabe zu bestaetigen

1. Soll `src/main.js` den Seed-Hash selbst berechnen duerfen oder muss auch das ueber `src/kernel/interface.js` laufen?
2. Ist `docs/SCOPE.md` veraltet oder soll der Hash-Vergleich doch optional bleiben?
3. Sollen Trace-Lock-Artefakte voll reproduzierbar sein oder ist `generatedAt` bewusst nur Metadatum?

## Empfohlene Reihenfolge zur Entblockung

1. Interface-Bruch beseitigen: `src/main.js` darf keine internen Kernel-Dateien direkt importieren.
2. `src/kernel/fingerprint.js` reparieren, so dass Arrays korrekt serialisiert werden.
3. Danach `npm run preflight` und `npm test` erneut gruen ziehen.
4. Anschliessend `docs/SCOPE.md` auf den tatsaechlichen Seed-Guard-Vertrag synchronisieren.

