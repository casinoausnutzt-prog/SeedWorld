// @doc-anchor ENGINE-CORE
// @doc-anchor KERNEL-CONTROLLER
//
// KernelController – Bruecke zwischen UI/GameLogic und dem deterministischen Kernel.
// Bietet eine asynchrone API fuer Actions und verwaltet den lokalen State-Snapshot.

import { withDeterminismGuards } from "../../engine/kernel/runtimeGuards.js";

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(o) {
  return o !== null && typeof o === "object" && Object.getPrototypeOf(o) === Object.prototype;
}

function assert(condition, message) {
  if (!condition) throw new Error(`[KERNEL_CONTROLLER] ${message}`);
}

function deriveSeedSignature(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return `sig-${Math.abs(hash).toString(16)}`;
}

// Struktur-Kosten (Zentral definiert fuer Voxel-MVP)
const STRUCTURE_COSTS = {
  mine:     { ore: 100 },
  smelter:  { ore: 200 },
  conveyor: { ore: 20 }
};

function runProductionTick(state) {
  const structures = state.structures || {};
  const resources = { ...(state.resources || {}) };
  const statistics = { ...(state.statistics || {}) };

  // 1. Minen produzieren Erz
  const mines = Object.values(structures).filter(s => s?.id === "mine");
  const oreGain = mines.length;
  resources.ore = (Number(resources.ore) || 0) + oreGain;
  statistics.totalOreProduced = (Number(statistics.totalOreProduced) || 0) + oreGain;

  // 2. Schmelzoefen verarbeiten Erz zu Eisen (5 Erz -> 1 Eisen)
  const smelters = Object.values(structures).filter(s => s?.id === "smelter");
  const maxIronFromOre = Math.floor(resources.ore / 5);
  const ironGain = Math.min(smelters.length, maxIronFromOre);
  
  if (ironGain > 0) {
    resources.ore -= (ironGain * 5);
    resources.iron = (Number(resources.iron) || 0) + ironGain;
    statistics.totalIronProduced = (Number(statistics.totalIronProduced) || 0) + ironGain;
  }

  return { ...state, resources, statistics };
}

