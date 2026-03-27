export const WORLD_WIDTH = 8;
export const WORLD_HEIGHT = 6;

const ORE_KEYS = new Set([
  "1:1",
  "2:1",
  "5:1",
  "6:1",
  "1:3",
  "2:3",
  "5:4",
  "6:4"
]);

const WATER_KEYS = new Set([
  "0:0",
  "1:0",
  "6:5",
  "7:5"
]);

const FOREST_KEYS = new Set([
  "3:0",
  "4:0",
  "3:5",
  "4:5",
  "0:4",
  "7:1"
]);

function tileKey(x, y) {
  return `${Math.trunc(x)}:${Math.trunc(y)}`;
}

function terrainFor(x, y) {
  const key = tileKey(x, y);
  if (ORE_KEYS.has(key)) {
    return "ore";
  }
  if (WATER_KEYS.has(key)) {
    return "water";
  }
  if (FOREST_KEYS.has(key)) {
    return "forest";
  }
  return "grass";
}

function makeTile(x, y) {
  const terrain = terrainFor(x, y);
  return {
    x,
    y,
    terrain,
    resourceType: terrain === "ore" ? "ore" : null,
    buildable: terrain !== "water"
  };
}

export function createDefaultWorldMap() {
  const tiles = [];
  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      tiles.push(makeTile(x, y));
    }
  }

  return {
    id: "standard-pixel-basin",
    name: "Pixel Basin",
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    tiles
  };
}

export function getWorldTile(world, x, y) {
  if (!world || !Array.isArray(world.tiles)) {
    return null;
  }
  return world.tiles.find((tile) => tile.x === x && tile.y === y) || null;
}
