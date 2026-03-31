# Bug Review Canvas-Render-Phase

## Zusammenfassung
Code Review der Canvas-Render-Refactor Phase. Fünf Bugs identifiziert: Kritischer Runtime-Fehler (path.sep), funktionale Regression (Click-Events), Resource Leak (RAF), ID-Kollision (Audit Trail), und Rendering-Qualität (High-DPI).

## Kontext
Review von main* Branch vs main (c3b9b6fcaf3e5784932813b67f4945d12e008cc2). Änderungen in:
- `app/server/appServer.mjs` (shutdown race condition fix - positiv)
- `app/server/staticHandler.mjs` (path traversal security fix)
- `app/src/game/gameInput.js` (error logging improvement)
- `app/src/kernel/GateManager.js` (audit counter refactor)
- `app/src/kernel/KernelController.js` (governanceAuditTrail cleanup)
- `app/src/ui/TileGridRenderer.js` (canvas-based rendering refactor)
- `app/src/ui/UIController.js` (cleanup on destroy)
- `app/src/ui/ViewportManager.js` (RAF cleanup removed)

## Atomare Tasks

### Phase 1: Kritische Fixes (Sofort)

| Task | Titel | Schwere | Datei | Blocker |
|------|-------|---------|-------|---------|
| [BUG-005](./../tasks/open/BUG-005.json) | Missing path import in staticHandler.mjs | **HIGH** | `app/server/staticHandler.mjs` | Server crash |
| [BUG-006](./../tasks/open/BUG-006.json) | Canvas event handling broken in TileGridRenderer.js | **HIGH** | `app/src/ui/TileGridRenderer.js` | UI broken |

### Phase 2: Stabilität (Nach Phase 1)

| Task | Titel | Schwere | Datei | Blocker |
|------|-------|---------|-------|---------|
| [BUG-007](./../tasks/open/BUG-007.json) | RAF resource leak in ViewportManager.js | **MEDIUM** | `app/src/ui/ViewportManager.js` | Memory leak |
| [BUG-008](./../tasks/open/BUG-008.json) | Audit ID collision in GateManager.js | **MEDIUM** | `app/src/kernel/GateManager.js` | Audit trail |

### Phase 3: Qualität (Nach Phase 2)

| Task | Titel | Schwere | Datei | Blocker |
|------|-------|---------|-------|---------|
| [BUG-009](./../tasks/open/BUG-009.json) | Canvas blurry on high-DPI displays | **LOW** | `app/src/ui/TileGridRenderer.js` | Visual quality |

## Implementierungsplan

### Step 1: BUG-005 (15 min)
**Ziel:** Fix ReferenceError bei path.sep

```javascript
// Vorher (broken):
import { extname, resolve } from 'node:path';
// ...
return normalizedCandidate.startsWith(normalizedParent + path.sep);

// Nachher (fixed):
import { extname, resolve, sep } from 'node:path';
// ...
return normalizedCandidate.startsWith(normalizedParent + sep);
```

**Validierung:**
- `npm test`
- Path-Traversal-Test: `GET /src/../package.json` muss 404 liefern

### Step 2: BUG-006 (30 min)
**Ziel:** Click-Events auf Canvas wiederherstellen

```javascript
// In constructor nach Canvas-Erstellung:
this.canvas.addEventListener('click', (event) => {
  const rect = this.canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / this.tileSize);
  const y = Math.floor((event.clientY - rect.top) / this.tileSize);
  
  if (typeof this.clickCallback !== 'function') return;
  
  const entry = this.getTileAt(x, y);
  if (!entry) return;
  
  this.clickCallback({ tile: entry.data, x, y, event });
});
```

**Validierung:**
- Manueller Test: Klick auf Tile in game.html
- Event-Callback wird mit korrekten x/y aufgerufen

### Step 3: BUG-007 (10 min)
**Ziel:** RAF-Cancellation in destroy() wiederherstellen

```javascript
destroy() {
  // RAF-Cancellation muss vor Listener-Removal erfolgen
  if (this.frameHandle && this.source?.cancelAnimationFrame) {
    this.source.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }
  
  if (this.source && this.started) {
    this.source.removeEventListener('resize', this.onResizeBound);
    this.source.removeEventListener('orientationchange', this.onResizeBound);
  }
  // ...
}
```

**Validierung:**
- Repeated create/destroy cycles ohne Memory Leak
- `npm test`

### Step 4: BUG-008 (15 min)
**Ziel:** Globale Audit-ID-Eindeutigkeit

**Option A (Empfohlen):** Module-level counter zurückführen
```javascript
// Außerhalb der Klasse:
let auditCounter = 0;
function createAuditId() {
  auditCounter += 1;
  return `audit-${String(auditCounter).padStart(8, '0')}`;
}
```

**Option B:** Instanz-ID-Präfix
```javascript
#createAuditId() {
  this.#auditCounter += 1;
  return `audit-${this.#instanceId}-${String(this.#auditCounter).padStart(8, '0')}`;
}
```

**Validierung:**
- Multi-Instanz-Test: Zwei GateManager erzeugen, Audit-IDs müssen eindeutig sein

### Step 5: BUG-009 (20 min)
**Ziel:** High-DPI Support für Canvas

```javascript
#resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  this.canvas.width = this.width * this.tileSize * dpr;
  this.canvas.height = this.height * this.tileSize * dpr;
  this.ctx.scale(dpr, dpr);
  // CSS-Größe bleibt unverändert (Device-Independent-Pixels)
  this.canvas.style.width = `${this.width * this.tileSize}px`;
  this.canvas.style.height = `${this.height * this.tileSize}px`;
}
```

**Validierung:**
- Scharfe Darstellung auf Retina/High-DPI Displays
- Keine Regression auf Standard-Displays (dpr=1)

## Abhängigkeiten

```
BUG-005 ─┬─> BUG-006 ─┬─> BUG-007
         │            │
         └─> BUG-008 ─┴─> BUG-009
```

- BUG-005 und BUG-006 können parallel bearbeitet werden (unterschiedliche Dateien)
- BUG-007, BUG-008, BUG-009 sind unabhängig voneinander
- Empfohlene Reihenfolge: 005 → 006 → 007 → 008 → 009 (nach Schweregrad)

## Positive Änderungen (Documentation)

| Datei | Änderung | Bewertung |
|-------|----------|-----------|
| `appServer.mjs` | `isClosing` Flag für Race-Condition-Schutz | Gut |
| `staticHandler.mjs` | Case-Normalisierung für Path-Traversal | Gut (aber BUG-005 fixen) |
| `gameInput.js` | Error logging statt silent catch | Gut |
| `KernelController.js` | Governance audit trail cleanup | Gut |
| `UIController.js` | Cleanup on destroy | Gut |

## Traceability

- Tasks: `tem/tasks/open/BUG-005.json` bis `BUG-009.json`
- Diese Slice: `tem/slices/bug-review-canvas-render-phase.md`
- Scope: Canvas-Render-Refactor in main* Branch
- Review Datum: 2026-03-31
- Reviewer: Cascade / Code Review

## Validierung nach Implementierung

```bash
# 1. Schema-Sync
npm run tem:sync

# 2. Verification
npm run tem:verify

# 3. Required Checks
npm run check:required

# 4. Tests
npm test

# 5. Manuelle Tests
# - Klick auf Tiles in game.html
# - Server Path-Traversal-Test
# - High-DPI Display Test (falls verfügbar)
```
