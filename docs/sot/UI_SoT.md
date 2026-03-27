# UI SoT

`UIController` liest nur JSON aus den Eingaben, haelt einen lokalen State-Snapshot und schreibt nur in die Anzeige. `Plan` und `Apply` rufen erst `GameLogicController.calculateAction()` auf und senden danach die Patches an den Kernel. `Refresh` liest den State aus dem UI-Input neu ein und rendert ihn wieder, statt eine eigene Spiel- oder Kernel-Logik zu berechnen. `Guard` laeuft ueber `kernelCommand("governance.llm-chain", ...)`, und `installUiEvents()` bindet nur Submit- und Click-Events an den Controller.

## Wer darf schreiben?
- Die UI schreibt nur Text in DOM-Elemente.
- `UIController` schreibt nicht direkt in den Kernel-State.
- `GameLogicController` berechnet nur Patches; der Kernel entscheidet ueber den Write.

## Welche Pfade?
- DOM-Targets sind im `elements`-Mapping aus `src/main.js` fest verdrahtet.
- Verwendet werden `#ui-form`, `#action-input`, `#state-input`, `#status-value`, `#summary-value`, `#state-value`, `#guard-value`, `#plan-button`, `#apply-button`, `#refresh-button` und `#guard-button`.
- Die HTML-Struktur stellt genau diese IDs bereit.
- Es gibt keinen direkten Zugriff auf Kernel-Interna aus der UI.

## Code-Referenzen
- `src/ui/UIController.js:57`
- `src/ui/UIController.js:82`
- `src/ui/UIController.js:87`
- `src/ui/UIController.js:116`
- `src/ui/UIController.js:147`
- `src/ui/UIController.js:162`
- `src/ui/UIController.js:192`
- `src/ui/UIController.js:202`
- `src/ui/UIController.js:217`
- `src/ui/UIController.js:235`
- `src/ui/events.js:1`
- `src/main.js:1`
- `src/main.js:10`
- `src/main.js:29`
- `index.html:20`
- `index.html:22`
- `index.html:31`
- `index.html:40`
- `index.html:63`

## Sync
- [ ] Alle Code-Dateien erwaehnt?
- [ ] Alle Whitelists in Code vorhanden?
- [ ] Keine Widersprueche zwischen Docs + Code?
