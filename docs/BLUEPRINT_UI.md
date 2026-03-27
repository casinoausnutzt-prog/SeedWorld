# UI Blueprint

Stand: 2026-03-25
Projekt: SeedWorld
Status: final blueprint for UI scope

## Zweck

Dieses Dokument ist die kanonische Blaupause fuer die UI-Schicht von SeedWorld.

Es beschreibt:
- den exklusiven UI-Scope
- die Nicht-Ziele
- die Integrationspunkte zum Kernel
- die Machbarkeit gegen existierende Module und Tests
- die Grenze zu Mechanics und Game Master

Es beschreibt nicht:
- neue Mechanikregeln
- neue Game-Master-Logik
- neue Kernel-APIs
- eine Simulation ausserhalb des deterministischen Kernels

## Exklusiver Scope

Die UI ist die einzige Schicht, die der Spieler direkt sieht und bedient.

UI darf:
- Kernel-Commands ausloesen
- Kernel-Status anzeigen
- deterministische Ergebnisdaten visualisieren
- Statuswechsel zwischen Observe, Decide, Confirm, Resolve und Report praesentieren
- mobile-first Bedienung ohne Hover oder Dauerlast abbilden

UI darf nicht:
- Spielregeln selbst berechnen
- Simulationslogik duplizieren
- State direkt mutieren
- Polling- oder Hintergrundsimulation als Ersatz fuer Kernel-Calls verwenden
- neue Domain-Logik einfuehren
- Mechanics- oder Game-Master-Vertraege ueberschreiben

## Nicht-Ziele

Nicht Ziel dieser UI-Blaupause sind:
- eine Echtzeit-Strategie-Oberflaeche
- ein paralleles Mehrfenster-Dashboard als Default
- ein permanenter Render-Loop fuer Logik
- animationstreibende Loesungen, die Kausalitaet verdecken
- ein Desktop-only Layout
- persistente Offline-Saves oder Backend-Sync

## Kanonischer UI-Takt

Der UI-Takt folgt dem gemeinsamen Spielrhythmus:

1. Observe
2. Decide
3. Confirm
4. Resolve
5. Report

Semantik:
- Observe: Zustand, Warnungen, Seed-Integritaet und aktuelle Phase lesen
- Decide: eine Absicht in einem aktiven Modus waehlen
- Confirm: irreversible oder risikobehaftete Eingaben explizit bestaetigen
- Resolve: der Kernel berechnet deterministisch
- Report: Ergebnis, Delta, Konflikt und Folge lesen

Dieser Takt ist nicht nur UX, sondern UI-Layout-Regel:
- nicht jede Phase nutzt dieselbe primare Flaeche
- die Karte ist nicht immer dominant
- Confirm und Resolve sind panel-zentriert
- Observe und Report duerfen mehr Uebersicht zeigen

## UI-Struktur

### HUD

Rolle:
- permanente Orientierung

Enthaelt:
- Seed-Status und Seed-Hash-Abgleich
- Runde
- Phase
- Integritaetsstatus
- knappe Warnwerte

Nicht enthalten:
- Detailtabellen
- lange Listen
- versteckte Berechnungen

### Weltkarte

Rolle:
- strategischer Raum fuer Terrain, Siedlungen, Routen, Besitz und Expansion

Enthaelt:
- Kachel- oder Hex-Layout
- Gebaeude, Knoten, Lanes, Sicht oder Fog-of-War
- Overlays fuer Ressourcen- und Transportfluesse

Regel:
- Karte ist Default im Observe- und Report-Zustand
- waehrend Decide, Confirm und Resolve bleibt sie Kontext, nicht Primar-Panel

### Produktionsansicht

Rolle:
- lesbare Produktionsketten und Bottlenecks

Enthaelt:
- Input -> Output
- Queue
- Durchsatz pro Runde
- Engpaesse
- Vorschau, Commit und Ergebnis als getrennte Lesestufen

