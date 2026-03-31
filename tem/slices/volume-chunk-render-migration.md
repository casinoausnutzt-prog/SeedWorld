# Volume-/Chunk-Render-Migration

## Zusammenfassung
Migration vom Tile-basierten zum Volume-/Chunk-basierten Rendering. 12 atomare Tasks: RT-014 bis RT-020 (Weltmodell, Sampler, Compiler, Biome, Renderer, Dirty-System), GOV-008 bis GOV-009 (Preset-Registry, Evidence-Manifest), LEG-003 (Debug-Rolle).

## Kontext
Strategischer Migrationsplan zur Umstellung auf Chunk-basiertes Rendering mit deterministischen Hashes, Governance-Kontrolle und Offscreen-Worker-Architektur.

## Atomare Tasks

### RT-Tasks (Weltmodell & Rendering)

| Task | Titel | Schwere | Dateien | Abhängigkeiten |
|------|-------|---------|---------|----------------|
| [RT-014](./../tasks/open/RT-014.json) | Kanonisches Weltmodell einführen | HIGH | `worldState.js`, `worldGen.js` | - |
| [RT-015](./../tasks/open/RT-015.json) | Hash- und Versionsvertrag | HIGH | `renderFingerprint.js`, `worldHash.js` | RT-014 |
| [RT-016](./../tasks/open/RT-016.json) | WorldGen-Sampler | HIGH | `worldSampler.js` | RT-014 |
| [RT-017](./../tasks/open/RT-017.json) | Block- und Chunk-Compiler | HIGH | `blockCompiler.js`, `chunkCompiler.js` | RT-016 |
| [RT-018](./../tasks/open/RT-018.json) | Biome-Logik auf Blockebene | MEDIUM | Compiler, Contracts | RT-017 |
| [RT-019](./../tasks/open/RT-019.json) | Chunk-Offscreen-Renderer | HIGH | `chunkRenderWorker.js` | GOV-007, RT-017, GOV-008 |
| [RT-020](./../tasks/open/RT-020.json) | Dirty-Chunk-System | MEDIUM | Chunk-State, Worker-Queue | RT-019 |

### GOV-Tasks (Governance & Evidence)

| Task | Titel | Schwere | Dateien | Abhängigkeiten |
|------|-------|---------|---------|----------------|
| [GOV-008](./../tasks/open/GOV-008.json) | Preset-Registry | HIGH | `renderPresets.js` | - |
| [GOV-009](./../tasks/open/GOV-009.json) | Render-Evidence-Manifest | HIGH | `render-manifest.json` | GOV-007, RT-019 |

### LEG-Tasks (Legacy-Migration)

| Task | Titel | Schwere | Dateien | Abhängigkeiten |
|------|-------|---------|---------|----------------|
| [LEG-003](./../tasks/open/LEG-003.json) | TileGridRenderer Debug-Rolle | MEDIUM | `TileGridRenderer.js` | RT-019 |

## Abhängigkeitsgraph

```
RT-014 ─┬─> RT-015 ─┐
        ├─> RT-016 ─┼─> RT-017 ─┬─> RT-018
        │           │           │
GOV-008 ┘           └───────────┼───> GOV-007* ─┬─> RT-019 ─┬─> RT-020
                                │             │           │
                                └─────────────┴─> LEG-003  └─> GOV-009
```

*GOV-007 ist bereits im System (Render-Plan-Gates)

## PR-Reihenfolge

1. **RT-014** - Kanonisches Weltmodell (Foundation)
2. **RT-015 + RT-016** parallel - Hashes und Sampler
3. **RT-017** - Compiler
4. **RT-018** - Biome auf Block-Ebene
5. **GOV-008** - Preset-Registry
6. **RT-019** - Chunk-Renderer
7. **RT-020** - Dirty-System
8. **LEG-003** - Debug-Rolle
9. **GOV-009** - Evidence-Manifest

## Pflichttests

- `chunk-compile-same-seed-same-hash`
- `same-worldHash-same-renderHash`
- `render-plan-deterministic`
- `render-gate-denies-free-camera`
- `render-gate-denies-unknown-preset`
- `chunk-halo-no-seams`
- `tile-grid-hidden-in-production-render`

## Traceability

- **Slice:** `tem/slices/volume-chunk-render-migration.md`
- **Tasks:** `tem/tasks/open/RT-014.json` bis `RT-020.json`, `GOV-008.json`, `GOV-009.json`, `LEG-003.json`
- **Erstellt:** 2026-03-31
