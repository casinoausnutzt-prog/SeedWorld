# GO / NO-GO Plan fuer SeedWorld

Stand: 2026-03-25

## Kurzfazit

Die Dokumentations- und Traceability-Infrastruktur ist operativ konsistent genug, um weiterzuarbeiten:
- `npm run preflight` ist aktuell gruen.
- `npm test` ist aktuell gruen.
- Der Kernel-Vertrag, die Test-Policy und die Traceability-Anker greifen zusammen.

Es gibt aber noch dokumentarische Drift:
- `docs/SCOPE.md` beschreibt den Seed-Hash-Vergleich noch als Teil der Anforderung, waehrend die anderen Leitdokumente den Hash-Abgleich bereits als zwingend behandeln.
- `docs/QA_ARCHITECTURE_AUDIT.md` ist ein historischer Blocker-Stand und widerspricht dem aktuellen gruenen Runtime-/Test-Zustand.
- Die Startanweisung in `docs/SCOPE.md` ist weniger praezise als der tatsaechliche Startweg ueber `npm start`.

## Autoritative Regeln

Diese Dokumente sind inhaltlich massgeblich:
- `README.md`
- `docs/KERNEL_SPEC.md`
- `docs/TESTING.md`
- `docs/TRACEABILITY.json`

Diese Doku ist aktuell nur referenzierend bzw. historisch:
- `docs/SCOPE.md`
- `docs/QA_ARCHITECTURE_AUDIT.md`

## Priorisierter Doku-Hardening-Plan

### P0 - Seed-Hash-Vertrag konsolidieren

Ziel:
- Alle Doku-Dateien sollen denselben Vertragsstand zum Seed-Hash zeigen.

Umfang:
- `README.md`
- `docs/SCOPE.md`
- `docs/KERNEL_SPEC.md`
- `docs/TESTING.md`

Definition of Done:
- Keine Datei beschreibt den Seed-Hash-Abgleich als optional.
- Der Begriff `seedHash` wird einheitlich als zwingender Teil des Kernel-Run-Vertrags beschrieben.
- Die Formulierung in README, Scope, Kernel-Spec und Testing ist semantisch identisch.
- `npm run preflight` und `npm test` bleiben gruen.

### P0 - QA-Audit auf aktuellen Stand bringen

Ziel:
- Der Audit-Text darf den aktuellen Zustand nicht als blockiert darstellen, wenn die Checks gruen sind.

Umfang:
- `docs/QA_ARCHITECTURE_AUDIT.md`

Definition of Done:
- Status und Ergebnisabschnitte spiegeln den aktuellen Zustand wider.
- Keine Passage behauptet mehr, dass `npm run preflight` oder `npm test` derzeit failen.
- Historische Befunde sind klar als historisch oder ersetzt markiert.

### P1 - Start- und Betriebsanleitung vereinheitlichen

Ziel:
- Es soll nur einen kanonischen Startpfad geben, der alle Preconditions korrekt abbildet.

Umfang:
- `README.md`
- `docs/SCOPE.md`

Definition of Done:
- Der offizielle Startweg ist eindeutig als `npm start` beschrieben.
- Falls `python3 -m http.server 8080` erwaehnt wird, ist klar, dass es nur der Server-Schritt nach Preflight ist.
- Es gibt keinen Konflikt zwischen "lokaler Start" und "Runtime-Preflight".

### P1 - Traceability-Text gegen Metadaten absichern

Ziel:
- Die Traceability-Doku soll klar zwischen deterministischen Hashes und nicht-deterministischen Metadaten unterscheiden.

Umfang:
- `docs/TRACEABILITY.json`
- `docs/trace-lock.json`
- `docs/KERNEL_SPEC.md`

Definition of Done:
- Die Funktion von `generatedAt` ist dokumentiert.
- Es ist klar beschrieben, dass nur die File-Hashes fuer Sync-Checks massgeblich sind.
- Keine Doku suggeriert, dass `generatedAt` Teil des funktionalen Vertrages ist.

### P2 - Doku-Review als Pflichtschritt operationalisieren

Ziel:
- Doku-Aenderungen sollen nicht nur inhaltlich, sondern auch prozessual abgesichert werden.

Umfang:
- `docs/TESTING.md`
- `README.md`

Definition of Done:
- Der empfohlene Arbeitsablauf fuer Doku-Aenderungen ist explizit beschrieben.
- Bei Aenderungen an verankerten Dokumenten werden die erwarteten Checks genannt.
- Neue Teammitglieder koennen ohne Zusatzwissen erkennen, welche Datei den Vertrag fuehrt und welche nur Referenzstatus hat.

## Go / No-Go Kriterien

### GO fuer Doku-Arbeit

GO, wenn:
- `README.md`, `docs/KERNEL_SPEC.md` und `docs/TESTING.md` denselben Vertragsstand abbilden.
- `docs/SCOPE.md` keinen Gegenvertrag mehr enthaelt.
- `docs/QA_ARCHITECTURE_AUDIT.md` nicht mehr den aktuellen Zustand faelschlich als blockiert beschreibt.
- `npm run preflight` gruen bleibt.
- `npm test` gruen bleibt.

### NO-GO fuer Freigabe

NO-GO, wenn:
- irgendein Leitdokument den Seed-Hash-Vertrag als optional beschreibt.
- der QA-Audit den aktuellen gruenen Zustand nicht widerspiegelt.
- Start- oder Testanleitung mehr als einen kanonischen Ablauf impliziert.
- Preflight oder MainTest rot werden.

## Empfohlene Reihenfolge

1. Seed-Hash-Vertrag in allen Leitdokumenten synchronisieren.
2. QA-Audit auf aktuellen Stand bringen oder als historische Momentaufnahme kennzeichnen.
3. Startanleitung konsolidieren.
4. Traceability-Metadaten sauber von funktionalen Regeln trennen.
5. Danach den Doku-Workflow im Testing-Abschnitt verankern.
