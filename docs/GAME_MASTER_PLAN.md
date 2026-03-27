# Game Master Plan

Stand: 2026-03-25

Scope: Konsolidierter Plan fuer UI, Mechanics und UX in SeedWorld. Dieser Plan beschreibt den gemeinsamen Spieltakt, die sichtbaren Arbeitsmodi und die implementierbaren Phasen fuer ein rundenbasiertes, seed-deterministisches Economy- und Expansion-Spiel.

Referenzordnung:
- UI: `docs/BLUEPRINT_UI.md` ist die finale UI-Blaupause.
- Mechanics: `docs/MECHANICS_PLAN.md` ist die finale Mechanics-Blaupause.
- Game Master: dieses Dokument bleibt die uebergreifende Koordinationsschicht.

## Zielbild

SeedWorld soll sich wie ein klarer Planungsraum anfuehlen:

- turn-first statt daueraktiver Simulation
- mobile-first statt Desktop-Only-Dashboard
- mode stack B als Bedienbasis statt persistentem Panorama
- deterministic dispatch-only statt versteckter Frontend-Logik
- geringe kognitive Last statt paralleler Ueberfrachtung

Der Spieler soll jederzeit wissen:

1. Was ist die aktuelle Runde und Phase?
2. Welche Entscheidung steht jetzt an?
3. Was passiert erst nach Commit und Resolve?
4. Was ist die kausale Wirkung der letzten Aktion?

## Gemeinsamer Spieltakt

Der operative Loop ist fuer UI, Mechanics und UX derselbe:

1. Observe
2. Plan
3. Commit
4. Resolve
5. Reveal
6. Next Round

Semantik:

- Observe: HUD, Status und aktiver Modus zeigen den aktuellen Zustand.
- Plan: Der Spieler waehlt eine Absicht in genau einem Fokusmodus.
- Commit: Die Eingabe wird abgeschlossen und in den Kernel uebergeben.
- Resolve: Der Kernel berechnet die Runde seed-deterministisch.
- Reveal: Die UI zeigt Ergebnis, Deltas, Engpaesse und Konflikte.
- Next Round: Der naechste Entscheidungszyklus beginnt.

## Bedienungsprinzipien

- Ein Bildschirm hat einen Primarfokus.
- Das HUD bleibt als schmale, stabile Orientierung sichtbar.
- Karte, Produktion, Logistik, Forschung, Fraktionen und Events wechseln als Modi, nicht als dauerhafte Vollansicht.
- Jede Vorschau ist ein Kernel-Preview, keine Zusatzsimulation im Browser.
- Keine Hintergrundlast: keine Polling-Schleifen, keine versteckte Logik-Animation, keine nebenbei laufende Berechnung.

## Gemeinsame Informationsarchitektur

### Dauerhaft sichtbar

- Seed-Status und Seed-Hash-Check
- Runde und Phase
- knappe Ressourcen- und Warnwerte
- Integritaetsstatus oder Blockadehinweis

### Mode-basierte Detailansichten

- Weltkarte
- Produktionsansicht
- Rundenpanel
- Logistikansicht
- Forschungsqueue
- Fraktionsstatus
- Event-Karten und Resolution-Log

### Regel fuer Detailtiefe

- Stabil im HUD
- Kontextbezogen im Mode
- Kaum Text, viel Ursache-Wirkung
- Drill-down nur bei Bedarf

## Mechanik- und UI-Zuordnung

### Runde

- UI: Rundenpanel, Phase-Header, End-Turn-Button
- Mechanics: Round-Flow, Lock, Resolve, Reveal
- UX: klare Taktung, keine Unklarheit ueber Zeitpunkt der Wirkung

### Produktion

- UI: Produktionsdrawer oder Sheet
- Mechanics: Produktion, Rezepte, Kapazitaet, Unterhalt
- UX: bottleneck-first, nicht datenmatrix-first

### Logistik

- UI: Routen- und Engpassansicht im aktiven Mode
- Mechanics: Graph-Ledger, Kapazitaet, Prioritaeten
- UX: keine physische Belt-Explosion auf kleiner Flaeche

### Forschung

- UI: Research-Queue und Unlock-Vorschau
- Mechanics: Tech-Tree, Kosten, Dauer, Requirements
- UX: klarer Fortschritt statt versteckter Slots

### Fraktionen

- UI: kompakter Status, Relations-Detail nur bei Bedarf
- Mechanics: seed-deterministische Fraktionswerte und Policies
- UX: politische Lage lesbar, nicht versteckt

### Events

- UI: Event-Card, Event-Log, Entscheidungsknopf
- Mechanics: deterministische Trigger und Resolves
- UX: Ereignisse sind erklaert, nicht nur gemeldet

## Konfliktregeln

Diese Regeln sind bindend, damit UI, Mechanics und UX nicht gegeneinander arbeiten:

- Kein Mechaniksystem darf parallele Vollsicht verlangen, wenn die UI auf Mode Stack B basiert.
- Keine Anzeige darf eine Entscheidung auf Basis unsichtbarer Hintergrundlogik suggerieren.
- Keine Round-Wirkung darf vor dem Resolve stillschweigend sichtbar sein.
- Kein Patch darf mehrere Gameplay-Domaenen ohne explizite Domain-Gates vermischen.
- Keine Preview darf von einer anderen Logik stammen als der spaetere Resolve.
- Kein wichtiger Wert darf ohne Quelle, Phase oder Ursache angezeigt werden.

## Implementierungsphasen

### Phase 0: Gemeinsames Vertragsmodell

Ziel:

- UI, Mechanics und UX auf denselben Zustandsbaum und dieselben Benennungen ausrichten.

Lieferumfang:

- gemeinsamer State-Atlas fuer `round`, `economy`, `production`, `logistics`, `research`, `factions`, `events`
- verbindliche Action-Typen fuer Kerninteraktionen
- bindende Domain-Matrix fuer erlaubte Pfade
- UI-Mode-Mapping fuer jede Gameplay-Domain

Akzeptanzkriterien:

- Jeder Mode ist einer Domain zugeordnet.
- Jede Kernaktion hat einen klaren UI-Ausloeser.
- Kein Spielpfad benoetigt mehr als einen koordinierten Kernel-Entry.

### Phase 1: Turn Shell

Ziel:

- Der Turn-First-Loop wird sichtbar und bedienbar.

Lieferumfang:

- HUD
- Runde/Phase-Anzeige
- Commit- und Reveal-Zustaende
- Seed-Hash-Status
- Blockade- und Fehlzustandsanzeige

Akzeptanzkriterien:

- Nutzer koennen immer sehen, ob sie in Observe, Plan, Commit, Resolve oder Reveal sind.
- Die UI benoetigt keinen Hintergrundprozess, um sich korrekt zu verhalten.
- Der Reveal zeigt das Ergebnis erst nach dem Commit.

### Phase 2: Economy Core

Ziel:

- Produktion und Logistik als erste kausale Spielschleife ausspielen.

Lieferumfang:

- Produktionsansicht
- Queue-Handling
- Bottleneck- und Kapazitaetsanzeige
- Routenstatus und Engpassmeldung

Akzeptanzkriterien:

- Ein Produktionsengpass ist in der UI klar sichtbar.
- Die gleiche Eingabe erzeugt denselben Output.
- Mobile und Desktop zeigen dieselbe Kausalstruktur, aber in unterschiedlicher Komposition.

### Phase 3: Progression Core

Ziel:

- Forschung und Fraktionen als langfristige Entscheidungslaeden integrieren.

Lieferumfang:

- Research-Queue
- Unlock-Vorschau
- Fraktionsstatus
- Policy- und Diplomatie-Feedback

Akzeptanzkriterien:

- Fortschritt ist vor dem Commit lesbar.
- Fraktionsaenderungen sind als Folge einer Runde nachvollziehbar.
- Kein Unlock wirkt "magisch" ohne sichtbare Ursache.

### Phase 4: Event Core

Ziel:

- Events als Spannungs- und Reaktionslayer in den Turn-Loop einbauen.

Lieferumfang:

- Event-Card-System
- Resolution-Log
- Telemetrie fuer Ursachen und Effekte

Akzeptanzkriterien:

- Ein Event hat immer eine deterministische Ursache.
- Ein Event ist als Karte oder Logeintrag sichtbar, nicht als Hintergrundrauschen.
- Der Spieler kann die Relevanz eines Events direkt einordnen.

### Phase 5: Mobile Polish und Balance

Ziel:

- Die Bedienung bleibt auf kleinen Bildschirmen schnell, klar und robust.

Lieferumfang:

- Touch-Ziel-Review
- Drawer- und Sheet-Feinschliff
- Textlaengen-Review
- Balance-Sweeps ueber Runde, Produktion, Forschung und Events

Akzeptanzkriterien:

- Keine Kernaktion verlangt Hover oder Kleinstkontrollen.
- Kein Modus produziert visuelle Ueberladung.
- Gleiches Setup bleibt ueber mehrere Runs identisch.

## Definition of Done fuer v1

Ein v1-Stand gilt erst dann als tragfaehig, wenn:

- die UI Mode Stack B als mobile Baseline erfuellt
- die Mechanics rundenbasiert, seed-deterministisch und dispatch-only arbeiten
- die UX niedrige kognitive Last, klare Ursache-Wirkung und keine Hintergrundlast erzwingt
- jeder Kernpfad testbar und reproduzierbar ist
- jede Domain eine klar sichtbare UI- und Kernel-Rolle hat

## Prioritaetsregel

Wenn UI-Eleganz, mechanische Tiefe und mobile Lesbarkeit in Konflikt geraten, gilt folgende Reihenfolge:

1. Kausale Klarheit
2. Mobile Bedienbarkeit
3. Determinismus
4. Systemtiefe
5. Visuelle Dichte

Das verhindert, dass das Spiel zwar reich, aber unlesbar wird.
