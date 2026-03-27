# BLUEPRINT: Mechanics

Stand: 2026-03-25

Dieses Dokument ist die finale Mechanik-Blaupause fuer SeedWorld.

Scope-Regel:
- Enthalten sind nur Mechanics-Domaenen, ihre State-Vertraege, ihre Action- und Patch-Gates, ihre Resolution-Logik, ihre Tests und ihre technische Machbarkeit.
- Ausgeschlossen sind UI-Layout, visuelle Komposition, Navigation, Styling, Animation und andere UX- oder Frontend-Entwurfsfragen.

Referenzrahmen:
- [docs/MECHANICS_PLAN.md](/root/SeedWorld/docs/MECHANICS_PLAN.md)
- [docs/GAME_MASTER_PLAN.md](/root/SeedWorld/docs/GAME_MASTER_PLAN.md)

## 1) Ziel der Mechanics-Blaupause

Mechanics muss ein rundenbasiertes Wirtschafts- und Expansionssystem liefern, das:

- seed-deterministisch ist
- dispatch-only arbeitet
- Domain-Gates strikt einhaelt
- pro Runde reproduzierbare Resultate erzeugt
- ohne Hintergrundsimulation auskommt
- mit dem bestehenden Kernel- und Gate-System umsetzbar bleibt

Die Mechanik wird nicht als Echtzeit-System gedacht, sondern als phasenweiser Resolve-Loop mit klaren Ursachen, pruefbaren Zwischenzustanden und auditierbaren Ergebnissen.

## 2) Exklusiver Mechanics-Scope

### In Scope

- Rundensystem
- Produktionslogik
- Forschungslogik
- Logistiklogik
- Fraktionslogik
- Eventlogik
- Mechanik-Audit und Replay-Fingerprint
- Action- und Patch-Vertragsmodell fuer Mechanics
- Deterministische Resolve-Reihenfolge
- Domain-gekoppelte State-Mutationen

### Out of Scope

- Layout und Platzierung von Karten, Panels oder HUD
- mobile Bedienung als visuelles Problem
- typografische, farbliche oder motion-bezogene Entscheidungen
- Copywriting fuer Buttons, Labels oder Tooltips
- Hintergrundanimationen oder visuelle Forecasts

### UI/UX-Konfliktregel

Wenn eine Mechanics-Anforderung eine UI/UX-Flaeche oder einen visuellen Kompositionsentscheid erzwingt, dann ist sie in dieser Form zu breit.

Rescope-Vorschlag:
- Mechanics liefert nur `state`, `delta`, `phase`, `reason` und `resolution`.
- UI/UX entscheidet anschliessend, wie das in einem Mode Stack dargestellt wird.
- Wenn ein Mechanik-Feature nur funktioniert, wenn Karte, Produktion und Runde gleichzeitig dauerhaft sichtbar sind, ist das Feature fuer v1 zu gross und muss in eine turn-basierte Summary plus Drill-down zerlegt werden.

## 3) Mechanics-Domain-Modell

Mechanics arbeitet auf einem kanonischen State-Atlas mit folgenden Domaenen:

- `round`
- `economy`
- `production`
- `logistics`
- `research`
- `factions`
- `events`
- `audit`

### Kanonischer State-Schnitt

```json
{
  "round": {
    "index": 1,
    "phase": "plan",
    "locked": false,
    "seedHash": "",
    "commandLog": [],
    "resolveLog": []
  },
  "economy": {
    "resources": {},
    "stockpiles": {},
    "balance": 0
  },
  "production": {
    "facilities": [],
    "recipes": [],
    "queues": []
  },
  "logistics": {
    "nodes": [],
    "edges": [],
    "routes": [],
    "capacity": {}
  },
  "research": {
    "techTree": {},
    "queue": [],
    "unlocks": []
  },
  "factions": {
    "entities": [],
    "relations": {},
    "policies": {},
    "territory": {}
  },
  "events": {
    "deck": [],
    "triggers": [],
    "queue": [],
    "log": []
  },
  "audit": {
    "mutFingerprint": "",
    "turnFingerprint": "",
    "lastResolvedAt": 0
  }
}
```

