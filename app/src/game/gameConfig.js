// @doc-anchor ENGINE-CORE
// @doc-anchor GAME-CONFIG
//
// Zentrales Konfigurations- und Konstanten-Modul (Merge aus gameConfig + gameConstants).
// Kein separates gameConstants.js mehr.

// ── Tick-Konstanten ───────────────────────────────────────────────────────────
export const TICKS_PER_SECOND = 24;
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND;

// ── Ressourcen-Konstanten ─────────────────────────────────────────────────────
export const ORE_PER_MINER_CYCLE = 1;
export const SMELTER_INPUT_ORE = 5;
export const SMELTER_OUTPUT_IRON = 1;
export const BASE_STORAGE_CAPACITY = 10;
export const STORAGE_CAPACITY_BONUS = 10;

// ── Domain ────────────────────────────────────────────────────────────────────
export const DEFAULT_DOMAIN = "game";

// ── Build-Kosten ──────────────────────────────────────────────────────────────
export const BUILD_COSTS = Object.freeze({
  miner:    { ore: 50 },
  conveyor: { ore: 10 },
  assembler:{ ore: 100 },
  storage:  { ore: 30 }
});

// ── Tile-Output-Labels ────────────────────────────────────────────────────────
export const TILE_OUTPUT_LABELS = Object.freeze({
  ore:    "Erz",
  copper: "Kupfer",
  iron:   "Eisen",
  empty:  "Leer",
  water:  "Wasser"
});

// ── Action-Schema ─────────────────────────────────────────────────────────────
export const DEFAULT_ACTION_SCHEMA = Object.freeze({
  produce:       { required: ["machine", "resource"] },
  consume:       { required: ["machine", "resource", "amount"] },
  build:         { required: ["machine", "x", "y"] },
  transport:     { required: ["from", "to", "resource", "amount"] },
  set_tile_type: { required: ["x", "y", "tileType"] },
  advance_tick:  { required: [] }
});

// ── Mutations-Matrix ──────────────────────────────────────────────────────────
export const DEFAULT_MUTATION_MATRIX = Object.freeze({
  game: ["resources", "machines", "logistics", "world", "meta", "clock", "stats"]
});

// ── Speicher-Kapazitaet ───────────────────────────────────────────────────────
export function getStorageCapacity(state) {
  const storagesBuilt = Number.isFinite(state?.stats?.storagesBuilt) ? state.stats.storagesBuilt : 0;
  return BASE_STORAGE_CAPACITY + storagesBuilt * STORAGE_CAPACITY_BONUS;
}

// ── Tick-Fortschritt ──────────────────────────────────────────────────────────
function cloneState(state) { return structuredClone(state); }

function getWorldTile(world, x, y) {
  if (!world || !Array.isArray(world.tiles)) return null;
  const tx = Number(x), ty = Number(y);
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
  const width = Number.isInteger(world?.size?.width) ? world.size.width : 0;
  const index = width > 0 ? ty * width + tx : -1;
  const indexed = index >= 0 && index < world.tiles.length ? world.tiles[index] : null;
  if (indexed && Number(indexed.x) === tx && Number(indexed.y) === ty) return indexed;
  return world.tiles.find(t => Number(t?.x) === tx && Number(t?.y) === ty) || null;
}

function getStructuresByType(state, type) {
  return Array.isArray(state?.structures) ? state.structures.filter(s => s.type === type) : [];
}

function mineOre(state) {
  const miners = getStructuresByType(state, "miner").filter(s => {
    const tile = getWorldTile(state.world, s.x, s.y);
    return tile?.terrain === "ore";
  });
  let ore = Number.isFinite(state.resources?.ore) ? state.resources.ore : 0;
  const capacity = getStorageCapacity(state);
  let mined = 0;
  for (const miner of miners) {
    if (ore >= capacity) continue;
    const delta = Math.min(ORE_PER_MINER_CYCLE, capacity - ore);
    if (delta <= 0) continue;
    ore += delta;
    mined += delta;
  }
  state.resources.ore = ore;
  state.stats.minedTotal += mined;
  return mined;
}

function smeltIron(state) {
  const smelters = getStructuresByType(state, "smelter");
  let ore = Number.isFinite(state.resources?.ore) ? state.resources.ore : 0;
  let iron = Number.isFinite(state.resources?.iron) ? state.resources.iron : 0;
  let smelted = 0;
  for (const _ of smelters) {
    if (ore < SMELTER_INPUT_ORE) continue;
    ore -= SMELTER_INPUT_ORE;
    iron += SMELTER_OUTPUT_IRON;
    smelted += SMELTER_OUTPUT_IRON;
  }
  state.resources.ore = ore;
  state.resources.iron = iron;
  state.stats.smeltedTotal += smelted;
  return smelted;
}

export function advanceTickState(state, steps = 1) {
  const next = cloneState(state);
  const totalSteps = Math.max(1, Math.trunc(steps) || 1);
  for (let i = 0; i < totalSteps; i += 1) {
    next.clock.tick += 1;
    if (next.clock.tick % TICKS_PER_SECOND === 0) {
      next.clock.secondsElapsed += 1;
      mineOre(next);
      smeltIron(next);
    }
  }
  next.meta.lastAction = "tick";
  return next;
}
