# GameLogic SoT

`GameLogicController` wandelt eine Action plus State in Patch-Vorschlaege um. Die Standard-Actions sind `produce`, `consume`, `transport`, `build` und `inspect`. Die Standard-Mutation-Matrix erlaubt nur `game`-Pfade in `resources.*`, `machines.*`, `logistics.*` und `meta.*`. `calculateAction()` prueft Action-Schema und Patch-Matrix und gibt nur Patches zurueck, waehrend `planAction()` und `applyAction()` diese Patches an den injizierten Kernel weiterreichen.

## Wer darf schreiben?
- `GameLogicController` schreibt nicht direkt in den State.
- Der Kernel schreibt erst nach erfolgreicher Pruefung der von `GameLogicController` gelieferten Patches.
- `planAction()` und `applyAction()` sind Wrapper um die Kernel-Schnittstelle.

## Welche Pfade?
- Domain `game` ist die Default-Domain.
- Erlaubt sind die Pfade aus `DEFAULT_MUTATION_MATRIX.game`.
- Diese Pfade sind `resources.ore`, `resources.copper`, `resources.iron`, `resources.gears`, `machines.miners`, `machines.conveyors`, `machines.assemblers`, `logistics.storageA`, `logistics.storageB`, `meta.lastAction` und `meta.revision`.
- Ein Patch darf keine anderen Domains oder Pfade ausgeben.

## Code-Referenzen
- `src/game/GameLogicController.js:1`
- `src/game/GameLogicController.js:3`
- `src/game/GameLogicController.js:21`
- `src/game/GameLogicController.js:89`
- `src/game/GameLogicController.js:122`
- `src/game/GameLogicController.js:144`
- `src/game/GameLogicController.js:152`
- `src/game/GameLogicController.js:194`
- `src/game/GameLogicController.js:252`
- `src/game/GameLogicController.js:266`
- `src/game/GameLogicController.js:304`
- `src/game/GameLogicController.js:326`
- `src/game/GameLogicController.js:343`
- `src/game/GameLogicController.js:358`
- `src/game/GameLogicController.js:374`

## Sync
- [ ] Alle Code-Dateien erwaehnt?
- [ ] Alle Whitelists in Code vorhanden?
- [ ] Keine Widersprueche zwischen Docs + Code?