### Domain-Regeln

- Jede Domain besitzt einen eigenen, eindeutigen Verantwortungsbereich.
- Cross-Domain-Effekte sind erlaubt, aber nur als explizite Folge von mehreren Domain-Dispatches.
- Keine Domain darf indirekt in eine andere Domain hineinpatchen.
- Keine Mechanics-Domain darf Root-Container-Replacements ausloesen.

## 4) Kernmechanik: Round-Resolve-Loop

Der Mechanics-Core ist ein deterministischer Runden- und Phasen-Resolver.

### Phasenfolge

1. `plan`
2. `lock`
3. `resolve`
4. `upkeep`
5. `reveal`
6. `next`

### Semantik

- `plan`: Eingaben sammeln
- `lock`: Eingaben einfrieren
- `resolve`: Fachlogik in stabiler Reihenfolge ausfuehren
- `upkeep`: Unterhalt, Verbrauch, Kosten und Folgewirkungen berechnen
- `reveal`: Ergebnis- und Delta-Log erzeugen
- `next`: naechste Runde vorbereiten

### Determinismus-Regel

- Gleicher Seed, gleicher Input-Log und gleiche Domain-Konfiguration muessen denselben Turn-Fingerprint erzeugen.
- Die Resolve-Reihenfolge muss explizit sortiert und testbar sein.
- Keine Arbeitsschleife darf von Objekt-Enumerationsreihenfolge, wallclock oder hidden state abhaengen.

### Mechanik-Ausgabe

Jeder Resolve liefert drei Arten von Output:

- `resultState`
- `domainDeltas`
- `auditTrail`

## 5) Fachliche Mechanics-Module

### 5.1 Produktion

Produktion transformiert Inputs in Outputs pro Runde.

Regeln:
- Produktionsketten sind aggregiert, nicht physisch simuliert.
- Produktionskapazitaet, Verbrauch und Ueberlauf sind Ledger-Werte.
- Produktionsboni duerfen nur ueber definierte Unlocks, Policies oder Facility-States entstehen.

Nicht erlaubt:
- kontinuierliche Echtzeit-Fluesse
- implizite Nebenberechnungen im UI
- ungepruefte Multiplikatoren ohne Domain-Autorisierung

### 5.2 Forschung

Forschung schaltet neue Systeme, Rezepte, Policies oder Kapazitaeten frei.

Regeln:
- Forschungspunkte sind rundenbasiert
- Forschung laeuft in Queue- oder Slot-Form
- Unlocks wirken erst nach einem validen Resolve
- Rueckbau ist nur erlaubt, wenn die Spielregel ihn explizit vorsieht

### 5.3 Logistik

Logistik ist ein Graph-Ledger mit Kapazitaeten, Kanten und Prioritaeten.

Regeln:
- Pfadauswahl und Lastverteilung muessen deterministisch sein
- Tie-Breaks sind stabil und logisch, nie zufaellig
- Transport ist rundenbasiert und kapazitiert
- keine physische Belt-Simulation fuer v1

### 5.4 Fraktionen

Fraktionen liefern Politik, Reibung und asymmetrische Effekte.

Regeln:
- Fraktionswerte, Loyalitaet und Beziehungen sind seed-deterministisch
- Policies sind explizite Actions
- Fraktionswechsel, Krieg und Frieden sind sichtbare Resolve-Ereignisse

### 5.5 Events

Events sind deterministische Reaktions- und Spannungsgeber.

Regeln:
- Events kommen aus einem determinierten Trigger- oder Deck-Modell
- Jedes Event muss Ursache und Effekt dokumentieren
- Events patchen nur ihre Domain

### 5.6 Audit

Audit macht Mechanik reproduzierbar und pruefbar.

Regeln:
- jeder Turn erzeugt einen Fingerprint
- jede Resolve-Phase erzeugt nachvollziehbare Deltas
- jedes Domain-Update wird im Log referenzierbar

## 6) Harte API- und Gate-Integrationspunkte

Diese Integrationen sind fuer die Mechanics-Blaupause verbindlich.

### 6.1 Kernel Entry

