// @doc-anchor ENGINE-CORE
// @doc-anchor KERNEL-CONTROLLER
//
// KernelController – schlanker, direkter Kernel ohne Wrapper-Schichten.
// Nutzt engine/kernel direkt fuer Determinismus-Guards.
// Kein GateManager, kein PatchOrchestrator, kein GovernanceEngine zur Runtime.

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

const ACTION_HANDLERS = {
  "game.createInitialState": (ctx) => {
    const world = generateWorld({ seed: ctx.seed, width: 16, height: 12 });
    return {
      world,
      clock: { tick: 0, msPerTick: 100 },
      resources: { ore: 1000, iron: 0 },
      structures: {},
      statistics: {
        totalTicks: 0,
        structuresBuilt: 0,
        totalOreProduced: 0,
        seedSignature: deriveSeedSignature(ctx.seed)
      }
    };
  },

  "game.advanceTick": (ctx, action) => {
    assert(isPlainObject(action.state), "[ADVANCE_TICK] state fehlt.");
    const state = action.state;
    const ticks = Number.isInteger(action.ticks) && action.ticks > 0 ? action.ticks : 1;
    const structures = state.structures && typeof state.structures === "object" ? state.structures : {};
    const mines = Object.values(structures).filter(s => s?.id === "mine").length;
    const oreGain = mines * ticks;
    ctx.currentTick = (Number(state.clock?.tick) || 0) + ticks;
    return {
      ...state,
      structures,
      clock: { ...state.clock, tick: ctx.currentTick },
      resources: { ...state.resources, ore: (Number(state.resources?.ore) || 0) + oreGain },
      statistics: {
        ...state.statistics,
        totalTicks: (Number(state.statistics?.totalTicks) || 0) + ticks,
        totalOreProduced: (Number(state.statistics?.totalOreProduced) || 0) + oreGain
      }
    };
  },

  "game.inspectTile": (_ctx, action) => {
    assert(isPlainObject(action.state), "[INSPECT_TILE] state fehlt.");
    const x = Number.isInteger(action.x) ? action.x : 0;
    const y = Number.isInteger(action.y) ? action.y : 0;
    const tiles = Array.isArray(action.state.world?.tiles) ? action.state.world.tiles : [];
    const tile = tiles.find(t => t?.x === x && t?.y === y) || null;
    return { x, y, tile };
  },

  "game.getBuildOptions": (_ctx, action) => {
    assert(isPlainObject(action.state), "[GET_BUILD_OPTIONS] state fehlt.");
    const ore = Number(action.state.resources?.ore) || 0;
    return [
      { id: "mine", name: "Mine", cost: { ore: 100 }, canAfford: ore >= 100 },
      { id: "smelter", name: "Smelter", cost: { ore: 200 }, canAfford: ore >= 200 }
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
    const cost = structureId === "mine" ? 100 : 200;
    const ore = Number(state.resources?.ore) || 0;
    assert(ore >= cost, `[PLACE_STRUCTURE] Nicht genug ore: benoetigt ${cost}, vorhanden ${ore}`);
    const structures = { ...(state.structures || {}), [`${x},${y}`]: { id: structureId, builtAt: Number(state.clock?.tick) || 0 } };
    return {
      ...state,
      structures,
      resources: { ...state.resources, ore: ore - cost },
      statistics: { ...state.statistics, structuresBuilt: (Number(state.statistics?.structuresBuilt) || 0) + 1 }
    };
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
    this.seed = typeof options.seed === "string" && options.seed.trim() ? options.seed.trim() : "default-seed";
    // Alias fuer Legacy-Kompatibilitaet
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
