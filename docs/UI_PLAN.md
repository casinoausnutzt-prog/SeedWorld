# UI Design Plan

Stand: 2026-03-25
Projekt: SeedWorld
Ziel: visuelle Struktur fuer ein rundenbasiertes "Factorio trifft Civ" auf Basis der SeedWorld-Architektur

Hinweis: Dieses Dokument bleibt ein Arbeitsplan. Die finale UI-Blaupause ist `docs/BLUEPRINT_UI.md`.

## Leitbild

SeedWorld UI ist kein zweites Simulationssystem, sondern ein deterministisches Bedien- und Lesesystem fuer einen bereits festgelegten Kernel.

Die Oberflaeche muss daher drei Dinge gleichzeitig leisten:
- den Spielzustand in einer einzigen, klar lesbaren Flaeche zeigen
- Eingaben ohne Seiteneffekte in Kernel-Commands uebersetzen
- auf Mobile zuerst funktionieren, ohne Desktop-Situation zu verlieren
- den Turn-First-Flow Observe -> Decide -> Confirm -> Resolve -> Report sichtbar fuehren

## Architektur-Constraints

Diese UI folgt den vorhandenen Kernel-Grenzen:
- Single Interface: Alle Kernzugriffe laufen ueber `src/kernel/interface.js`
- Determinismus: Die UI darf keinen Zustand selbst "erfinden", sondern nur den Kernel-Zustand darstellen
- No heavy background processes: kein permanenter Polling-Loop, kein Rendering-Loop fuer Logik, keine versteckte Simulationsarbeit im Browser
- Fail-closed: Wenn Seed-Hash, Fingerprint oder Run-Vertrag nicht passen, muss die UI den Konflikt sichtbar machen statt ihn zu kaschieren
- Mobile-first: die Default-Komposition muss auf schmalen Displays funktionieren, nicht nur auf Desktop

Konsequenz:
- Die UI ist ein Layout von Zustandsausschnitten, nicht ein freischwebendes Frontend mit eigenem Regelwerk
- Jede Interaktion ist eine Dispatch- oder Kernel-Command-Operation
- Visuelle Verlaeufe sind rein praesentational, nicht systemisch

## Informationsarchitektur

Primar soll die UI vier gleichzeitige Fragen beantworten:
1. Wo sind wir?
2. Was produziert das System gerade?
3. Welche Turn-Phase laeuft gerade?
4. Welche naechste Entscheidung ist gefordert und wann wird sie gesichert?

Darauf baut die Oberflaeche auf:
- HUD fuer globale Lage
- Weltkarte fuer Raum, Wege, Besitz und Expansion
- Produktionsansicht fuer Ketten, Bottlenecks und Queues
- Rundenpanel fuer Phasen, Aktionspunkte und Rundenende
- Mobile-Navigation fuer schnelle Umschaltung zwischen diesen Ebenen

## Visuelle Struktur

### 1. HUD

Aufgabe:
- globale Spielrelevanz in einer schmalen, immer sichtbaren Leiste zeigen

Inhalt:
- Seed-Status und Seed-Hash-Abgleich
- aktuelle Runde
- Phase der Runde
- Ressourcen-Kernwerte
- Warnungen zu Engpaessen, Ueberlast oder Guard-Verletzungen
- kurzer MUT-Fingerprint-Status als Integritaetsanzeige

Form:
- oben auf Desktop als Statusband
- auf Mobile als kompakte Kopfleiste mit ausklappbaren Details

Designprinzip:
- nur stabile Kennzahlen in der Kopfzone
- keine Detailtabellen im HUD
- keine Informationen, die fuer die aktuelle Entscheidung nicht sofort relevant sind

### 2. Weltkarte

Aufgabe:
- den strategischen Raum zeigen: Terrain, Siedlungen, Produktionszonen, Routen, Reichweite, Blockaden

Inhalt:
- Kachel- oder Hexkarte mit klarer Layer-Struktur
- Gebaeude, Knoten, Lanes, FoW oder Sichtfelder
- Besitzgrenzen und Expansion
- Transport- und Produktionsfluesse als lesbare Overlay-Linien
- Marker fuer Rundenereignisse, Konflikte und Optionen

Form:
- auf Desktop zentral und gross
- auf Mobile als Hauptviewport mit Kontext-Drawer statt dauerhafter Mehrspalten-Ansicht

Designprinzip:
- die Karte bleibt der "Ort der Wahrheit"
- Overlays muessen sparsam sein, damit der Raum nicht im Datenrauschen verschwindet
- Produktions- und Rundeninformationen duerfen die Karte nicht komplett ueberlagern

### 3. Produktionsansicht

Aufgabe:
- Factorio-artige Logik in einer turnbasierten Leseschicht sichtbar machen

Inhalt:
- Produktionsketten vom Input bis Output
- Queue fuer Bau, Umbau, Forschung oder Logistik
- Bottleneck-Detektion
- aktueller Durchsatz pro Runde
- offene Abhaengigkeiten
- Vorschau auf naechste Runde im Observe-Zustand
- Commit-Status fuer Confirm
- Ergebnisvergleich fuer Report