Pflicht:
- alle Mechanics-Commands laufen durch `src/kernel/interface.js`
- keine direkten Imports auf interne Kernel-Dateien ausserhalb der Interface-Schnittstelle fuer App-Use-Cases

Aktuelle, bereits vorhandene Integration:
- `executeKernelCommand("run", ...)`
- `executeKernelCommand("seed.hash", ...)`
- `executeKernelCommand("governance.llm-chain", ...)`
- `executeKernelCommand("patch.plan", ...)`
- `executeKernelCommand("patch.apply", ...)`
- `executeKernelCommand("patch.state", ...)`

### 6.2 Store-Gate

Pflicht:
- `src/kernel/store/createStore.js` bleibt der dispatch-only Eintritt fuer Mechanics-States
- `guardDeterminism` darf nicht deaktiviert werden
- Actions muessen dem Action-Schema entsprechen

Mechanics-Nutzung:
- jede Turn-Aktion wird als validated Action verarbeitet
- der Reducer bleibt pure
- SimSteps duerfen nur gefrorene Inputs lesen

### 6.3 Patch-Gate

Pflicht:
- `src/kernel/store/applyPatches.js` erzwingt mutationMatrix, Domain-Gate und Sanitization
- Root-Container-Replacements bleiben blockiert

Mechanics-Nutzung:
- jede Domain mutiert nur innerhalb ihrer Pfade
- Cross-Domain-Effects erfolgen als explizite Folgepatches
- nichts darf an `__proto__`, `constructor` oder `prototype` vorbeipatchen

### 6.4 LLM Governance Chain

Pflicht:
- `src/kernel/llmGovernance.js` bleibt die harte Vorpruefung fuer patch- und action-nahe Mechanik-Operationen

Mechanics-Nutzung:
- Action-Schema -> Mutation-Matrix -> Domain-Patch-Gate -> Determinism-Guard -> Sanitization
- jede Mechanik-Automation, die Patch-Paete erzeugt, muss diese Kette passieren

### 6.5 Seed Guard und Fingerprint

Pflicht:
- `src/kernel/seedGuard.js` und `src/kernel/fingerprint.js` sichern Reproduzierbarkeit und Auditierbarkeit

Mechanics-Nutzung:
- jeder Turn-Resolve ist seed-gebunden
- jeder simulierte Endzustand wird per Fingerprint auditierbar

### 6.6 Traceability

Pflicht:
- neue Mechanics-Funktionen muessen in `docs/FUNCTION_SOT.json` und bei Bedarf `docs/trace-lock.json` synchronisiert werden

Mechanics-Nutzung:
- jede neue Domain-Funktion ist tracebar
- jeder neue Gate-Adapter ist im SoT sichtbar

## 7) Empfohlene Mechanics-Commands

Diese Commands sind die fachliche Zieloberflaeche fuer Mechanics. Sie sind keine UI-Befehle und auch keine Layout-APIs.

### Must-have Commands

- `mechanics.turn.preview`
- `mechanics.turn.commit`
- `mechanics.turn.resolve`
- `mechanics.turn.audit`

### Domain Commands

- `mechanics.production.simulate`
- `mechanics.research.advance`
- `mechanics.logistics.route`
- `mechanics.factions.resolve`
- `mechanics.events.draw`

### Command-Regeln

- Commands liefern nur fachliche Daten, keine Darstellungsvorgaben
- jeder Command ist domain-scoped
- jeder Command muss seed- und state-gebunden sein
- kein Command darf UI-Komposition erzwingen

### Integrationshinweis

Wenn diese Commands in der aktuellen Interface-Schnittstelle noch nicht existieren, sind sie als Phase-2/Phase-3-Erweiterung der Kernel-Schnittstelle zu behandeln. Der Mechanik-Blueprint bleibt trotzdem gueltig, weil er den fachlichen Zielvertrag beschreibt und nicht die fertige Implementierung behauptet.

## 8) Implementierungsphasen

### Phase 0: Mechanics Contract Freeze

Ziel:
- State-Atlas, Domains, Commands und Gate-Regeln fixieren

