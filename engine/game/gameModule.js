// @doc-anchor ENGINE-GAME-MODULE
// @mut-point MUT-GAME-REDUCE
//
// Referenz-Game-Modul fuer die Engine.
// Exportiert den Vertrag, den jedes Game-Modul erfuellen muss:
//   domain, actionSchema, mutationMatrix, createInitialState, reduce
//
// Basiert auf dem bestehenden SeedWorld-Gameplay (Ressourcen, Maschinen, Welt).

export const domain = "game";

export const actionSchema = Object.freeze({
  produce: { required: ["resource", "amount"] },
  consume: { required: ["resource", "amount"] },
  transport: { required: ["from", "to", "amount"] },
  build: { required: ["machine", "count"] },
  inspect: { required: [] },
  set_tile_type: { required: ["x", "y", "tileType"] },
  generate_world: { required: ["seed"] },
  advance_tick: { required: [] }
});

export const mutationMatrix = Object.freeze({
  game: [
    "resources",
    "statistics",
    "machines",
    "logistics",
    "world",
    "clock"
  ]
});

// -- Biome-Generierung (deterministisch ueber RNG) ---------------------------

const BIOMES = Object.freeze(["grass", "forest", "mountain", "water", "desert", "swamp"]);
const BIOME_WEIGHTS = Object.freeze([30, 25, 15, 10, 10, 10]);

function pickBiome(rng) {
  const total = BIOME_WEIGHTS.reduce((s, w) => s + w, 0);
  let roll = rng.nextInt(0, total - 1);
  for (let i = 0; i < BIOMES.length; i += 1) {
    roll -= BIOME_WEIGHTS[i];
    if (roll < 0) return BIOMES[i];
  }
  return BIOMES[0];
}

function generateTiles(rng, width, height) {
  const tiles = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({
        x,
        y,
        biome: pickBiome(rng),
        elevation: rng.nextInt(0, 100)
      });
    }
  }
  return tiles;
}

// -- Initial State -----------------------------------------------------------

export function createInitialState(seed, rng) {
  const width = 16;
  const height = 12;
  const tiles = generateTiles(rng, width, height);

  return {
    clock: { tick: 0 },
    resources: {
      ore: 0,
      copper: 0,
      iron: 0,
      gears: 0
    },
    machines: {
      miners: 0,
      conveyors: 0,
      assemblers: 0
    },
    logistics: {
      storageA: 0,
      storageB: 0
    },
    statistics: {
      totalProduced: 0,
      totalConsumed: 0,
      totalTransported: 0,
      machinesBuilt: 0,
      ticksAdvanced: 0
    },
    world: {
      seed,
      size: { width, height },
      tiles,
      meta: {
        generatorId: "engine-v2-worldgen",
        tileCount: tiles.length
      }
    }
  };
}

// -- Reducer (rein, deterministisch) ------------------------------------------

export function reduce(state, action, rng) {
  const type = action.type;
  const payload = action.payload || {};

  switch (type) {
    case "produce":
      return reduceProduction(state, payload);
    case "consume":
      return reduceConsumption(state, payload);
    case "transport":
      return reduceTransport(state, payload);
    case "build":
      return reduceBuild(state, payload);
    case "inspect":
      return state;
    case "set_tile_type":
      return reduceSetTileType(state, payload);
    case "generate_world":
      return reduceGenerateWorld(state, payload, rng);
    case "advance_tick":
      return reduceAdvanceTick(state, rng);
    default:
      throw new Error(`[GAME_MODULE] Unbekannte Action: ${type}`);
  }
}

// -- Einzelne Reducer --------------------------------------------------------

function reduceProduction(state, payload) {
  const resource = String(payload.resource);
  const amount = toPositiveInt(payload.amount, "amount");
  assertResource(resource);
  const current = Number(state.resources[resource]) || 0;
  return {
    ...state,
    resources: { ...state.resources, [resource]: current + amount },
    statistics: { ...state.statistics, totalProduced: (state.statistics.totalProduced || 0) + amount }
  };
}

