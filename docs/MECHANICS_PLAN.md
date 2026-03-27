# Mechanics Plan: Round-Based Economy/Expansion

Stand: 2026-03-25

Scope: SeedWorld-Kernel als deterministic dispatch-only Basis fuer ein rundenbasiertes Wirtschafts- und Expansionsspiel im Spannungsfeld von Factorio und Civ.

## Zielbild

Das Spiel soll drei Dinge gleichzeitig leisten:

1. Systemische Tiefe durch Produktionsketten, Forschung, Logistik und Fraktionen.
2. Kausale Klarheit durch harte Runden und klar sichtbare Resolve-Phasen.
3. Kernel-Tauglichkeit durch seed-deterministische Ausfuehrung, Domain-Gates und patch-basierte Mutation.

Leitprinzipien:

- Kein Echtzeit-Simulationsdruck.
- Keine direkte State-Mutation aus UI oder LLM.
- Jeder Effekt muss eine Ursache, einen Domain-Kontext und einen reproduzierbaren Resolve-Weg haben.
- Prognose und Ergebnis duerfen auseinanderfallen, aber nur als explizit erklaerte Spielmechanik, nicht als Zufall der Architektur.

## UI- und UX-Kompatibilitaet

Die Mechanik muss mit `docs/UI_PLAN.md` und dem UX-Ziel `turn-first, geringe kognitive Last, keine Hintergrundlast` kompatibel bleiben.

Verbindliche Konsequenzen:

- Baseline ist Mode Stack B: pro Moment genau eine aktive Arbeitsflaeche, ergaenzt durch ein persistentes HUD.
- Kein Mechaniksystem darf voraussetzen, dass Karte, Produktion und Runde gleichzeitig voll aufgezogen sind.
- Alle Vorhersagen sind Kernel-Ergebnisse; das Frontend simuliert nichts im Hintergrund.
- Spielerhandlungen werden gesammelt, gelockt und erst danach deterministisch resolved.
- Jede Detailansicht ist ein Drill-down, kein zweites Simulationsfenster.

## Kern-Mechaniken

### 1) Rundenfluss

Eine Runde ist die kleinste harte Zeiteinheit. Sie besteht aus festen Phasen:

1. `Plan`
2. `Lock`
3. `Resolve`
4. `Upkeep`
5. `Reveal`
6. `Next Round`

Semantik:

- `Plan`: Der Spieler oder die KI legt Befehle an.
- `Lock`: Der Input fuer die Runde wird eingefroren.
- `Resolve`: Befehle werden deterministisch in einer festen Reihenfolge abgearbeitet.
- `Upkeep`: Unterhalt, Verbrauch und Schadensfolgen werden berechnet.
- `Reveal`: UI und Log zeigen Ursache, Wirkung und Restunsicherheit.
- `Next Round`: Neue Runde mit neuer deterministischer Basis.

Regeln:

- Eine Runde darf nicht nachtraeglich umgeplant werden.
- Reihenfolge muss aus stabilen Schluesseln kommen, nie aus Laufzeitreihenfolge oder Objekt-Iteration.
- Jeder Resolve muss auf einem Round-Fingerprint beruhen, der aus Seed, Round-Index und Basiszustand ableitbar ist.
- Die UI zeigt pro Runde nur die aktuell relevante Phase im Vordergrund; der Rest bleibt als kompakte Statusinfo sichtbar.

### 2) Produktion

Produktion ist eine gerasterte, rundenbasierte Umwandlung von Input in Output.

Mechanik:

- Gebaeude, Module und Kapazitaeten erzeugen Output pro Runde.
- Produktionsketten haben Input, Output, Durchsatz und Unterhalt.
- Ueberlauf wird entweder gepuffert, verworfen oder in Abfall umgewandelt, aber immer regelbasiert.
- Produktionsstaerkung erfolgt ueber Forschung, Infrastruktur und Fraktionsboni.

Wichtige Designentscheidung:

- Keine Echtzeit-Transportphysik.
- Produktion wird als aggregierter Ledger mit begrenzter Kapazitaet modelliert, nicht als Pixel- oder Tick-Simulation.

Ziele:

