# UX Blueprint

Stand: 2026-03-25
Projekt: SeedWorld
Zweck: exklusive UX-Blaupause fuer Onboarding, Flow, Accessibility und Feedback-Language in einem mobile-first, rundenbasierten Spiel.

## Scopevorschlag

Neuer, exklusiver Scope fuer diese Blaupause:

- UX = Session- und Interaktionsvertrag
- Inhalt: Onboarding, Turn-Flow, Accessibility, Feedback-Language
- Ziel: der Spieler versteht, wann er entscheidet, wann das System resolved und wie Rueckmeldungen zu lesen sind

Dieser Scope ist absichtlich schmal:

- keine Layout-Definition
- keine Screen-Hierarchie
- keine Mechanik-Balance
- keine Resolve-Reihenfolge
- keine Domain-Erweiterung

Wenn ein Punkt Layout, Phase oder Regelordnung beruehrt, gehoert er nicht mehr in UX, sondern in UI oder Mechanics.

## Kausale Grenzen

### Gegen UI

Die UI definiert, wo Dinge sichtbar sind und wie sie sich auf dem Screen anordnen.
Die UX definiert, wie der Nutzer die Interaktion versteht.

Klare Trennung:

- UI = visuelle Komposition, Navigation, Komponenten, Responsiveness
- UX = Bedeutung, Reihenfolge, Lesbarkeit, Fehlererkennung, Erwartungssteuerung

UX darf daher nicht:

- Panels vorschreiben
- Breakpoints definieren
- visuelle Hierarchien als Wahrheit setzen
- die Renderlogik der UI umgehen

### Gegen Mechanics

Die Mechanics definieren, was im Spiel wahr ist.
Die UX definiert, wie der Spieler diese Wahrheit sicher und ohne Fehlinterpretation erlebt.

Klare Trennung:

- Mechanics = Phasen, Regeln, Ressourcen, Resolve, Balancing
- UX = Eingabelogik, Feedback, Fehlermeldungen, Lernkurve, Accessibility

UX darf daher nicht:

- Round-Fingerprints neu erfinden
- Resolve-Reihenfolgen vorschreiben
- Regeln in Copy verstecken
- Mechaniken in ein Tutorial umdeuten

## Finale UX-Entscheidung

Entscheidung: Flow B ist die Baseline.

Begruendung:

- ein dominanter Kontext pro Moment
- klarer Turn-Rhythmus statt Dauerrauschen
- mobile Bedienung mit kleiner kognitiver Last
- weniger Fehlklicks und bessere Entscheidungsdisziplin
- kompatibel mit Phasen- und Lock-Logik der Mechanics

Flow A bleibt nur als spaetere, groessere Uebersichtsform denkbar.
Flow A ist nicht die Default-Bedienlogik.

## UX Blueprint

### 1) Onboarding

Ziel:

- den ersten Turn ohne Pflichttutorial verstaendlich machen
- den Spieler schnell von "Was ist das?" zu "Ich kann eine sinnvolle Entscheidung treffen" fuehren

Vertrag:

1. Start mit einem einzigen klaren Zielbild.
2. Erste Runde mit reduzierter, aber echter Entscheidung.
3. Nach der ersten Eingabe ein kurzes Resultat mit Ursache und Wirkung.
4. Hilfe nur auf Wunsch, nicht als Zwangspfad.

Regeln:

- kein Tutorial-Stapel
- keine Mehrschirm-Einfuehrung
- keine Erklärung, die fuer die erste Runde groesser ist als die erste Runde selbst
- erste Erfolge muessen ohne Vorkenntnis moeglich sein

### 2) Turn-Flow

Ziel:

- jede Runde als abgeschlossenen, wiedererkennbaren Rhythmus erlebbar machen

Vertrag:

Observe -> Decide -> Confirm -> Resolve -> Report

Semantik:

- Observe: Zustand lesen
- Decide: eine Aktion waehlen
- Confirm: Eingabe absichern
- Resolve: System verarbeitet die Runde
- Report: Ergebnis und Konsequenz anzeigen

Regeln:

- Eingabe und Ergebnis werden sichtbar getrennt
- Confirm ist nicht Resolve
- Report ist nicht neue Eingabe
- der Flow darf nicht implizit im Hintergrund weiterlaufen

### 3) Accessibility

Ziel:

- mobile Nutzung auch unter Limitierungen stabil halten

Vertrag:

- grosse Touch-Ziele
- hoher Kontrast
- keine Farbsemantik ohne Form- oder Textabsicherung
- skalierbarer Text
- reduzierte Bewegung als Option
- screenreader-freundliche Kernaktionen und Statusmeldungen

Regeln:

- eine Aktion muss per Finger erreichbar sein
- eine Fehlermeldung muss ohne Farbsehen verstandlich bleiben
- Accessibility ist Teil des Default-Flows, nicht ein Zusatzmodus

### 4) Feedback-Language

Ziel:

- Meldungen muessen Ursache, Zustand und naechste sinnvolle Handlung benennen

Vertrag:

- Feedback ist kurz
- Feedback ist eindeutig
- Feedback ist wiederholbar
- Feedback trennt "warum", "was" und "was jetzt"

Muster fuer Meldungen:

- Status: was ist passiert
- Ursache: warum ist es passiert
- Naechster Schritt: was kann der Spieler jetzt tun

Beispielstruktur:

- "Nicht moeglich: 3 Rohstoffe fehlen."
- "Grund: die Aktion ist in dieser Phase gesperrt."
- "Naechster Schritt: erst bestaetigen, dann waehlen."

Regeln:

- keine vagen Floskeln
- keine versteckte Regel in der Copy
- keine Fehlermeldung ohne Handlungsalternative, wenn eine Alternative existiert

## Technische Belege

Diese Blaupause wird durch Kernel- und Testvertraege abgesichert, nicht nur durch Text.

### Kernel-Vertraege

- `src/kernel/interface.js`
  - ein einziger, expliziter Kernel-Entrypoint
  - `run`, `seed.hash`, `patch.plan`, `patch.apply`, `patch.state` und Governance-Zugriffe laufen ueber dieselbe Schnittstelle
  - die UI bleibt damit dispatch- und command-basiert statt direkt am Kernel zu schreiben

- `src/kernel/store/createStore.js`
  - Action-Schema-Pruefung
  - Domain-Pflicht fuer Dispatch
  - Determinismus-Guards bleiben aktiv
  - State wird tief gefroren, damit UI oder UX keine verdeckte Mutation erzeugen

- `src/kernel/store/applyPatches.js`
  - Patch-Domain muss zur Dispatch-Domain passen
  - nur erlaubte Pfade aus der Mutation-Matrix sind gueltig
  - Root-Replacement ist verboten
  - Sanitization blockiert Prototype- und Unsafe-Keys

- `src/kernel/runtimeGuards.js`
  - blockiert nicht-deterministische APIs wie `Date.now()` und `Math.random()`
  - verhindert, dass UX-Feedback oder Test-Setup verdeckte Zeit-/Zufallslogik einzieht

### Test-Vertraege

- `tests/MainTest.mjs`
  - fuehrt alle Testmodule in fester Reihenfolge aus
  - arbeitet mit Deadman-Snapshot und bricht bei Drift

- `tests/modules/00.mandatory.module.mjs`
  - prueft Preflight
  - prueft Determinismus
  - prueft Blockade von `Date.now()` und `Math.random()`

- `tests/modules/02.kernel-interface.module.mjs`
  - blockiert direkten Kernel-Import
  - erzwingt die Nutzung des Single-Interface-Entrypoints

- `tests/modules/03.patch-dispatcher-gate.module.mjs`
  - erzwingt Confirmation fuer riskante Patches
  - prueft Konflikt- und Planungsgaenge im Dispatch-Flow

- `tests/modules/05.preflight-doc-anchor.module.mjs`
  - blockiert fehlende Doku-Anchor
  - verhindert, dass UX- oder Planungsdoku stillschweigend driftet

- `tests/modules/07.function-sot-sync.module.mjs`
  - erzwingt Sync zwischen Code und Function-SoT
  - stellt sicher, dass der Doku- und Funktionsstand synchron bleibt

- `tests/modules/09.store-and-governance-gates.module.mjs`
  - prueft Domain-Gates
  - prueft Patch-Pfade
  - prueft Sanitization und Governance-Chain

### Operative Sicherung

- `tools/runtime/preflight.mjs`
  - validiert Doku-Anchor
  - validiert Function-SoT
  - validiert Code-Anchor und Mut-Points
  - blockiert verbotene Kernel-Importpfade in der UI-/App-Oberflaeche

Diese Kette ist die technische Grenze fuer UX:

- UX kann Sprache und Flow definieren
- UI kann Darstellung definieren
- Mechanics kann Regeln definieren
- der Kernel verhindert, dass diese Ebenen sich unbemerkt vermischen

## Nicht im Scope

Explizit nicht in dieser Blaupause:

- visuelles Layout
- Panel-Positionen
- konkrete Komponentenstruktur
- Mechanik-Balance
- Action-Schema-Erweiterungen
- neue Domain-Pfade
- neue Sim-Regeln

Wenn einer dieser Punkte benoetigt wird, muss der Scope gewechselt werden.

## Neuer Scope, falls Abgrenzung noetig wird

Falls eine strengere Trennung gegen UI oder Mechanics gewollt ist, lautet der naechste Scopevorschlag:

- `UX Interaction Contract`
- Schwerpunkt nur auf Onboarding, Flow, Accessibility und Feedback-Text
- Layout und Regellogik bleiben vollstaendig ausserhalb

Das ist die sauberste Schnittstelle, wenn die Blaupause spaeter in separate UI- und Mechanics-Arbeitslaeufe geschnitten werden soll.
