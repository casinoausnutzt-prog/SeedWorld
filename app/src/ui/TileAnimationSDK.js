function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function structureKey(structure) {
  return `${structure.type}:${structure.x}:${structure.y}`;
}

export class TileAnimationSDK {
  constructor(canvas, { width, height, tileSize }) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.selectedTile = null;
    this.oreTiles = [];
    this.minerTiles = [];
    this.spawnBursts = [];
    this.previousStructures = new Set();
    this.frameHandle = null;
    this.startedAt = performance.now();

    this.resize(width, height, tileSize);
    this.#start();
  }

  resize(width, height, tileSize) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.canvas.width = width * tileSize;
    this.canvas.height = height * tileSize;
    this.canvas.style.width = `${width * tileSize}px`;
    this.canvas.style.height = `${height * tileSize}px`;
  }

  update(state, selectedTile) {
    const worldTiles = Array.isArray(state?.world?.tiles) ? state.world.tiles : [];
    const structures = Array.isArray(state?.structures) ? state.structures : [];

    this.selectedTile = selectedTile || null;
    this.oreTiles = worldTiles.filter((tile) => tile.terrain === "ore");
    this.minerTiles = structures.filter((structure) => structure.type === "miner");

    const currentStructures = new Set(structures.map(structureKey));
    for (const structure of structures) {
      const key = structureKey(structure);
      if (!this.previousStructures.has(key)) {
        this.spawnBursts.push({
          x: structure.x + 0.5,
          y: structure.y + 0.5,
          createdAt: performance.now()
        });
      }
    }
    this.previousStructures = currentStructures;
  }

  destroy() {
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  #start() {
    const loop = (timestamp) => {
      this.#renderFrame(timestamp);
      this.frameHandle = requestAnimationFrame(loop);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  #renderFrame(timestamp) {
    const ctx = this.context;
    if (!ctx) {
      return;
    }

    const elapsed = (timestamp - this.startedAt) / 1000;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const tile of this.oreTiles) {
      const pulse = (Math.sin(elapsed * 2.7 + tile.x * 0.8 + tile.y * 0.5) + 1) / 2;
      const alpha = 0.07 + pulse * 0.1;
      ctx.fillStyle = `rgba(255, 208, 120, ${alpha.toFixed(3)})`;
      ctx.fillRect(tile.x * this.tileSize, tile.y * this.tileSize, this.tileSize, this.tileSize);
    }

    for (const miner of this.minerTiles) {
      const spark = (Math.sin(elapsed * 5 + miner.x * 0.9 + miner.y * 0.6) + 1) / 2;
      const radius = this.tileSize * (0.08 + spark * 0.08);
      ctx.beginPath();
      ctx.fillStyle = "rgba(254, 239, 180, 0.82)";
      ctx.arc(
        (miner.x + 0.5) * this.tileSize,
        (miner.y + 0.22) * this.tileSize,
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    if (this.selectedTile) {
      const pulse = (Math.sin(elapsed * 4) + 1) / 2;
      const inset = 4 + pulse * 3;
      const alpha = 0.45 + pulse * 0.35;
      const x = this.selectedTile.x * this.tileSize + inset;
      const y = this.selectedTile.y * this.tileSize + inset;
      const size = this.tileSize - inset * 2;

      ctx.strokeStyle = `rgba(255, 236, 160, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, size, size);
    }

    const nextBursts = [];
    for (const burst of this.spawnBursts) {
      const ageMs = timestamp - burst.createdAt;
      if (ageMs > 750) {
        continue;
      }
      const progress = clamp(ageMs / 750, 0, 1);
      const radius = this.tileSize * (0.2 + progress * 0.35);
      const alpha = 0.7 * (1 - progress);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(138, 230, 180, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.arc(burst.x * this.tileSize, burst.y * this.tileSize, radius, 0, Math.PI * 2);
      ctx.stroke();
      nextBursts.push(burst);
    }
    this.spawnBursts = nextBursts;
  }
}