- Spieler sollen Knappheiten und Engpaesse lesen koennen.
- Produktionsverhalten muss in der Preview erklaerbar sein.
- Jede Aenderung an der Produktion muss deterministisch aus denselben Inputs dieselben Outputs erzeugen.
- Die Preview ist eine zusammengefasste Ursache-Wirkung-Vorschau, keine permanente Detailmatrix.

### 3) Forschung

Forschung schaltet neue Produktions-, Logistik- und Diplomatieoptionen frei.

Mechanik:

- Forschungspunkte werden pro Runde gesammelt.
- Projekte haben Kosten, Dauer, Voraussetzungen und Unlock-Effekte.
- Forschung darf parallel laufen, aber nur innerhalb klarer Slots oder Prioritaeten.
- Unlocks beeinflussen nicht nur Zahlen, sondern neue Regeln, Recipes und Domain-Keys.

Regeln:

- Forschungsfortschritt ist monotone Zustandsaenderung.
- Rueckbau ist nur erlaubt, wenn er als explizite Spielregel modelliert ist.
- Der Unlock-Effekt muss vorab in der UI sichtbar sein, damit der Kausalpfad stimmt.

### 4) Logistik

Logistik ist die Verbindung zwischen Produktion, Lager und Verbrauch.

Mechanik:

- Das Netz besteht aus Knoten, Kanten, Kapazitaeten und Prioritaeten.
- Transport ist pro Runde begrenzt und kann an Engpaessen scheitern.
- Pfadwahl und Lastverteilung muessen deterministisch sein.
- Prioritaeten sollen stabile Tie-Breaker haben, z. B. Knoten-ID, Distanz, Politik, Erstellungszeitpunkt als logischer Wert, nicht als Wallclock.

Wichtige Designentscheidung:

- Logistik ist ein Graph-Ledger, keine physische Belt-Simulation.
- Dadurch bleibt die Simulation auf Mobile und im Round-System lesbar.

### 5) Fraktionen

Fraktionen geben dem Expansionsspiel politische und strategische Reibung.

Mechanik:

- Jede Fraktion besitzt Territorium, Ressourcenfokus, Diplomatie, Aggression und Loyalitaet.
- Beziehungen koennen sich pro Runde verschieben.
- Fraktionsentscheidungen koennen Produktionsboni, Sanktionen oder Konflikte ausloesen.

Regeln:

- Fraktions-KI muss seed-deterministisch sein.
- Diplomatie darf nicht aus versteckten Zufallswerten entstehen.
- Fraktionswechsel, Krieg und Frieden muessen als explizite Events oder Resolves sichtbar werden.
- Fraktionsstatus wird in der UI als kompakter Ueberblick und nur bei Bedarf als Detailansicht gezeigt.

### 6) Events

Events sind der Spannungsregler fuer die Welt.

Mechanik:

- Events werden aus einem deterministischen Deck oder Trigger-Set gezogen.
- Trigger koennen Ressourcen, Zeit, Territorium, Forschung oder Fraktionsdruck sein.
- Jedes Event muss telegraphiert sein, sofern es nicht als harter Weltzustand gedacht ist.
- Events koennen Lokationen, Produktionsketten, Diplomatie oder Forschung beeinflussen.

Regeln:

- Event-Auswahl ist seed- und zustandsgebunden.
- Ein Event darf nicht anders ausfallen, nur weil die UI anders geladen hat.
- Event-Resolves muessen in Logs und Preview nachvollziehbar bleiben.
- Events erscheinen als Round-Card oder Log-Eintrag, nicht als dauerhafte Nebenlast.

## Konfliktauflosungen mit UI und UX

Die folgende Aufloesung gilt fuer alle Mechanik-Komponenten:

- Lesbarkeit: Jede Runde zeigt nur die aktuell kausal relevante Information. Produktions-, Logistik- und Fraktionsdetails werden nicht gleichzeitig vollflaechig offen gehalten.
- Mobile-Constraints: Jede Mechanik muss in ein Sheet, Drawer oder kompaktes Panel passen. Keine Regel darf Hover, Mehrspalten-Daueransicht oder dauerhafte Kleinteiligkeit voraussetzen.
- Determinismus: UI-Preview und Kernel-Resolve duerfen denselben Zustand nur unterschiedlich verdichten, nicht unterschiedlich berechnen.
- Turn-first: Der Spieler plant, commitet und sieht dann das Ergebnis. Es gibt keine Hintergrundreaktionen, die zwischen zwei UI-Zustaenden eigenmaechtig weiterlaufen.
- Kausale Klarheit: Jede Anzeige muss sagen, ob sie Eingabe, Lock, Resolve oder Ergebnis darstellt.

