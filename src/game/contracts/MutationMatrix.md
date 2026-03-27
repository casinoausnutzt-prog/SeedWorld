# Mutation Matrix

## Zweck
Diese Matrix beschreibt, welche State-Pfade der `GameLogicController` fuer die Domain `game` patchen darf.

## Kanonische Whitelist

| Domain | Erlaubte Pfade |
|---|---|
| `game` | `resources.ore`, `resources.copper`, `resources.iron`, `resources.gears`, `machines.miners`, `machines.conveyors`, `machines.assemblers`, `logistics.storageA`, `logistics.storageB`, `meta.lastAction`, `meta.revision` |

## Typed Constraints

| Pfad | Typ | Min | Max | Integer |
|---|---:|---:|---:|---:|
| `resources.ore` | `uint32` | `0` | `999999` | `true` |
| `resources.copper` | `uint32` | `0` | `999999` | `true` |
| `resources.iron` | `uint32` | `0` | `999999` | `true` |
| `resources.gears` | `uint32` | `0` | `999999` | `true` |
| `machines.miners` | `uint16` | `0` | `1024` | `true` |
| `machines.conveyors` | `uint16` | `0` | `4096` | `true` |
| `machines.assemblers` | `uint16` | `0` | `1024` | `true` |
| `logistics.storageA` | `uint32` | `0` | `1000000` | `true` |
| `logistics.storageB` | `uint32` | `0` | `1000000` | `true` |
| `meta.lastAction` | `string` | `0` | `128` | `n/a` |
| `meta.revision` | `uint32` | `0` | `4294967295` | `true` |

## Patch-Regeln
- Ein Patch darf nur die Domain `game` tragen.
- Ein Patch-Pfad muss mit einem der oben gelisteten Pfade beginnen oder exakt darauf zeigen.
- Ungueltige Pfade wie `__proto__`, `prototype`, `constructor` und `eval` sind verboten.
- Root-Container-Replacements sind nicht vorgesehen.

## Controller-Verhalten
- Die Mutation-Matrix ist die technische Grenze fuer alle Game-Patches.
- Der Kernel darf nur schreiben, wenn ein Patch innerhalb dieser Whitelist liegt.
- Der Game-Logic-Controller darf keine Pfade ausserhalb dieser Matrix vorschlagen.
- Typ- und Range-Verletzungen muessen fail-closed mit strukturierten Fehlercodes blockiert werden.

## Ziel-Datei
- `src/game/GameLogicController.js`
- `src/game/contracts/mutationMatrixConstraints.js`