Regel:
- keine dauerhafte Vollmatrix
- keine Echtzeit-Transportphysik
- keine verdeckte Zusatzsimulation

### Rundenpanel

Rolle:
- Turn-Logik und Phasensteuerung

Enthaelt:
- aktuelle Phase
- Aktionen
- Confirm-Status
- End-Turn-Trigger
- letzten Resolution-Log

Regel:
- alle kritischen Entscheidungen muessen hier oder im aktiven Turn-Mode bestaetigt werden

## Abgrenzung zu Mechanics

Mechanics ist die Quelle der Spielregeln, nicht die UI.

Mechanics definiert:
- Rundenphasen
- Produktions- und Logistikregeln
- Forschungs- und Fraktionslogik
- deterministische Resolve-Reihenfolge

UI konsumiert diese Regeln nur:
- als Status
- als Preview
- als Ergebnis
- als Bestaetigungsbedarf

Kausale Grenze:
- UI darf nicht aus Anzeigegruenden neue Zustandsannahmen treffen
- UI darf nicht "vorhersagen", was der Kernel noch nicht geliefert hat
- UI darf keinen Mechanik-Shortcut bauen, der den Resolve umgeht

## Abgrenzung zu Game Master

Game Master koordiniert den gemeinsamen Takt und die Prioritaeten zwischen UI, Mechanics und UX.

UI liefert:
- Sichtbarkeit
- Eingabeabbildung
- mobile Bedienbarkeit

Game Master liefert:
- Phase- und Moduszuordnung
- Priorisierungsregeln
- konfliktsichere gemeinsame Benennungen

UI implementiert nicht:
- globale Projektpriorisierung
- domainuebergreifende Regelentscheidungen
- mechanische Freigabeentscheidungen

## Integrationspunkte

### 1) `src/kernel/interface.js`

Dies ist der einzige erlaubte Kernel-Einstieg.

Relevante Commands fuer UI:
- `run`
- `seed.hash`
- `patch.plan`
- `patch.apply`
- `patch.state`
- `korner.manifest`
- `korner.string-matrix`
- `korner.snapshot`
- `governance.llm-chain`

UI-Implikation:
- alle interaktiven Zustandswechsel laufen ueber diesen Entry
- keine Direktimporte aus Kernel-Interna

### 2) `src/kernel/deterministicKernel.js`

Beleg fuer:
- seed-deterministische Runs
- Tick-Beschraenkung
- harte Guard- und Seed-Regeln

UI-Implikation:
- UI zeigt den Run nur an
- UI ersetzt den Kernel nicht
- Preview und Ergebnis muessen dieselbe Determinismus-Quelle nutzen

### 3) `src/kernel/seedGuard.js`

Beleg fuer:
- Fail-closed bei fehlendem oder falschem `seedHash`

UI-Implikation:
- Seed-Status ist ein Pflicht-Statusfeld
- Mismatch ist blockierend und sichtbar

### 4) `src/kernel/patchDispatcher.js`

Beleg fuer:
- `patch.plan`
- `patch.apply`
- Konfliktanalyse
- Confirm-Gate

UI-Implikation:
- riskante Aktionen muessen als Confirm-Flow dargestellt werden
- Konflikte duerfen nicht stillschweigend verschwinden

### 5) `src/kernel/store/createStore.js`

Beleg fuer:
- dispatch-only Mutationen
- Action-Schema
- Freeze
- Determinism-Guard

UI-Implikation:
- UI darf keine direkte Mutation erwarten
- jeder Interaktionspfad endet in dispatch, nie in Objektmutation

### 6) `src/kernel/store/applyPatches.js`

Beleg fuer:
- Domain-Gates
- mutationMatrix
- Sanitization
- Root-Block

UI-Implikation:
- UI muss Domain-wechsel sichtbar machen
- UI darf keine fachfremden Patches implizit mischen

### 7) `src/kernel/llmGovernance.js`