## Governance-Mapping zur bestehenden Kernel-Kette

Die Mechanics-Schicht muss auf die vorhandene Governance-Kette aufsetzen:

`Action-Schema -> Mutation-Matrix -> Domain-Gates -> Dispatch-only -> Determinism-Guard -> Sanitization`

### 1) Action-Schema

Jede Spielaktion wird als formal validierte Action beschrieben.

Empfohlene Action-Typen fuer den Mechanik-Kern:

- `ROUND_ADVANCE`
- `QUEUE_BUILD`
- `QUEUE_ROUTE`
- `QUEUE_RESEARCH`
- `SET_FACTION_POLICY`
- `RESOLVE_EVENT`
- `END_TURN`

Schema-Regeln:

- `type` ist Pflicht.
- `payload` und `meta` bleiben Plain-Objects.
- Pflichtfelder muessen je Action-Typ explizit beschrieben werden.
- Ein Action-Typ darf nur eine fachliche Absicht haben.

### 2) Mutation-Matrix

Die Mutation-Matrix soll die Mechanics-Domaenen strikt voneinander trennen.

Empfohlene Domaenen:

- `round`
- `economy`
- `production`
- `logistics`
- `research`
- `factions`
- `events`
- `ui`
- `audit`

Beispielhafte Pfadpraefixe:

- `round`: `world.round`, `world.timeline`, `world.audit`
- `economy`: `world.resources`, `world.stockpiles`, `world.balance`
- `production`: `world.production`, `world.facilities`, `world.recipes`
- `logistics`: `world.logistics`, `world.routes`, `world.capacity`
- `research`: `world.research`, `world.techTree`, `world.unlocks`
- `factions`: `world.factions`, `world.diplomacy`, `world.territory`
- `events`: `world.events`, `world.eventLog`, `world.announcements`

Regeln:

- Ein Domain-Dispatch darf nur in der passenden Domain patchen.
- Cross-Domain-Aenderungen muessen durch mehrere explizite Dispatches laufen, nicht durch einen impliziten Sammelpatch.
- Root-Replacements bleiben verboten.
- Paths muessen stabil und konfliktarm sein, damit Tests und Doku synchron bleiben.
- Die UI soll diese Domaenen als Moduswechsel abbilden, nicht als dauerhaft parallele Vollansicht.

### 3) Domain-Gates

Die bestehende Domain-Gate-Logik ist fuer die Mechanics-Schicht verbindlich.

Konsequenz:

- UI oder KI koennen nur ueber einen Domain-Kontext mutieren.
- Produktions-, Forschungs- und Diplomatieeffekte koennen nicht stillschweigend in denselben Patch gemischt werden.
- Jede Patch-Batch muss dieselbe Domain tragen wie der Dispatch.

### 4) Dispatch-only

Alle spielrelevanten State-Aenderungen laufen ueber Dispatch.

Konsequenz fuer die Architektur:

- UI sammelt nur Absichten.
- Reducer und SimStep berechnen pure, gefrorene Zwischenzustande.
- Patches werden erst nach Gate-Pruefung angewendet.
- Kein Code darf Mechanik-Truth direkt in DOM, globale Variablen oder Nebenkanaele schreiben.

### 5) Determinismus und Sanitization

Die Mechanik darf keine neue Nondeterminismus-Quelle einfuehren.

Pflichtregeln:

- Keine wallclock-basierten Entscheidungen.
- Keine order-abhaengigen Iterationen ueber ungesicherte Objekte.
- Alle Zufallsentscheidungen kommen aus dem seed-deterministischen Pfad.
- Alle Eingaben bleiben plain und sanitisiert.

## EMMI-Dance Vergleich: Mechanikset A vs B

Ich verwende EMMI-Dance hier als Vergleichsrahmen fuer zwei konkurrierende Mechanik-Setups.

### Set A: Dense Factory Loop

Charakter:

- Hohe Dichte an Produktions-, Logistik- und Event-Wechselwirkungen pro Runde.
- Mehrere Subsysteme koennen in einem Resolve-Fenster gleichzeitig reagieren.
- Sehr starkes Factorio-Gefuehl, weil alles miteinander verkettet ist.

Vorteile:

- Hohe Emergenz.
- Starke Optimierungsprobleme.
- Gute Langzeit-Tiefe fuer Spieler mit Systemdenken.

Risiken:

- Balance wird empfindlich, weil kleine Parameter aehnlich wie in einer Kettenreaktion wirken.
- Determinismus-Risiko steigt, wenn Reihenfolge und Tie-Breaks nicht absolut stabil sind.
- UI/UX-Konflikt: Der Spieler sieht viele Ursache-Wirkung-Ketten erst nach der Runde, nicht waehrend der Entscheidung.

Kausaler UI-Konflikt:

- Wenn die UI zu stark auf direkte Manipulation setzt, aber das System erst am Round-End aufloest, entsteht ein Vertrauensbruch.
- Der Spieler erwartet Sofortwirkung, bekommt aber Batch-Wirkung.
- Ohne Forecast-Ansicht ist Set A fuer Mobile schnell ueberladen.

### Set B: Phase-Locked Empire Loop

Charakter:

- Produktions-, Forschungs-, Logistik- und Diplomatie-Effekte laufen in festen, klar benannten Phasen.
- Jede Phase hat genau eine sichtbare Ursache-Wirkung-Kette.
- Mehr Civ-Gefuehl, weniger mikrooperatives Rauschen.

Vorteile:

- Hohe Lesbarkeit.
- Leichtere Balance.
- Niedrigeres Determinismus-Risiko.
- UI kann jede Phase als eigenen Bildschirm, Bottom-Sheet oder Karten-Stack darstellen.

Risiken:

- Weniger systemische Verflechtung als Set A.
- Potenzial fuer dominierende Strategien, wenn Phasen zu sauber voneinander isoliert sind.
- Weniger "Factory Chaos", mehr Planungslogik.

Kausaler UI-Konflikt:

- Wenn die UI die Phasen sauber trennt, bleibt die mentale Last niedrig.
- Wenn die UI aber versucht, wieder alles gleichzeitig zu zeigen, verliert Set B seinen Hauptvorteil.

### Entscheidung

Fuer SeedWorld v1 ist Set B die verbindliche Default-Wahl und entspricht der UI-Basis `mode stack B`.

Begruendung:

- Passt besser zu dispatch-only und Domain-Gates.
- Passt besser zu Mobile-first UI.
- Ist leichter deterministisch zu testen.
- Reduziert die Gefahr, dass komplexe Produktionsverflechtungen die Spielerfuehrung zerbrechen.
- Reduziert visuelles Rauschen und damit die kognitive Last.

Set A bleibt nur als spaetere Desktop-Erweiterung sinnvoll, wenn Forecasting, Replay und klare Causal-Overlays bereits vorhanden sind.

## Implementierungsphasen

### Phase 0: Vertrags- und Domain-Freeze

Ziel:

- Mechanik-Domaenen und ihre erlaubten State-Pfade festziehen.

Lieferumfang:

- Canonical state tree fuer `round`, `economy`, `production`, `logistics`, `research`, `factions`, `events`.
- Action-Schema fuer die ersten Kernaktionen.
- Mutation-Matrix fuer alle neuen Mechanics-Domaenen.

Akzeptanzkriterien:

- Jede neue Action ist ueber Schema pruefbar.
- Jede neue Domain hat mindestens einen erlaubten Path-Prefix.
- Cross-Domain-Patches werden geblockt.
- Tests koennen die Domain-Pfade ohne Sonderlogik validieren.

### Phase 1: Rundenkern

Ziel:

- Ein deterministischer Round-Loop mit Lock, Resolve und Reveal.

Lieferumfang:

- Round-State mit Index, Seed-Ableitung und Resolve-Log.
- Deterministische Reihenfolge fuer Actions und Subsysteme.
- Round-Summary fuer UI.

Akzeptanzkriterien:

