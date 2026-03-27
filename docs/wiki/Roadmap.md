# Roadmap (langfristig)

## Phase 1 (jetzt)

- Patch-Only Kernel stabil
- LLM-Governance stabil
- Tile-Grid UI funktional

## Phase 2

- Erweiterbares Plugin-System für Game-Features
- klarere Action/Mutation-Contracts pro Modul
- bessere Fehlerdiagnose pro Patch

## Phase 3

- Persistente Spielstände mit kompatibler Migration
- Performance-Tuning für größere Grids
- E2E-Tests für komplette Spielabläufe

## Phase 4

- Multiplayer-/Sync-Vorbereitung (optional)
- getrennte Runtime-Prozesse für Sim/Render
- striktere Policy-Automation in CI

## Zielarchitektur (ASCII)

```text
[UI] -> [GameLogic Plugins] -> [KernelController/Gates] -> [State Store]
                                  |
                                  +-> [Governance + Audit + Trace]
```
