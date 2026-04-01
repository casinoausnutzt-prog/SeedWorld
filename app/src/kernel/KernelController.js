// @doc-anchor ENGINE-CORE
// @doc-anchor KERNEL-CONTROLLER
//
// KernelController – schlanker, direkter Kernel ohne Wrapper-Schichten.
// Nutzt engine/kernel direkt fuer Determinismus-Guards.
// Kein GateManager, kein PatchOrchestrator, kein GovernanceEngine zur Runtime.
// Erweitert um Factorio-Light-Mechaniken: Smelter, Conveyor, Ressourcen-Produktion.

import { withDeterminismGuards } from "../../engine/kernel/runtimeGuards.js";
import { generateWorld } from "../game/worldGen.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function clone(value) {
  return structuredClone(value);
}

function deriveSeedSignature(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ── Factorio-Konstanten ────────────────────────────────────────────────────
const STRUCTURE_COSTS = {
  mine:     { ore: 50 },
  smelter:  { ore: 100 },
  conveyor: { ore: 20 }
};

const MINE_ORE_PER_TICK    = 2;
const SMELTER_ORE_PER_TICK = 5;
const SMELTER_IRON_PER_TICK = 1;
const TICKS_PER_PRODUCTION  = 5;

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function getTile(state, x, y) {
  const tiles = Array.isArray(state.world?.tiles) ? state.world.tiles : [];
  return tiles.find(t => t?.x === x && t?.y === y) || null;
}

function getStructuresOfType(state, type) {
  const structs = state.structures && typeof state.structures === "object" ? state.structures : {};
  return Object.entries(structs)
    .filter(([, s]) => s?.id === type)
    .map(([key, s]) => {
      const [x, y] = key.split(",").map(Number);
      return { key, x, y, ...s };
    });
}

function runProductionTick(state) {
  const next = clone(state);
  const tick = Number(next.clock?.tick) || 0;

  // Nur jedes N-te Tick produzieren
  if (tick % TICKS_PER_PRODUCTION !== 0) return next;

  const capacity = 500 + (getStructuresOfType(next, "storage").length * 200);

  // Minen: Erz abbauen
  const mines = getStructuresOfType(next, "mine");
  for (const mine of mines) {
    const tile = getTile(next, mine.x, mine.y);
    if (!tile) continue;
    const isOnResource = tile.resource === "ore" || tile.resource === "coal";
    if (!isOnResource) continue;
    const currentOre = Number(next.resources?.ore) || 0;
    if (currentOre >= capacity) continue;
    const gain = Math.min(MINE_ORE_PER_TICK, capacity - currentOre);
    next.resources.ore = currentOre + gain;
    next.statistics.totalOreProduced = (Number(next.statistics?.totalOreProduced) || 0) + gain;
  }

  // Smelter: Erz -> Eisen
  const smelters = getStructuresOfType(next, "smelter");
  for (const _ of smelters) {
    const currentOre = Number(next.resources?.ore) || 0;
    if (currentOre < SMELTER_ORE_PER_TICK) continue;
    next.resources.ore  = currentOre - SMELTER_ORE_PER_TICK;
    next.resources.iron = (Number(next.resources?.iron) || 0) + SMELTER_IRON_PER_TICK;
    next.statistics.totalIronProduced = (Number(next.statistics?.totalIronProduced) || 0) + SMELTER_IRON_PER_TICK;
  }

  return next;
}

// ── Action Handlers ────────────────────────────────────────────────────────

const ACTION_HANDLERS = {
  "game.createInitialState": (ctx) => {
    const world = generateWorld({ seed: ctx.seed, width: 20, height: 15 });
    return {
      world,
      clock: { tick: 0, msPerTick: 100 },
      resources: { ore: 200, iron: 0, coal: 0 },
      structures: {},
      statistics: {
        totalTicks: 0,
        structuresBuilt: 0,
        totalOreProduced: 0,
        totalIronProduced: 0,
        seedSignature: deriveSeedSignature(ctx.seed)
      }
    };
  },

  "game.advanceTick": (ctx, action) => {
    assert(isPlainObject(action.state), "[ADVANCE_TICK] state fehlt.");
    const ticks = Number.isInteger(action.ticks) && action.ticks > 0 ? action.ticks : 1;
    let state = action.state;

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
    const ore  = Number(action.state.resources?.ore)  || 0;
    const iron = Number(action.state.resources?.iron) || 0;
    return [
      {
        id: "mine",
        name: "Mine",
        description: "Baut Erz auf Ressourcen-Feldern ab",
        icon: "⛏",
        cost: STRUCTURE_COSTS.mine,
        canAfford: ore >= STRUCTURE_COSTS.mine.ore,
        requiresTile: ["ore", "coal"]
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
    assert(tile.biome !== "water", `[PLACE_STRUCTURE] Struktur auf water unzulaessig: ${x},${y}`);

    const cost = STRUCTURE_COSTS[structureId];
    assert(cost, `[PLACE_STRUCTURE] Unbekannte Struktur: ${structureId}`);

    const ore = Number(state.resources?.ore) || 0;
    assert(ore >= cost.ore, `[PLACE_STRUCTURE] Nicht genug Erz: benoetigt ${cost.ore}, vorhanden ${ore}`);

    // Mine darf nur auf Ressourcen-Feldern gebaut werden
    if (structureId === "mine") {
      assert(
        tile.resource === "ore" || tile.resource === "coal",
        `[PLACE_STRUCTURE] Mine kann nur auf Erz oder Kohle gebaut werden.`
      );
    }

    // Kein Doppelbau
    const existingKey = `${x},${y}`;
    assert(!state.structures?.[existingKey], `[PLACE_STRUCTURE] Bereits eine Struktur auf ${x},${y}`);

    const structures = {
      ...(state.structures || {}),
      [existingKey]: {
        id: structureId,
        builtAt: Number(state.clock?.tick) || 0,
        x,
        y
      }
    };

    return {
      ...state,
      structures,
      resources: { ...state.resources, ore: ore - cost.ore },
      statistics: {
        ...state.statistics,
        structuresBuilt: (Number(state.statistics?.structuresBuilt) || 0) + 1
      }
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

  "kernel.status": (ctx) => ({
    status: "deterministic",
    seed: ctx.seed,
    tick: ctx.currentTick
  }),

  "kernel.setDeterministicSeed": (ctx, action) => {
    assert(typeof action.seed === "string" && action.seed.trim(), "[SET_SEED] seed fehlt.");
    ctx.seed = action.seed.trim();
    return { success: true, seed: ctx.seed, seedSignature: deriveSeedSignature(ctx.seed) };
  }
};

export class KernelController {
  constructor(options = {}) {
    this.seed = typeof options.seed === "string" && options.seed.trim() ? options.seed.trim() : "default-seed";
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