- Gleicher Seed + gleiche Action-Folge = gleicher Outcome und gleicher Fingerprint.
- Eine gesperrte Runde kann nicht nachtraeglich umgeschrieben werden.
- Ohne Seed- oder Domain-Kontext wird fail-closed geblockt.

### Phase 2: Produktion und Logistik

Ziel:

- Produktionsketten und Transportkapazitaeten als erstes echtes Wirtschaftssystem.

Lieferumfang:

- Produktionsrezepte.
- Lager und Puffer.
- Netzwerk-Graph mit Kapazitaet und Prioritaet.
- Durchsatz- und Engpassberechnung.

Akzeptanzkriterien:

- Engpaesse reduzieren Output sichtbar und deterministisch.
- Produktions- und Logistik-Tests zeigen identische Ergebnisse bei identischen Inputs.
- Negative oder nicht-sanitierte Werte werden geblockt, sofern sie nicht explizit als Spielregel definiert sind.

### Phase 3: Forschung und Fraktionen

Ziel:

- Langfristige Progression und politische Reibung.

Lieferumfang:

- Tech-Tree.
- Research-Queues.
- Fraktionswerte, Beziehungen und Policies.
- Unlock-Effekte auf Produktion und Logistik.

Akzeptanzkriterien:

- Forschung schreitet nur ueber definierte Kosten und Runden fort.
- Unlocks sind vor dem Resolve lesbar.
- Fraktionsentscheidungen sind seed-deterministisch.
- Gleiche Weltlage fuehrt zur gleichen Fraktionsentwicklung.

### Phase 4: Events und Weltreaktion

Ziel:

- Weltspannung, Gegenreaktionen und situative Abweichungen.

Lieferumfang:

- Deterministischer Event-Pool.
- Telegraphed vs hard events.
- Event-Log und UI-Disclosure.

Akzeptanzkriterien:

- Event-Auswahl ist reproduzierbar.
- Ein Event erklaert seine Ursache und seinen Effekt.
- Ereignisse duerfen nicht stillschweigend ausserhalb der Domain `events` patchen.

### Phase 5: UI/UX-Kopplung

Ziel:

- Jedes mechanische System wird in einer lesbaren UI sichtbar.

Lieferumfang:

- Round Summary.
- Production Panel.
- Logistics Panel.
- Research Queue.
- Faction Status.
- Event Cards.

Akzeptanzkriterien:

- Jeder Button mappt auf genau eine fachliche Absicht.
- Die UI zeigt Lock, Resolve und Ergebnis getrennt.
- Preview und Post-Resolve muessen logisch zusammenpassen.
- Mobile-first Bedienung bleibt erhalten.

### Phase 6: Balance- und Determinismus-Hardening

Ziel:

- Den Mechanik-Kern gegen Drift, Exploits und inkonsistente Darstellung absichern.

Lieferumfang:

- Replay- oder Simulationstests ueber mehrere Seeds.
- Balance-Sweeps ueber Produktions-, Research- und Event-Parameter.
- Regressionstests fuer Domain-Gates, Action-Schema und Patch-Regeln.

Akzeptanzkriterien:

- Mehrfachlaeufe mit gleichem Seed bleiben identisch.
- Kleine Parameteraenderungen erzeugen erklaerbare, begrenzte Delta-Effekte.
- Keine neue Funktion darf den Dispatch-only-Kern umgehen.

## Testbare Mindestdefinition fuer v1

Ein v1-Release ist erst dann plausibel, wenn:

- Ein Rundendurchlauf deterministisch wiederholbar ist.
- Produktion, Forschung, Logistik, Fraktionen und Events jeweils mindestens eine echte Regel haben.
- UI und Kernel dieselbe Kausallogik zeigen.
- Die Governance-Kette aus Action-Schema, Mutation-Matrix, Domain-Gates und Sanitization intakt bleibt.
- Alle Kernfaelle ueber `tests/MainTest.mjs` und ergaenzende Module pruefbar sind.

## Kurzempfehlung

Wenn das Ziel ein sauberer, mobiltauglicher SeedWorld-Prototyp ist, dann:

- Mechanikset B als Hauptpfad bauen.
- Mechanikset A nur als spaetere Eskalationsstufe offenhalten.
- Jede neue Regel als Domain, Action und Test denken, nicht als UI-Hack.