Form:
- als rechte Seitenkarte oder Bottom-Sheet
- auf Mobile als gesonderter Modus mit Fokus auf ein einzelnes Werk oder eine Kette

Designprinzip:
- Produktionssicht zeigt nicht "alles", sondern nur das, was fuer das naechste Entscheiden kausal wichtig ist
- jede Zahl braucht eine Herkunft und eine Wirkung
- Forecast, Commit und Resultat sind getrennte Lesestufen
- visuelle Prioritaet fuer Engpaesse vor Rohdaten

### 4. Rundenpanel

Aufgabe:
- die Civ-artige Taktung mit klarer Entscheidungslogik abbilden

Inhalt:
- Rundenstatus
- aktuelle Phase
- verfuegbare Aktionen
- Observe / Decide / Confirm / Resolve / Report als klare Phasenmarke
- Pending-Confirmation-Status fuer riskante oder irreversible Aktionen
- End-Turn-Button
- automatisch berechnete Konsequenzen der gesicherten Eingaben
- Log der letzten Resolutionen

Form:
- auf Desktop als seitliches Panel oder untere Leiste
- auf Mobile als persistente Bottom-Sheet-Steuerung mit grossen Touch-Zielen

Designprinzip:
- Runde muss immer als Entscheidungstakt lesbar sein
- der Nutzer darf nie raten muessen, ob eine Aktion sofort oder erst am Rundenende wirkt
- die UI trennt Beobachten, Entscheiden, Bestaetigen, Aufloesen und Berichten sichtbar voneinander
- das Panel trennt "jetzt ausfuehrbar" von "nach Berechnung sichtbar"

### 5. Mobile-first Layout

Default-Layout fuer kleine Screens:
- eine Hauptflaeche
- eine primare Bottom-Navigation
- ein aktives Detail-Panel zur Zeit
- grosse Touch-Ziele und kurze Texteinheiten

Kompositionsregel:
- Weltkarte ist die Default-Hauptflaeche im Observe- und Report-Zustand
- waehrend Decide / Confirm / Resolve ist das aktive Turn-Panel die Primar-Flaeche, die Karte bleibt Kontext
- HUD bleibt als schmale Oberkante sichtbar
- Produktions- und Rundenpanel werden als Drawer oder Sheet eingeblendet

Bedienregeln:
- keine kleinen Desktop-Mikro-Controls als Pflichtweg
- kein Hover als Voraussetzung
- Drag nur als Zusatz, nicht als einzige Interaktionsform
- alle kritischen Aktionen muessen mit einem Fingertap erreichbar sein

## EMMI-Dance Vergleich

In diesem Plan wird EMMI-Dance als Entscheidung zwischen zwei UI-Entwuerfen gelesen:

### Entwurf A: "Persistent Panorama"

Charakter:
- Weltkarte bleibt fast immer voll sichtbar
- HUD oben, Produktionsansicht rechts, Rundenpanel unten
- hohe Informationsdichte, wenig Kontextwechsel

Staerken:
- sehr gute gleichzeitige Uebersicht
- schnelle Querpruefung zwischen Raum, Produktion und Runde
- fuer Desktop-Strategiegespiele sehr effizient

Schwaechen:
- auf Mobile schnell ueberladen
- kleine Controls erzeugen Fehlklick-Risiko
- Produktionsketten konkurrieren optisch mit der Kartenlesbarkeit

Kausale Konflikte mit Mechanics/UX:
- Mehr Gleichzeitigkeit fuehrt zu weniger Klarheit, obwohl das Spiel turnbasiert ist
- Der Nutzer sieht zu viel parallel und trifft zu frueh zu komplexe Entscheidungen
- Produktionsdetail und Kartendetail beanspruchen dieselbe visuelle Aufloesung
- Die UI erzeugt "Management-Druck", obwohl die Mechanik rundenweise entschleunigen soll

### Entwurf B: "Mode Stack"

Charakter:
- ein dominanter Hauptmodus pro Moment, gesteuert durch den Turn-Flow
- Karte, Produktion und Runde wechseln als klare Arbeitskontexte entlang Observe -> Decide -> Confirm -> Resolve -> Report
- Detailzustand kommt als Drawer oder Sheet

Staerken:
- deutlich besser fuer Mobile
- klarere mentale Trennung zwischen Erkundung, Produktion und Rundenentscheidung
- weniger visuelles Rauschen

Schwaechen:
- weniger unmittelbarer Gesamtueberblick
- mehr Mode-Wechsel kann sich am Desktop langsamer anfuehlen
- Vergleich von Karte und Produktion kostet einen Extra-Tap

