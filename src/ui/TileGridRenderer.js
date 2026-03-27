import { TileAnimationSDK } from "./TileAnimationSDK.js";

function svgUrl(markup) {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(markup)}")`;
}

const TERRAIN_ASSETS = Object.freeze({
  grass: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#386641"/><rect y="8" width="16" height="8" fill="#2d5a35"/><rect x="2" y="2" width="2" height="2" fill="#6fbf73"/><rect x="8" y="3" width="2" height="2" fill="#7bc47f"/><rect x="12" y="1" width="2" height="2" fill="#93d196"/><rect x="5" y="10" width="2" height="2" fill="#7bc47f"/><rect x="11" y="11" width="2" height="2" fill="#6fbf73"/></svg>'),
  ore: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#5a4636"/><rect y="8" width="16" height="8" fill="#473628"/><rect x="2" y="2" width="3" height="3" fill="#95a3b3"/><rect x="9" y="2" width="4" height="3" fill="#b8c4cf"/><rect x="5" y="7" width="4" height="3" fill="#7e8a97"/><rect x="11" y="10" width="3" height="3" fill="#cfd7de"/><rect x="2" y="11" width="3" height="2" fill="#9eabb8"/></svg>'),
  water: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#2b6cb0"/><rect y="8" width="16" height="8" fill="#1f4f85"/><rect x="1" y="2" width="4" height="1" fill="#9fd3ff"/><rect x="8" y="3" width="5" height="1" fill="#b7e1ff"/><rect x="3" y="6" width="6" height="1" fill="#8ac6ff"/><rect x="10" y="10" width="4" height="1" fill="#9fd3ff"/></svg>'),
  forest: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#355f3a"/><rect y="8" width="16" height="8" fill="#27482c"/><rect x="3" y="3" width="3" height="4" fill="#2f7f3f"/><rect x="10" y="2" width="3" height="5" fill="#3f934e"/><rect x="4" y="7" width="1" height="4" fill="#6c4a2c"/><rect x="11" y="7" width="1" height="4" fill="#6c4a2c"/></svg>')
});

const STRUCTURE_ASSETS = Object.freeze({
  miner: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="10" width="12" height="4" fill="#3b2f2f"/><rect x="3" y="5" width="4" height="5" fill="#f0c674"/><rect x="8" y="3" width="5" height="4" fill="#9fb3c8"/><rect x="10" y="1" width="2" height="3" fill="#d9e2ec"/><rect x="8" y="7" width="2" height="3" fill="#ced7df"/></svg>'),
  storage: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="4" width="12" height="10" fill="#6b4f7a"/><rect x="3" y="5" width="10" height="8" fill="#89659b"/><rect x="6" y="8" width="4" height="5" fill="#d7bfdc"/><rect x="3" y="4" width="10" height="1" fill="#b59cc2"/></svg>'),
  smelter: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="6" width="12" height="8" fill="#3c4958"/><rect x="4" y="3" width="5" height="4" fill="#607487"/><rect x="10" y="2" width="2" height="5" fill="#90a4b5"/><rect x="6" y="9" width="4" height="3" fill="#f28c28"/><rect x="7" y="10" width="2" height="2" fill="#ffe08a"/></svg>')
});

function keyFor(x, y) {
  return `${Math.trunc(x)}:${Math.trunc(y)}`;
}

function getStructureAt(state, x, y) {
  return Array.isArray(state?.structures)
    ? state.structures.find((structure) => structure.x === x && structure.y === y) || null
    : null;
}

export class TileGridRenderer {
  constructor(containerId, width = 8, height = 6, tileSize = 80) {
    const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!container) {
      throw new Error("[TILE_GRID] Container not found.");
    }

    this.container = container;
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.clickCallback = null;
    this.entries = new Map();
    this.animationSdk = null;

    this.stage = document.createElement("div");
    this.stage.className = "tile-grid-stage";

    this.root = document.createElement("div");
    this.root.className = "tile-grid";
    this.root.style.setProperty("--tile-size", `${this.tileSize}px`);
    this.root.style.gridTemplateColumns = `repeat(${this.width}, ${this.tileSize}px)`;
    this.root.style.gridTemplateRows = `repeat(${this.height}, ${this.tileSize}px)`;
    this.root.addEventListener("click", (event) => {
      const tile = event.target?.closest?.(".tile");
      if (!tile || typeof this.clickCallback !== "function") {
        return;
      }
      this.clickCallback({ x: Number(tile.dataset.x), y: Number(tile.dataset.y), event });
    });

    this.overlayCanvas = document.createElement("canvas");
    this.overlayCanvas.className = "tile-grid-canvas";
    this.overlayCanvas.setAttribute("aria-hidden", "true");

    this.stage.append(this.root, this.overlayCanvas);
    this.container.replaceChildren(this.stage);
    this.#buildGrid();
    this.animationSdk = new TileAnimationSDK(this.overlayCanvas, {
      width: this.width,
      height: this.height,
      tileSize: this.tileSize
    });
  }

  onTileClick(callback) {
    this.clickCallback = typeof callback === "function" ? callback : null;
  }

  render(state, selectedTile = null) {
    const tiles = Array.isArray(state?.world?.tiles) ? state.world.tiles : [];

    for (const tile of tiles) {
      const entry = this.entries.get(keyFor(tile.x, tile.y));
      if (!entry) {
        continue;
      }

      const structure = getStructureAt(state, tile.x, tile.y);
      const selected = Boolean(selectedTile)
        && selectedTile.x === tile.x
        && selectedTile.y === tile.y;

      entry.element.className = `tile tile--${tile.terrain}`;
      entry.element.classList.toggle("tile--selected", selected);
      entry.terrain.style.backgroundImage = TERRAIN_ASSETS[tile.terrain] || TERRAIN_ASSETS.grass;

      if (structure) {
        entry.structure.style.backgroundImage = STRUCTURE_ASSETS[structure.type] || "none";
        entry.label.textContent = structure.type === "miner"
          ? "AUTO"
          : structure.type === "smelter"
            ? "5 Erz"
            : "+10";
      } else {
        entry.structure.style.backgroundImage = "none";
        entry.label.textContent = tile.terrain === "ore" ? "ERZ" : tile.terrain.toUpperCase();
      }
    }

    if (this.animationSdk) {
      this.animationSdk.update(state, selectedTile);
    }
  }

  destroy() {
    if (this.animationSdk) {
      this.animationSdk.destroy();
      this.animationSdk = null;
    }
  }

  #buildGrid() {
    const fragment = document.createDocumentFragment();

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "tile tile--grass";
        element.dataset.x = String(x);
        element.dataset.y = String(y);

        const terrain = document.createElement("span");
        terrain.className = "tile__terrain";

        const structure = document.createElement("span");
        structure.className = "tile__structure";

        const shine = document.createElement("span");
        shine.className = "tile__shine";

        const label = document.createElement("span");
        label.className = "tile__label";
        label.textContent = "-";

        element.append(terrain, structure, shine, label);
        fragment.append(element);
        this.entries.set(keyFor(x, y), { element, terrain, structure, label });
      }
    }

    this.root.append(fragment);
  }
}
