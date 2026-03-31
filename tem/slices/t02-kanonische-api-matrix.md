# T02 Kanonische API-Matrix

## Ziel
Fuer jedes Feature genau einen kanonischen Primaerpfad festziehen. Keine zweite Geometriequelle, kein heimlicher DOM-Shortcut, kein stiller Fallback als Ausrede.

## Basis
- Zielbild: `tem/cf-001-architektur-notiz.md`
- Aktuelle Runtime: `app/src/main.js`
- Reports: `tem/reported-bugs.md`, `tem/test-evidence-report.md`, `tem/langfristiger-bug-plan.md`

## Status-Hinweis
Diese Tabelle ist jetzt Planungsrest statt Live-Beschreibung. Mehrere fruehere Legacy-Pfade sind bereits entfernt:
- `app/src/plugins/radialBuildController.js` ist geloescht.
- `app/src/ui/GameUIController.js` ist geloescht.
- `app/public/game.html` enthaelt keinen separaten Overlay-/Fallback-Pfad mehr.
- `app/src/ui/UIController.js` ist auf den aktiven Spielpfad reduziert.

## Target-API-Matrix

| Feature | kanonischer Pfad | Legacy-Pfad | Migrationsschritt | Verifikation |
|---|---|---|---|---|
| Viewport-Snapshot / Resize | `app/src/ui/RenderManager.js#state.viewport`, `#subscribe()`, `#getSnapshot()` | `app/src/ui/ViewportManager.js#start()` als reine Event-Quelle | `ViewportManager` bleibt nur Browser-Adapter; Spielpfad liest den Snapshot ueber `RenderManager`. | Resize-Test muss bis `TileGridRenderer.onViewportChange()` durchlaufen; `npm run check:required` plus Browser-Smoke. |
| Grid-Bounds / Tile-Size | `RenderManager.state.gridBounds`, `RenderManager.state.tileSize`, `RenderManager.setGrid(...)` | fruehere Parallelpfade in geloeschten UI-/Render-Resten | Grid-Metrik einmalig aus World-State und `RenderManager` ableiten. | Resync-Test fuer `setGrid()` und aktiven Renderpfad. |
| World -> Screen | `RenderManager.worldToScreen(x, y)` | keine aktive Konkurrenz mehr | Bei neuen Overlays nur diesen Pfad verwenden. | Overlay-Visuals duerfen keine zweite Geometriequelle einfuehren. |
| Screen -> Tile Hit-Test | `RenderManager.screenToTile(px, py)` | DOM-Rect-Hit-Tests in alten, inzwischen geloeschten Pfaden | Neue Eingabepfade duerfen keine DOM-Geometrie als Wahrheitsquelle einfuehren. | Edge-/Corner-Smoke fuer Pointer-Hits. |
| World-Render-Parameter / Terrain-Sync | `RenderManager.getSnapshot().gridBounds` und `tileSize` | entfernte Worker-/Fallback-Pfade | Kein zweiter Terrain-/Bootstrap-Pfad mehr. | Browser-Ansicht bleibt auf einen Renderpfad reduziert. |

## Abschlussregel
Wenn ein Feature keinen eindeutigen kanonischen Pfad hat, ist die Spezifikation noch nicht fertig. Dann wird nicht migriert, sondern erst geklaert.