const ACTION_HANDLERS = {
  "game.generate_world": (ctx, action) => {
    const seed = typeof action.payload?.seed === "string" ? action.payload.seed : ctx.seed;
    const width = Number.isInteger(action.payload?.width) ? action.payload.width : 16;
    const height = Number.isInteger(action.payload?.height) ? action.payload.height : 12;
    
    // Einfache deterministische Weltgenerierung fuer den Browser-Pfad
    const tiles = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const noise = (Math.abs(Math.sin(x * 12.9898 + y * 78.233 + deriveSeedSignature(seed).length)) * 43758.5453) % 1;
        let terrain = "meadow";
        let resource = "none";
        
        if (noise < 0.1) terrain = "water";
        else if (noise < 0.2) terrain = "forest";
        else if (noise < 0.25) { terrain = "rock"; resource = "ore"; }
        else if (noise < 0.3) { terrain = "dry"; resource = "coal"; }
        
        tiles.push({ x, y, terrain, resource });
      }
    }

    return {
      world: { seed, size: { width, height }, tiles },
      clock: { tick: 0 },
      resources: { ore: 0, iron: 0 },
      structures: {},
      statistics: {
        totalTicks: 0,
        structuresBuilt: 0,
        totalOreProduced: 0,
        totalIronProduced: 0,
        seedSignature: deriveSeedSignature(seed)
      }
    };
  },

  "game.advanceTick": (ctx, action) => {
    assert(isPlainObject(action.state), "[ADVANCE_TICK] state fehlt.");
    let state = action.state;
    const ticks = Number.isInteger(action.ticks) && action.ticks > 0 ? action.ticks : 1;

    for (let i = 0; i < ticks; i++) {
      const currentTick = (Number(state.clock?.tick) || 0) + 1;
      state = {
        ...state,
        clock: { ...state.clock, tick: currentTick },
        statistics: {
          ...state.statistics,
          totalTicks: (Number(state.statistics?.totalTicks) || 0) + 1
        }
      };
      state = runProductionTick(state);
    }

    ctx.currentTick = Number(state.clock?.tick) || 0;
    return state;
  },

  "game.inspectTile": (_ctx, action) => {
    assert(isPlainObject(action.state), "[INSPECT_TILE] state fehlt.");
    const x = Number.isInteger(action.x) ? action.x : 0;
    const y = Number.isInteger(action.y) ? action.y : 0;
    const tiles = Array.isArray(action.state.world?.tiles) ? action.state.world.tiles : [];
    const tile = tiles.find(t => t?.x === x && t?.y === y) || null;
    const structKey = `${x},${y}`;
    const structure = action.state.structures?.[structKey] || null;
    return { x, y, tile, structure };
  },

  "game.getBuildOptions": (_ctx, action) => {
    assert(isPlainObject(action.state), "[GET_BUILD_OPTIONS] state fehlt.");
    const ore = Number(action.state.resources?.ore) || 0;
    return [
      {
        id: "mine",
        name: "Mine",
        description: "Baut Erz auf Ressourcen-Feldern ab",
        icon: "⛏",
        cost: STRUCTURE_COSTS.mine,
        canAfford: ore >= STRUCTURE_COSTS.mine.ore,
        requiresTile: ["rock"]
      },
      {
        id: "smelter",
        name: "Schmelzofen",
        description: "Schmilzt Erz zu Eisen (5 Erz → 1 Eisen)",
        icon: "🔥",
        cost: STRUCTURE_COSTS.smelter,
        canAfford: ore >= STRUCTURE_COSTS.smelter.ore,
        requiresTile: null
      },
      {
        id: "conveyor",
        name: "Förderband",
        description: "Verbindet Maschinen",
        icon: "➡",
        cost: STRUCTURE_COSTS.conveyor,
        canAfford: ore >= STRUCTURE_COSTS.conveyor.ore,
        requiresTile: null
      }
    ];
  },

  "game.placeStructure": (_ctx, action) => {
    assert(isPlainObject(action.state), "[PLACE_STRUCTURE] state fehlt.");
    const state = action.state;
    const x = Number.isInteger(action.x) ? action.x : 0;
    const y = Number.isInteger(action.y) ? action.y : 0;
    const structureId = typeof action.structureId === "string" ? action.structureId.trim() : "";
    assert(structureId, "[PLACE_STRUCTURE] structureId fehlt.");
    
    const tiles = Array.isArray(state.world?.tiles) ? state.world.tiles : [];
    const tile = tiles.find(t => t?.x === x && t?.y === y);
    assert(tile, `[PLACE_STRUCTURE] Tile nicht gefunden: ${x},${y}`);
    
    const cost = STRUCTURE_COSTS[structureId];
    assert(cost, `[PLACE_STRUCTURE] Unbekannte Struktur: ${structureId}`);
    
    const ore = Number(state.resources?.ore) || 0;
    assert(ore >= cost.ore, `[PLACE_STRUCTURE] Nicht genug Erz: benoetigt ${cost.ore}, vorhanden ${ore}`);

    if (structureId === "mine") {
      assert(tile.resource !== "none", "[PLACE_STRUCTURE] Mine kann nur auf Ressourcen-Feldern gebaut werden.");
    }
    
    const existingKey = `${x},${y}`;
    assert(!state.structures?.[existingKey], `[PLACE_STRUCTURE] Bereits eine Struktur auf ${x},${y}`);

    const structures = { 
      ...(state.structures || {}), 
      [existingKey]: { 
        id: structureId, 
        builtAt: Number(state.clock?.tick) || 0,
        x, y
      } 
    };

    return {
      ...state,
      structures,
      resources: { ...state.resources, ore: ore - cost.ore },
      statistics: { ...state.statistics, structuresBuilt: (Number(state.statistics?.structuresBuilt) || 0) + 1 }
    };
  },

  "game.removeStructure": (_ctx, action) => {
    assert(isPlainObject(action.state), "[REMOVE_STRUCTURE] state fehlt.");
    const state = action.state;
    const x = Number.isInteger(action.x) ? action.x : 0;
    const y = Number.isInteger(action.y) ? action.y : 0;
    const key = `${x},${y}`;
    assert(state.structures?.[key], `[REMOVE_STRUCTURE] Keine Struktur auf ${x},${y}`);

    const structures = { ...(state.structures || {}) };
    delete structures[key];

    return { ...state, structures };
  },

  "kernel.status": (ctx) => ({ status: "deterministic", seed: ctx.seed, tick: ctx.currentTick }),
  "kernel.setDeterministicSeed": (ctx, action) => {
    assert(typeof action.seed === "string" && action.seed.trim(), "[SET_SEED] seed fehlt.");
    ctx.seed = action.seed.trim();
    return { success: true, seed: ctx.seed, seedSignature: deriveSeedSignature(ctx.seed) };
  }
};

export class KernelController {
  constructor(options = {}) {
    this.seed = typeof options.seed === "string" && options.seed.trim() ? options.seed.trim() : "seedworld-v1";
    this.deterministicSeed = this.seed;
    this.currentTick = 0;
    this._callHistory = [];
  }

  async execute(input = {}) {
    return withDeterminismGuards(async () => {
      assert(isPlainObject(input), "[KERNEL] input muss Plain-Object sein.");
      const { domain, action } = input;
      assert(typeof domain === "string" && domain.trim(), "[KERNEL] domain fehlt.");
      assert(isPlainObject(action), "[KERNEL] action muss Plain-Object sein.");
      assert(typeof action.type === "string" && action.type.trim(), "[KERNEL] action.type fehlt.");

      const key = `${domain}.${action.type}`;
      const handler = ACTION_HANDLERS[key];
      if (!handler) throw new Error(`[KERNEL] Unbekannte Action: ${key}`);

      this._callHistory.push({ domain, actionType: action.type });
      const result = handler(this, clone(action));
      return clone({ success: true, domain, result });
    });
  }

  async plan(input = {}) { return this.execute(input); }
  async apply(input = {}) { return this.execute(input); }

  getCurrentState() {
    return { tick: this.currentTick, seed: this.seed };
  }

  get router() {
    return { callHistory: this._callHistory };
  }
}
