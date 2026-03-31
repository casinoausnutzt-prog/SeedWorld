// @doc-anchor ENGINE-CORE
export const TICKS_PER_SECOND = 24;
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
export const ORE_PER_MINER_CYCLE = 1;
export const SMELTER_INPUT_ORE = 5;
export const SMELTER_OUTPUT_IRON = 1;
export const BASE_STORAGE_CAPACITY = 10;
export const STORAGE_CAPACITY_BONUS = 10;

function cloneState(state) {
  return structuredClone(state);
}

function getWorldTile(world, x, y) {
  if (!world || typeof world !== "object" || !Array.isArray(world.tiles)) {
    return null;
  }

  const tx = Number(x);
  const ty = Number(y);
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
    return null;
  }

  const width = Number.isInteger(world?.size?.width) ? world.size.width : 0;
  const index = width > 0 ? ty * width + tx : -1;
  const indexed = index >= 0 && index < world.tiles.length ? world.tiles[index] : null;
  if (indexed && Number(indexed.x) === tx && Number(indexed.y) === ty) {
    return indexed;
  }

  return world.tiles.find((tile) => Number(tile?.x) === tx && Number(tile?.y) === ty) || null;
}

export function getStorageCapacity(state) {
  const storagesBuilt = Number.isFinite(state?.stats?.storagesBuilt) ? state.stats.storagesBuilt : 0;
  return BASE_STORAGE_CAPACITY + storagesBuilt * STORAGE_CAPACITY_BONUS;
}

function getStructuresByType(state, type) {
  return Array.isArray(state?.structures)
    ? state.structures.filter((structure) => structure.type === type)
    : [];
}

function mineOre(state) {
  const miners = getStructuresByType(state, "miner").filter((structure) => {
    const tile = getWorldTile(state.world, structure.x, structure.y);
    return tile?.terrain === "ore";
  });

  let ore = Number.isFinite(state.resources?.ore) ? state.resources.ore : 0;
  const capacity = getStorageCapacity(state);
  let mined = 0;

  for (const miner of miners) {
    if (!miner || ore >= capacity) {
      continue;
    }

    const remaining = capacity - ore;
    const delta = Math.min(ORE_PER_MINER_CYCLE, remaining);
    if (delta <= 0) {
      continue;
    }

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

  for (const smelter of smelters) {
    if (!smelter || ore < SMELTER_INPUT_ORE) {
      continue;
    }

    ore -= SMELTER_INPUT_ORE;
    iron += SMELTER_OUTPUT_IRON;
    smelted += SMELTER_OUTPUT_IRON;
  }

  state.resources.ore = ore;
  state.resources.iron = iron;
  state.stats.smeltedTotal += smelted;
  return smelted;
}

function updateStatusText(state, mined, smelted) {
  const statusParts = [
    `Tick ${state.clock.tick}`,
    `${state.clock.secondsElapsed}s`
  ];

  if (mined > 0) {
    statusParts.push(`+${mined} Erz`);
  }
  if (smelted > 0) {
    statusParts.push(`+${smelted} Eisen`);
  }
  if (mined === 0 && smelted === 0) {
    statusParts.push("Automatik wartet");
  }

  state.meta.statusText = statusParts.join(" · ");
  state.meta.summaryText = "Abbauer laufen nur auf Erzfeldern. Schmelzen wandeln 5 Erz automatisch in 1 Eisen.";
}

export function advanceTickState(state, steps = 1) {
  const next = cloneState(state);
  const totalSteps = Math.max(1, Math.trunc(steps) || 1);

  for (let index = 0; index < totalSteps; index += 1) {
    next.clock.tick += 1;
    if (next.clock.tick % TICKS_PER_SECOND === 0) {
      next.clock.secondsElapsed += 1;
      const mined = mineOre(next);
      const smelted = smeltIron(next);
      updateStatusText(next, mined, smelted);
    }
  }

  next.meta.lastAction = "tick";
  return next;
}
