// @doc-anchor ENGINE-CORE
// CanvasVoxelRenderer V4 – Erweitertes 8x8 Sub-Tile Rendering mit Konturen und Schatten.
// Nutzt isometrische Projektion mit dynamischer Sättigung für Tiefe.

const TERRAIN_COLORS = {
  water:   { h: 200, s: 70, l: 40 },
  meadow:  { h: 110, s: 50, l: 45 },
  forest:  { h: 120, s: 60, l: 35 },
  rock:    { h: 0,   s: 0,  l: 45 },
  dry:     { h: 45,  s: 40, l: 50 },
  default: { h: 0,   s: 0,  l: 35 }
};

const RESOURCE_COLORS = {
  ore:  { h: 40,  s: 50, l: 60 },
  coal: { h: 0,   s: 0,  l: 20 }
};

const STRUCTURE_COLORS = {
  mine:     { h: 45,  s: 80, l: 50 },
  smelter:  { h: 20,  s: 90, l: 45 },
  conveyor: { h: 0,   s: 0,  l: 55 }
};

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export class CanvasVoxelRenderer {
  constructor(container, options = {}) {
    if (!container) throw new Error("[CANVAS_VOXEL] Container fehlt.");

    this.container = container;
    this.width  = container.clientWidth  || 800;
    this.height = container.clientHeight || 600;
    this.clickCallback = null;
    this._destroyed = false;

    // Canvas Setup
    this.canvas = document.createElement("canvas");
    this.canvas.className = "voxel-canvas";
    this.canvas.width  = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");
    this.container.appendChild(this.canvas);

    // Isometrische Parameter
    this.tileW = 64;
    this.tileH = 32;
    this.subDiv = 8; // 8x8 Sub-Tiles
    this.subW = this.tileW / this.subDiv;
    this.subH = this.tileH / this.subDiv;
    
    this.offsetX = this.width / 2;
    this.offsetY = 150;

    this._setupClickHandler();
  }

  set onTileClick(cb) {
    this.clickCallback = typeof cb === "function" ? cb : null;
  }

  render(gameState, tick) {
    if (this._destroyed) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    const tiles = gameState?.world?.tiles;
    if (!Array.isArray(tiles)) return;

    const structures = gameState?.structures || {};

    // Painter's Algorithm: Sortiere nach Tiefe (x+y)
    const sortedTiles = [...tiles].sort((a, b) => (a.x + a.y) - (b.x + b.y));

    for (const tile of sortedTiles) {
      this._drawTileGroup(tile, structures[`${tile.x},${tile.y}`], tick);
    }
  }

  _drawTileGroup(tile, structure, tick) {
    const { x, y, terrain, resource } = tile;
    const baseColor = TERRAIN_COLORS[terrain] || TERRAIN_COLORS.default;
    
    // Zeichne 8x8 Sub-Tiles für ein Haupt-Tile
    for (let sy = 0; sy < this.subDiv; sy++) {
      for (let sx = 0; sx < this.subDiv; sx++) {
        const subX = x + sx / this.subDiv;
        const subY = y + sy / this.subDiv;
        
        let h = 1.0;
        let color = baseColor;
        
        // Ressourcen-Visualisierung (zentriert im 8x8 Gitter)
        if (resource === "ore" && sx >= 2 && sx <= 5 && sy >= 2 && sy <= 5) {
          color = RESOURCE_COLORS.ore;
          h = 1.2;
        }

        // Struktur-Visualisierung
        if (structure) {
          const sColor = STRUCTURE_COLORS[structure.id] || STRUCTURE_COLORS.mine;
          // Strukturen nehmen den Großteil des 8x8 Platzes ein
          if (sx >= 1 && sx <= 6 && sy >= 1 && sy <= 6) {
            color = sColor;
            h = 1.5 + Math.sin(tick / 10 + sx + sy) * 0.1; // Leichte Animation
          }
        }

        this._drawSubVoxel(subX, subY, 0, h, color);
      }
    }
  }

  _drawSubVoxel(tx, ty, baseH, height, color) {
    const { ctx, tileW, tileH, offsetX, offsetY } = this;

    // Isometrische Projektion für Sub-Tiles
    const screenX = offsetX + (tx - ty) * (tileW / 2);
    const screenY = offsetY + (tx + ty) * (tileH / 2) - (baseH * tileH);
    const hPx = height * (tileH / 2);

    // Dynamische Farben für Schatten und Konturen
    const topColor = hslToHex(color.h, color.s, color.l + 10);
    const side1Color = hslToHex(color.h, color.s - 10, color.l - 10); // Schattenseite 1
    const side2Color = hslToHex(color.h, color.s - 20, color.l - 20); // Schattenseite 2
    const strokeColor = hslToHex(color.h, color.s, color.l - 30); // Kontur

    ctx.lineJoin = "round";
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = strokeColor;

    // 1. Top Face
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - hPx);
    ctx.lineTo(screenX + this.subW / 2, screenY - this.subH / 2 - hPx);
    ctx.lineTo(screenX, screenY - this.subH - hPx);
    ctx.lineTo(screenX - this.subW / 2, screenY - this.subH / 2 - hPx);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.stroke();

    // 2. Left Face
    ctx.beginPath();
    ctx.moveTo(screenX - this.subW / 2, screenY - this.subH / 2 - hPx);
    ctx.lineTo(screenX, screenY - hPx);
    ctx.lineTo(screenX, screenY);
    ctx.lineTo(screenX - this.subW / 2, screenY - this.subH / 2);
    ctx.closePath();
    ctx.fillStyle = side1Color;
    ctx.fill();
    ctx.stroke();

    // 3. Right Face
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - hPx);
    ctx.lineTo(screenX + this.subW / 2, screenY - this.subH / 2 - hPx);
    ctx.lineTo(screenX + this.subW / 2, screenY - this.subH / 2);
    ctx.lineTo(screenX, screenY);
    ctx.closePath();
    ctx.fillStyle = side2Color;
    ctx.fill();
    ctx.stroke();
  }

  _setupClickHandler() {
    this.canvas.addEventListener("click", (e) => {
      if (!this.clickCallback) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const relX = mx - this.offsetX;
      const relY = my - this.offsetY;

      const ty = (relY / (this.tileH / 2) - relX / (this.tileW / 2)) / 2;
      const tx = (relY / (this.tileH / 2) + relX / (this.tileW / 2)) / 2;

      this.clickCallback({ x: Math.floor(tx), y: Math.floor(ty) });
    });
  }

  destroy() {
    this._destroyed = true;
    if (this.canvas.parentNode) {
      this.container.removeChild(this.canvas);
    }
  }
}
