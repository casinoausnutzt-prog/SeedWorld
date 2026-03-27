# Kernel Gates

`KernelController` ist der Write-Gateway fuer den Kernfluss: er liest `domain`, `action`, `state`, `patches`, `actionSchema` und `mutationMatrix`, prueft alles vor dem Patchen und ruft dann `applyPatches` mit dem sanierten State und den sanierten Patches auf. Die Validierung laeuft ueber Domain-Check, Path-Check, Determinismus-Guard, Action-Schema-Check und Unsafe-Data-Checks. Mehrteilige Patch-Sets bekommen einen `confirmationToken`. `applyPatches` selbst liegt in `src/kernel/store/applyPatches.js` und ist die technische Write-Funktion hinter dem Controller.

## Wer darf schreiben?
- Nur `KernelController.execute()` / `KernelController.plan()` / `KernelController.apply()` fuehren den Write-Schritt aus.
- `GameLogicController` und `UIController` liefern nur Eingaben, Kalkulationen oder Anzeige.
- `src/kernel/store/applyPatches.js` schreibt den naechsten State, aber nur nachdem `KernelController` validiert hat.

## Welche Pfade?
- Erlaubte Domains sind die Keys von `input.mutationMatrix`.
- Fuer eine Domain sind nur die Pfade erlaubt, die in `input.mutationMatrix[domain]` stehen.
- Ein Patch-Pfad muss exakt passen oder mit einem erlaubten Prefix weiterlaufen.
- Verboten sind Root-Pfade, `..`, `__proto__`, `prototype`, `constructor`, `eval`, Getter/Setter und nicht-plain Daten.

## Code-Referenzen
- `src/kernel/KernelController.js:14`
- `src/kernel/KernelController.js:36`
- `src/kernel/KernelController.js:39`
- `src/kernel/KernelController.js:44`
- `src/kernel/KernelController.js:50`
- `src/kernel/KernelController.js:58`
- `src/kernel/KernelController.js:69`
- `src/kernel/KernelController.js:80`
- `src/kernel/KernelController.js:89`
- `src/kernel/KernelController.js:110`
- `src/kernel/KernelController.js:137`
- `src/kernel/KernelController.js:152`
- `src/kernel/KernelController.js:159`
- `src/kernel/KernelController.js:177`
- `src/kernel/KernelController.js:216`
- `src/kernel/KernelController.js:242`
- `src/kernel/KernelController.js:269`
- `src/kernel/store/applyPatches.js:194`
- `src/main.js:1`

## Sync
- [ ] Alle Code-Dateien erwaehnt?
- [ ] Alle Whitelists in Code vorhanden?
- [ ] Keine Widersprueche zwischen Docs + Code?