Kausale Konflikte mit Mechanics/UX:
- Die Mechanik lebt von Raum + Versorgung + Runde gleichzeitig, die UI muss diese Ebenen aber phasenrichtig sichtbar machen
- Das reduziert Fehler, kostet aber Vergleichsgeschwindigkeit
- Wenn zu viele Details im Drawer liegen, entsteht Verdeckungs-Effekt statt Strategie-Effekt
- Wenn die Karte waehrend Confirm/Resolve zu dominant bleibt, steigt Fehlklick- und Fehlentscheidungsrisiko
- Die UI muss vermeiden, dass das Spiel sich wie ein Formular und nicht wie ein Planungsraum anfuehlt

### Empfehlung

Primar empfohlen wird Entwurf B als Mobile-First-Grundlage, ergaenzt um ein permanentes HUD und eine grosse Weltkarte als Default-Ansicht.

Das ist kein reines "B statt A", sondern:
- B fuer Kontext und Bedienung
- A als Uebersichtsschicht nur in Observe und Report sowie auf groesseren Screens
- Confirm und Resolve bleiben bewusst panel-zentriert, nicht map-zentriert

Damit wird die Kernspannung aufgeloest:
- strategische Breite bleibt sichtbar
- mobile Bedienbarkeit bleibt praktikabel
- der turnbasierte Rhythmus wird nicht durch Dauerrauschen zerstoert
- die Phase bestimmt die primare Flaeche, nicht die statische Layout-Vorliebe

## Konkrete UI-Regeln

1. Ein Bildschirm, ein Primar-Fokus
- pro Moment entweder Karte, Produktion oder Runde im Vordergrund

2. Zahlen brauchen Ursache
- jede Kennzahl muss auf eine Quelle oder Folge verweisen

3. Keine versteckte Logik im UI
- keine Hintergrundberechnung ausser dem was der Kernel bereits liefert

4. Aktionen sind immer explizit
- Bau, Umrouten, Forschung, End Turn, Bestaetigung

5. Kritische Zustande sind sichtbar
- Seed-Mismatch, Fingerprint-Drift, gesperrte Aktion, fehlender Input

6. Mobile-Controls zuerst
- grosse Buttons, klare Labels, kurze Wege, keine Hover-Abhaengigkeit

## Deliverables Phase 1 bis 3

### Phase 1: Struktur und Wireframes

Deliverables:
- visuelles Layoutmodell fuer HUD, Weltkarte, Produktionsansicht und Rundenpanel
- mobile und Desktop Wireframes
- Navigationsschema fuer Karte / Produktion / Runde / Status
- Zustandswortschatz fuer Seed, Runde, Phase, Queue, Bottleneck, Integritaet
- Verbindungsdiagramm "UI -> Kernel Command -> State -> Render"

Definition of Done:
- alle vier Hauptflaechen sind positionell festgelegt
- Mobile-First-Komposition ist definiert
- keine Interaktion widerspricht den Kernel-Constraints

### Phase 2: Visuelles System und Static Prototype

Deliverables:
- Farb- und Typo-System
- Karten-, HUD- und Panel-Komponenten in statischem Prototyp
- Touch-Targets, Abstaende und Breakpoints
- Zustandsvarianten fuer OK / Warnung / Blockiert / Konflikt
- first-pass leerer End-to-End-Flow ohne Spieltiefe

Definition of Done:
- Layout funktioniert auf schmalem Bildschirm und Desktop
- Status, Runde und Produktion sind optisch unterscheidbar
- kein Element braucht Daueranimation oder Hintergrundprozess

### Phase 3: Kernel-integrierte Bedienung

Deliverables:
- Anbindung der UI an `src/kernel/interface.js`
- Seed-Hash-Pruefung und Run-Feedback in der Oberflaeche
- deterministische Zustandsdarstellung pro Runde
- Aktionen fuer Bau, Produktion, Rundenende und Konfliktbestaetigung
- Zugriffslogik fuer Fehlzustand, Mismatch und Blockade
- UI-Tests fuer Kernfluesse und mobile Bedienbarkeit

Definition of Done:
- jede sichtbare Aktion laeuft ueber den Kernel-Entry
- die UI stellt nur dar, was der Kernel liefert
- Fehlerzustande sind sichtbar und blockierend, nicht dekorativ

## Risiko- und Konfliktlogik

Die groessten UX-Risiken entstehen nicht aus Optik, sondern aus Mechanik-Missverstaendnis:
- wenn Produktion zu tief versteckt ist, wirkt das Spiel beliebig
- wenn die Karte zu dicht belegt ist, verliert der Spieler Orientierung
- wenn das Rundenpanel zu prominent ist, verschwindet die Strategieebene
- wenn der Mobile-Flow zu viele Untermodi erzeugt, wird das Spiel anstrengend statt taktisch

Die Designregel lautet daher:
- strategische Breite zeigen
- taktische Tiefe nur bei Bedarf oeffnen
- seltene, aber wichtige Konflikte auffaellig machen

## Ergebnisbild

Der Zielzustand ist eine UI, die sich anfuehlt wie:
- ein klarer Planungsraum
- ein lesbarer Produktionskoerper
- ein kontrollierter Rundenapparat

und nicht wie:
- ein generisches Dashboard
- ein reaktiver Echtzeit-Worker
- ein visuell ueberladenes Management-Sammelsurium