Akzeptanztests:
- jede Mechanics-Domain ist im State-Atlas vorhanden
- jede Domain hat mindestens einen erlaubten Patch-Pfad
- jede neue Action wird gegen Schema validiert
- Cross-Domain-Patches ohne explizite Domain-Trennung werden geblockt

### Phase 1: Deterministic Round Kernel

Ziel:
- der Turn-Resolve-Loop laeuft reproduzierbar

Akzeptanztests:
- gleicher Seed + gleiche Action-Folge -> gleicher Fingerprint
- unterschiedliche Seeds -> unterschiedliche Fingerprints
- ungeordnete Inputs erzeugen trotzdem stabile Resolve-Reihenfolge

### Phase 2: Production and Logistics Core

Ziel:
- Produktions- und Logistikwerte werden als rundenbasierte Ledger modelliert

Akzeptanztests:
- Produktionsoutput ist aus Inputs und Regeln ableitbar
- Kapazitaetsgrenzen blockieren Ueberlauf deterministisch
- Logistik-Tie-Breaks sind stabil
- keine physische Echtzeit-Simulation ist notwendig

### Phase 3: Research and Factions Core

Ziel:
- Fortschritt und Politik liefern langfristige Mechanik

Akzeptanztests:
- Research-Queues steigen nur durch valide Resolve-Schritte
- Unlocks wirken erst nach Commit/Resolve
- Fraktionswerte sind seed-deterministisch
- Policies fuehren nur zu erlaubten Domain-Patches

### Phase 4: Events and Audit Core

Ziel:
- Ereignisse, Reaktionslog und Fingerprints sind voll pruefbar

Akzeptanztests:
- Event-Auswahl ist reproduzierbar
- jedes Event hat Ursache und Effekt
- jedes Turn-Ergebnis erzeugt Audit-Daten
- gleiche Eingaben erzeugen identische Audit-Daten

### Phase 5: Hardening and Regression Lock

Ziel:
- Mechanics bleibt stabil gegen Regressionen und Scope-Drift

Akzeptanztests:
- invalid action schema wird geblockt
- invalid mutationMatrix path wird geblockt
- root replacement wird geblockt
- direct domain mixing wird geblockt
- determinism guard bleibt aktiv

## 9) Konkrete Akzeptanztests

Diese Tests sind als Module unter `tests/modules/*.module.mjs` sinnvoll umsetzbar.

### A. Determinism Test

Given:
- gleicher Seed
- gleiche Commands
- gleiche Domain-Konfiguration

When:
- Turn-Resolve wird zweimal ausgefuehrt

Then:
- gleiche States
- gleicher Turn-Fingerprint
- gleicher MUT-Fingerprint

### B. Domain Gate Test

Given:
- Produktionspatch mit Research-Pfad

When:
- Patch wird angewendet

Then:
- Blockierung durch mutationMatrix oder Domain-Gate

### C. Dispatch-Only Test

Given:
- Mechanics-State mit frozen Input

When:
- Reducer oder SimStep versucht Input zu mutieren

Then:
- Runtime bleibt fail-closed oder das Testmodul erkennt den Verstoss

### D. Seed Guard Test

Given:
- Run ohne validen seedHash

When:
- Kernel-Run wird gestartet

Then:
- Fail closed ueber `SEED_GUARD`

### E. Patch Conflict Test

Given:
- Patch mit Root-Replacement, Prototype-Pfad oder ungultigem Domain-Pfad

When:
- Patch-Apply laeuft

Then:
- Patch wird blockiert

### F. Round-Ordering Test

Given:
- mehrere Actions mit gleicher Prioritaet

When:
- Resolve erfolgt

Then:
- deterministische, explizit definierte Reihenfolge

### G. Replay Test

Given:
- gespeicherter Turn-Log

When:
- Replay wird gestartet

Then:
- alle Domain-Deltas und Fingerprints stimmen mit dem Original ueberein

## 10) Machbarkeitsbeleg

Die Mechanics-Blaupause ist technisch innerhalb der aktuellen Grenzen machbar.

### Beleg 1: Single Entry ist bereits vorhanden

`src/kernel/interface.js` ist bereits der einzige App-Entry in den Kernel. Das bedeutet:
- Mechanics kann als neue Command-Sicht auf denselben Entry aufgesetzt werden
- es braucht kein paralleles API-Backdoor-System