Beleg fuer:
- Governance-Kette von Action-Schema bis Sanitization

UI-Implikation:
- UI zeigt Governance- und Blockadestatus nur als Resultat
- UI leitet daraus kein eigenes Regelwerk ab

### 8) `src/kernel/kornerCore.js`

Beleg fuer:
- Manifest
- Snapshot
- String-Matrix

UI-Implikation:
- Integritaets- und Systemstatus koennen sichtbar gemacht werden
- diese Daten sind Anzeigeobjekte, keine UI-Logikquelle

## Machbarkeitsbeleg gegen Tests und Module

Die UI-Blaupause ist mit den vorhandenen Tests und Kernel-Modulen technisch belegbar.

### Single Interface

Belegt durch:
- `src/kernel/interface.js`
- `tests/modules/02.kernel-interface.module.mjs`

Was der Test beweist:
- App-Code darf nur ueber `src/kernel/interface.js` in den Kernel
- direkte Kernel-Imports werden vom Preflight blockiert

UI-Folgerung:
- UI kann als reine Entry-Consumer-Schicht gebaut werden
- kein UI-Code braucht Kernel-Interna direkt zu kennen

### Seed Guard

Belegt durch:
- `src/kernel/seedGuard.js`
- `tests/modules/06.seed-guard.module.mjs`

Was der Test beweist:
- fehlender oder falscher `seedHash` blockiert
- der Kernel-Run ist fail-closed

UI-Folgerung:
- Seed-Status und Hash-Mismatch muessen prominent sein
- UI kann einen Hash anzeigen, aber nicht den Kernel-Vertrag ersetzen

### Patch Gates

Belegt durch:
- `src/kernel/patchDispatcher.js`
- `tests/modules/03.patch-dispatcher-gate.module.mjs`

Was der Test beweist:
- Formatfehler, Konflikte und Confirm-Pflicht werden erzwungen

UI-Folgerung:
- Confirm ist kein kosmetischer Dialog, sondern ein Gate
- riskante UI-Aktionen muessen technisch an `patch.plan` und `patch.apply` gebunden sein

### Dispatch-Only und Governance

Belegt durch:
- `src/kernel/store/createStore.js`
- `src/kernel/store/applyPatches.js`
- `src/kernel/llmGovernance.js`
- `tests/modules/09.store-and-governance-gates.module.mjs`

Was der Test beweist:
- store mutation ist dispatch-only
- Domain-Gates und Sanitization blockieren unerlaubte Aenderungen
- Governance-Kette ist verpflichtend

UI-Folgerung:
- UI darf keine direkte State-Mutation anbieten
- UI muss Domain-Kontext und Patch-Konflikte respektieren

### KORNER und Integritaet

Belegt durch:
- `src/kernel/kornerCore.js`
- `tests/modules/08.korner-module.module.mjs`

Was der Test beweist:
- Manifest, Snapshot und String-Matrix sind ueber die Schnittstelle lesbar

UI-Folgerung:
- Integritaet kann in HUD oder Statuspanel sichtbar gemacht werden
- UI kann Systemzustand verifizieren, ohne eigene Integritaet zu berechnen

## UI-Finalsatz

Die UI von SeedWorld ist eine mobile-first, deterministische Beobachtungs- und Entscheidungsoberflaeche, die:
- strikt ueber `src/kernel/interface.js` arbeitet
- keinerlei eigene Simulation laeuft
- den Turn-Flow sichtbar fuehrt
- nur erklaerte, testbare und seed-deterministische Zustaende zeigt

## Implementierungshinweise

1. Wenn UI und Mechanics widersprechen, gewinnt die kausale Klarheit.
2. Wenn Desktop und Mobile widersprechen, gewinnt Mobile-first.
3. Wenn visuelle Dichte und Determinismus widersprechen, gewinnt Determinismus.
4. Wenn eine Anzeige ohne Kernel-Quelle auskommt, ist sie nicht zulaessig.