function reduceConsumption(state, payload) {
  const resource = String(payload.resource);
  const amount = toPositiveInt(payload.amount, "amount");
  assertResource(resource);
  const current = Number(state.resources[resource]) || 0;
  if (current < amount) {
    throw new Error(`[GAME_MODULE] Nicht genug ${resource}: benoetigt ${amount}, vorhanden ${current}.`);
  }
  return {
    ...state,
    resources: { ...state.resources, [resource]: current - amount },
    statistics: { ...state.statistics, totalConsumed: (state.statistics.totalConsumed || 0) + amount }
  };
}

function reduceTransport(state, payload) {
  const from = String(payload.from);
  const to = String(payload.to);
  const amount = toPositiveInt(payload.amount, "amount");
  assertStorage(from);
  assertStorage(to);
  const fromVal = Number(state.logistics[from]) || 0;
  if (fromVal < amount) {
    throw new Error(`[GAME_MODULE] Nicht genug in ${from}: benoetigt ${amount}, vorhanden ${fromVal}.`);
  }
  const toVal = Number(state.logistics[to]) || 0;
  return {
    ...state,
    logistics: { ...state.logistics, [from]: fromVal - amount, [to]: toVal + amount },
    statistics: { ...state.statistics, totalTransported: (state.statistics.totalTransported || 0) + amount }
  };
}

function reduceBuild(state, payload) {
  const machine = String(payload.machine);
  const count = toPositiveInt(payload.count, "count");
  assertMachine(machine);
  const key = machineKey(machine);
  const current = Number(state.machines[key]) || 0;
  return {
    ...state,
    machines: { ...state.machines, [key]: current + count },
    statistics: { ...state.statistics, machinesBuilt: (state.statistics.machinesBuilt || 0) + count }
  };
}

function reduceSetTileType(state, payload) {
  const x = toInt(payload.x, "x");
  const y = toInt(payload.y, "y");
  const tileType = String(payload.tileType);
  const tiles = state.world.tiles.map((tile) => {
    if (tile.x === x && tile.y === y) {
      return { ...tile, biome: tileType };
    }
    return tile;
  });
  return {
    ...state,
    world: { ...state.world, tiles }
  };
}

function reduceGenerateWorld(state, payload, rng) {
  const width = state.world.size.width;
  const height = state.world.size.height;
  const tiles = generateTiles(rng, width, height);
  return {
    ...state,
    world: {
      ...state.world,
      seed: payload.seed,
      tiles,
      meta: { ...state.world.meta, tileCount: tiles.length }
    }
  };
}

function reduceAdvanceTick(state, rng) {
  const tick = (state.clock.tick || 0) + 1;
  // Miner-Produktion: jeder Miner erzeugt 1 ore pro Tick
  const miners = Number(state.machines.miners) || 0;
  const oreGain = miners;
  const ore = (Number(state.resources.ore) || 0) + oreGain;
  return {
    ...state,
    clock: { ...state.clock, tick },
    resources: { ...state.resources, ore },
    statistics: {
      ...state.statistics,
      ticksAdvanced: (state.statistics.ticksAdvanced || 0) + 1,
      totalProduced: (state.statistics.totalProduced || 0) + oreGain
    }
  };
}

// -- Validierungshelfer -------------------------------------------------------

const VALID_RESOURCES = new Set(["ore", "copper", "iron", "gears"]);
const VALID_STORAGE = new Set(["storageA", "storageB"]);
const VALID_MACHINES = new Set(["miner", "conveyor", "assembler"]);

function assertResource(r) {
  if (!VALID_RESOURCES.has(r)) throw new Error(`[GAME_MODULE] Unbekannte Resource: ${r}`);
}
function assertStorage(s) {
  if (!VALID_STORAGE.has(s)) throw new Error(`[GAME_MODULE] Unbekannter Storage-Slot: ${s}`);
}
function assertMachine(m) {
  if (!VALID_MACHINES.has(m)) throw new Error(`[GAME_MODULE] Unbekannte Maschine: ${m}`);
}
function machineKey(m) {
  if (m === "miner") return "miners";
  if (m === "conveyor") return "conveyors";
  if (m === "assembler") return "assemblers";
  throw new Error(`[GAME_MODULE] Unbekannte Maschine: ${m}`);
}
function toPositiveInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`[GAME_MODULE] ${label} muss eine positive ganze Zahl sein.`);
  return n;
}
function toInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error(`[GAME_MODULE] ${label} muss eine ganze Zahl sein.`);
  return n;
}