### Beleg 2: Dispatch-only und Domain-Gates sind bereits implementiert

`src/kernel/store/createStore.js` und `src/kernel/store/applyPatches.js` erzwingen:
- Action-Schema
- dispatch-only State-Mutationen
- mutationMatrix
- Domain-Gate
- Sanitization
- Root-Block

Das ist genau die Struktur, die eine turnbasierte Mechanics-Schicht braucht.

### Beleg 3: Determinismus ist bereits Kernvertrag

`src/kernel/deterministicKernel.js`, `src/kernel/seedGuard.js` und `src/kernel/fingerprint.js` liefern:
- seed-deterministische Ausfuehrung
- zwingenden Seed-Hash-Abgleich
- auditable Fingerprints

Damit ist ein reproduzierbarer Mechanics-Resolve-Loop fachlich und technisch tragfaehig.

### Beleg 4: Governance-Kette ist bereits vorhanden

`src/kernel/llmGovernance.js` sichert die Integritaet von Action-, Patch- und Determinismus-Verarbeitung.

Das heisst:
- Mechanics-Operationen koennen dieselbe harte Pruefkette nutzen
- es ist kein separates Sicherheitsmodell erforderlich

### Beleg 5: Das Design vermeidet die unmachbaren Teile

Nicht versucht wird:
- Echtzeit-Belt-Simulation
- permanentes Multi-Panel-Background-Reasoning
- verdeckte Frontend-Simulation
- unbounded agentic planning ohne Gate-Kontrolle

Stattdessen wird verwendet:
- Round-Ledger
- aggregierte Produktion
- deterministische Logistik
- explizite Research- und Event-Queues
- fraktionsbezogene Policies

Das passt zu den vorhandenen Grenzen und ist testbar.

## 11) Konflikte mit UI/UX und vorgeschlagene Rescopes

### Konflikt 1: Mechanik fordert parallele Vollsicht

Problem:
- Ein Mechanik-Feature braucht gleichzeitig Karte, Produktion und Runde voll sichtbar.

Warum kritisch:
- verletzt Mode Stack B
- erhoeht kognitive Last
- erzeugt unnoetige Abhaengigkeit von UI-Komposition

Rescope:
- Mechanik liefert eine Round-Summary und ein Detail-Drilldown
- die UI entscheidet, welcher Mode aktiv ist

### Konflikt 2: Mechanik braucht Hintergrundsimulation

Problem:
- ein System will zwischen zwei Benutzereingaben weiterlaufen

Warum kritisch:
- widerspricht turn-first
- widerspricht no background load
- reduziert Determinismus-Lesbarkeit

Rescope:
- alles als Round-Resolve modellieren
- Zwischenfortschritt nur als kanonische Preview oder Logik-Queue

### Konflikt 3: Mechanik braucht visuelle Forecasts

Problem:
- ein Feature setzt voraus, dass die UI die Zukunft permanent vorzeichnet

Warum kritisch:
- UI/UX-Scope
- nicht Mechanics-Scope
- droht in Darstellungslogik zu kippen

Rescope:
- Mechanics produziert nur berechenbare Forecast-Daten
- Rendering und Interaktion bleiben UI

### Konflikt 4: Mechanik braucht freie Cross-Domain-Patches

Problem:
- ein Effekt will gleichzeitig Economy, Research und Factions mutieren

Warum kritisch:
- bricht Domain-Gates
- erschwert Tests

Rescope:
- in getrennte Domain-Dispatches zerlegen
- nur explizit gekoppelte Folgeaktionen erlauben

## 12) Schlussfolgerung

Die Mechanik-Blaupause ist mit dem aktuellen SeedWorld-Kernel realistisch umsetzbar, wenn sie als:

- rundenbasierter Ledger
- domain-strikt getrennte Resolve-Schicht
- dispatch-only State-Maschine
- seed-deterministischer Audit-Loop

gebaut wird.

Der kritische Pfad fuer v1 ist nicht "mehr Simulation", sondern "mehr klare, pruefbare Ursache-Wirkung innerhalb der vorhandenen Gates".
