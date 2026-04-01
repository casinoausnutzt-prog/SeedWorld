// @doc-anchor ENGINE-CORE
// CanvasVoxelRenderer – Isometrischer Voxel-Renderer mit Canvas + DOM-Overlay.
// Nutzt 2D Canvas fuer das Zeichnen der Voxel und DOM fuer Interaktionen.

const TERRAIN_COLORS = {
  water:   { top: "#1a6fa8", side1: "#145a8a", side2: "#0e456b" },
  meadow:  { top: "#4a8c3f", side1: "#3a6e31", side2: "#2a4f23" },
  forest:  { top: "#2d6e2a", side1: "#235621", side2: "#193e18" },
  scrub:   { top: "#8a7a3d", side1: "#6d6030", side2: "#504623" },
  steppe:  { top: "#b8a45a", side1: "#918147", side2: "#6a5e34" },
  rock:    { top: "#6b6b6b", side1: "#555555", side2: "#3f3f3f" },
  trees:   { top: "#1e5c1a", side1: "#184915", side2: "#123610" },
  dry:     { top: "#a08840", side1: "#7e6b32", side2: "#5c4e24" },
  dust:    { top: "#c4a855", side1: "#9b8543", side2: "#726231" },
  default: { top: "#555555", side1: "#444444", side2: "#333333" }
};

const RESOURCE_COLORS = {
  ore:  { top: "#c0a060", side1: "#9a804d", side2: "#74603a" },
  coal: { top: "#333333", side1: "#292929", side2: "#1f1f1f" }
};

const STRUCTURE_COLORS = {
  mine:     { top: "#d4a017", side1: "#a98012", side2: "#7f600e" },
  smelter:  { top: "#e05a00", side1: "#b34800", side2: "#863600" },
  conveyor: { top: "#888888", side1: "#6d6d6d", side2: "#525252" }
};

const TERRAIN_HEIGHT = {
  water:   0.3,
  meadow:  1.0,
  forest:  1.0,
  scrub:   0.9,
  steppe:  0.8,
  rock:    1.2,
  trees:   1.0,
  dry:     0.85,
  dust:    0.75,
  default: 1.0
};

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

    // DOM Overlay fuer Interaktion
    this.overlay = document.createElement("div");
    this.overlay.className = "voxel-overlay";
    this.overlay.style.position = "absolute";
    this.overlay.style.top = "0";
    this.overlay.style.left = "0";
    this.overlay.style.width = "100%";
    this.overlay.style.height = "100%";
    this.container.appendChild(this.overlay);

    // Isometrische Parameter
    this.tileW = 64;
    this.tileH = 32;
    this.offsetX = this.width / 2;
    this.offsetY = 100;

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

    const size = gameState?.world?.size || { width: 16, height: 12 };
    const structures = gameState?.structures || {};

    // Tiles sortieren fuer korrektes Painter's Algorithm (von hinten nach vorne)
    const sortedTiles = [...tiles].sort((a, b) => (a.x + a.y) - (b.x + b.y));

    for (const tile of sortedTiles) {
      const x = tile.x;
      const y = tile.y;
      const h = TERRAIN_HEIGHT[tile.terrain] || TERRAIN_HEIGHT[tile.biome] || 1.0;
      const colors = (tile.resource && tile.resource !== "none") 
        ? RESOURCE_COLORS[tile.resource] 
        : (TERRAIN_COLORS[tile.terrain] || TERRAIN_COLORS[tile.biome] || TERRAIN_COLORS.default);

      this._drawVoxel(x, y, 0, h, colors);

      // Struktur zeichnen falls vorhanden
      const struct = structures[`${x},${y}`];
      if (struct) {
        const sColors = STRUCTURE_COLORS[struct.id] || STRUCTURE_COLORS.mine;
        this._drawVoxel(x, y, h, 0.6, sColors);
      }
    }
  }

  _drawVoxel(tx, ty, baseH, height, colors) {
    const { ctx, tileW, tileH, offsetX, offsetY } = this;

    // Isometrische Projektion
    const screenX = offsetX + (tx - ty) * (tileW / 2);
    const screenY = offsetY + (tx + ty) * (tileH / 2) - (baseH * tileH);
    const hPx = height * tileH;

    // 1. Top Face
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - hPx);
    ctx.lineTo(screenX + tileW / 2, screenY - tileH / 2 - hPx);
    ctx.lineTo(screenX, screenY - tileH - hPx);
    ctx.lineTo(screenX - tileW / 2, screenY - tileH / 2 - hPx);
    ctx.closePath();
    ctx.fillStyle = colors.top;
    ctx.fill();

    if (height > 0) {
      // 2. Left Face
      ctx.beginPath();
      ctx.moveTo(screenX - tileW / 2, screenY - tileH / 2 - hPx);
      ctx.lineTo(screenX, screenY - hPx);
      ctx.lineTo(screenX, screenY);
      ctx.lineTo(screenX - tileW / 2, screenY - tileH / 2);
      ctx.closePath();
      ctx.fillStyle = colors.side1;
      ctx.fill();

      // 3. Right Face
      ctx.beginPath();
      ctx.moveTo(screenX, screenY - hPx);
      ctx.lineTo(screenX + tileW / 2, screenY - tileH / 2 - hPx);
      ctx.lineTo(screenX + tileW / 2, screenY - tileH / 2);
      ctx.lineTo(screenX, screenY);
      ctx.closePath();
      ctx.fillStyle = colors.side2;
      ctx.fill();
    }
  }

  _setupClickHandler() {
    this.overlay.addEventListener("click", (e) => {
      if (!this.clickCallback) return;
      const rect = this.container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Inverse isometrische Projektion (vereinfacht)
      const relX = mx - this.offsetX;
      const relY = my - this.offsetY;

      const ty = (relY / (this.tileH / 2) - relX / (this.tileW / 2)) / 2;
      const tx = (relY / (this.tileH / 2) + relX / (this.tileW / 2)) / 2;

      this.clickCallback({ x: Math.floor(tx), y: Math.floor(ty) });
    });
  }

  destroy() {
    this._destroyed = true;
    this.container.removeChild(this.canvas);
    this.container.removeChild(this.overlay);
  }
}
