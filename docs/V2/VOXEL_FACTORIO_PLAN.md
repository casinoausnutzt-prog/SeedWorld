# Voxel Factorio Light MVP - Architekturplan

## 1. Zielsetzung
Entwicklung eines Browser-basierten Voxel-Spiels (Factorio Light) als MVP. Die bestehende Architektur von SeedWorld (Kernel, GameLogicController, UIController) soll beibehalten und lediglich umstrukturiert werden, um eine 3D-Voxel-Ansicht anstelle der 2D-Tile-Grid-Ansicht zu bieten.

## 2. Beibehaltene Architektur (Truth Layers)
- **Kernel Core (`app/src/kernel/KernelController.js`)**: Bleibt die Single Source of Truth für den deterministischen Spielzustand.
- **Game Logic (`app/src/game/GameLogicController.js`)**: Verarbeitet weiterhin Aktionen (Bauen, Abbauen, Transport).
- **World Generation (`app/src/game/worldGen.js`)**: Generiert weiterhin die deterministische Welt (Seed, Size, Tiles), die nun als Basis für die 3D-Voxel-Generierung dient.
- **UI Controller (`app/src/ui/UIController.js`)**: Orchestriert weiterhin den Render-Loop und die Tick-Updates.

## 3. Umstrukturierung für Voxel-Optik
- **Ersatz des Renderers**: `TileGridRenderer.js` (2D Canvas/DOM) wird durch einen neuen `VoxelRenderer.js` ersetzt, der Three.js nutzt.
- **3D-Welt-Repräsentation**: Die 2D-Tiles aus `worldGen.js` werden in 3D-Voxel (Würfel) übersetzt.
  - `water` -> Blaue Voxel (tieferliegend)
  - `meadow`, `forest` -> Grüne Voxel
  - `ore`, `coal` -> Graue/Schwarze Voxel mit Textur
- **Strukturen (Maschinen)**:
  - `mine` -> 3D-Modell/Voxel-Konstrukt auf Erz-Voxeln.
  - `smelter` -> 3D-Modell/Voxel-Konstrukt.
  - `conveyor` -> Flache 3D-Voxel-Pfade, die Ressourcen transportieren.

## 4. Factorio-Mechaniken (MVP)
- **Ressourcen**: Erz (Ore), Kohle (Coal), Eisen (Iron).
- **Maschinen**:
  - **Miner**: Baut automatisch Ressourcen auf dem darunterliegenden Voxel ab.
  - **Smelter**: Schmilzt Erz zu Eisen.
  - **Conveyor**: Transportiert Items zwischen Maschinen.
- **Interaktion**: Raycasting in Three.js, um Voxel anzuklicken und Maschinen zu platzieren.

## 5. Implementierungsschritte
1. **Three.js Integration**: `VoxelRenderer.js` erstellen und in `UIController.js` einbinden.
2. **Welt-Rendering**: Die generierten Tiles in Three.js-Meshes (InstancedMesh für Performance) umwandeln.
3. **Kamera & Steuerung**: OrbitControls oder isometrische Kamera für die Factorio-Perspektive.
4. **Maschinen-Rendering**: Platzierte Strukturen aus dem `KernelController`-State in 3D rendern.
5. **UI-Overlay**: HTML/CSS-Overlay für Bau-Menü und Ressourcen-Anzeige beibehalten/anpassen.
