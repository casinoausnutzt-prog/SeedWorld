// @doc-anchor ENGINE-CORE
// @doc-anchor KERNEL-CONTROLLER
//
// KernelController – Bruecke zwischen UI/GameLogic und dem deterministischen Kernel.
// Bietet eine asynchrone API fuer Actions und verwaltet den lokalen State-Snapshot.

import { createStore } from "../../engine/kernel/store/createStore.js";
import { runtimeManifest } from "../../../runtimeManifest.js";
import { withDeterminismGuards } from "../../engine/kernel/determinism/runtimeGuards.js";
import { isPlainObject } from "../../engine/kernel/shared/isPlainObject.js";

// Struktur-Kosten (Zentral definiert fuer Voxel-MVP)
const STRUCTURE_COSTS = {
  mine:     { ore: 100 },
  smelter:  { ore: 200 },
  conveyor: { ore: 20 }
};

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

// Temporäre Implementierung des Reducers und SimSteps für das Voxel-MVP
const project = {
  reducer: (state, action, { rng, revisionCount }) => {
    switch (action.type) {
      case "game.generate_world": {
        const seed = typeof action.payload?.seed === "string" ? action.payload.seed : state.world.seed;
        const width = Number.isInteger(action.payload?.width) ? action.payload.width : 16;
        const height = Number.isInteger(action.payload?.height) ? action.payload.height : 12;

        const tiles = [];
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            // Nutze den deterministischen RNG
            const noise = (rng.next() * 43758.5453) % 1;
            let terrain = "meadow";
            let resource = "none";

            if (noise < 0.1) terrain = "water";
            else if (noise < 0.2) terrain = "forest";
            else if (noise < 0.25) { terrain = "rock"; resource = "ore"; }
            else if (noise < 0.3) { terrain = "dry"; resource = "coal"; }

            tiles.push({ x, y, terrain, resource });
          }
        }

        return [
          { op: "replace", path: "/world/seed", value: seed },
          { op: "replace", path: "/world/size/width", value: width },
          { op: "replace", path: "/world/size/height", value: height },
          { op: "replace", path: "/world/tiles", value: tiles },
          { op: "replace", path: "/clock/tick", value: 0 },
          { op: "replace", path: "/resources/ore", value: 0 },
          { op: "replace", path: "/resources/iron", value: 0 },
          { op: "replace", path: "/structures", value: {} },
          { op: "replace", path: "/statistics/totalTicks", value: 0 },
          { op: "replace", path: "/statistics/structuresBuilt", value: 0 },
          { op: "replace", path: "/statistics/totalOreProduced", value: 0 },
          { op: "replace", path: "/statistics/totalIronProduced", value: 0 },
          { op: "replace", path: "/statistics/seedSignature", value: deriveSeedSignature(seed) },
        ];
      }

      case "game.placeStructure": {
        const x = Number.isInteger(action.payload?.x) ? action.payload.x : 0;
        const y = Number.isInteger(action.payload?.y) ? action.payload.y : 0;
        const structureId = typeof action.payload?.structureId === "string" ? action.payload.structureId.trim() : "";
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

        return [
          { op: "add", path: `/structures/${existingKey}`, value: { id: structureId, builtAt: state.clock.tick, x, y } },
          { op: "replace", path: "/resources/ore", value: ore - cost.ore },
          { op: "replace", path: "/statistics/structuresBuilt", value: (state.statistics.structuresBuilt || 0) + 1 },
        ];
      }

      case "game.removeStructure": {
        const x = Number.isInteger(action.payload?.x) ? action.payload.x : 0;
        const y = Number.isInteger(action.payload?.y) ? action.payload.y : 0;
        const key = `${x},${y}`;
        assert(state.structures?.[key], `[REMOVE_STRUCTURE] Keine Struktur auf ${x},${y}`);

        return [
          { op: "remove", path: `/structures/${key}` },
        ];
      }

      case "kernel.setDeterministicSeed": {
        assert(typeof action.payload?.seed === "string" && action.payload.seed.trim(), "[SET_SEED] seed fehlt.");
        const newSeed = action.payload.seed.trim();
        return [
          { op: "replace", path: "/world/seed", value: newSeed },
          { op: "replace", path: "/statistics/seedSignature", value: deriveSeedSignature(newSeed) },
        ];
      }

      default:
        return [];
    }
  },

  simStep: (state, action, { rng }) => {
    const structures = state.structures || {};
    const resources = { ...(state.resources || {}) };
    const statistics = { ...(state.statistics || {}) };
    const patches = [];

    // 1. Minen produzieren Erz
    const mines = Object.values(structures).filter(s => s?.id === "mine");
    const oreGain = mines.length;
    if (oreGain > 0) {
      resources.ore = (Number(resources.ore) || 0) + oreGain;
      statistics.totalOreProduced = (Number(statistics.totalOreProduced) || 0) + oreGain;
      patches.push({ op: "replace", path: "/resources/ore", value: resources.ore });
      patches.push({ op: "replace", path: "/statistics/totalOreProduced", value: statistics.totalOreProduced });
    }

    // 2. Schmelzoefen verarbeiten Erz zu Eisen (5 Erz -> 1 Eisen)
    const smelters = Object.values(structures).filter(s => s?.id === "smelter");
    const maxIronFromOre = Math.floor(resources.ore / 5);
    const ironGain = Math.min(smelters.length, maxIronFromOre);

    if (ironGain > 0) {
      resources.ore -= (ironGain * 5);
      resources.iron = (Number(resources.iron) || 0) + ironGain;
      statistics.totalIronProduced = (Number(statistics.totalIronProduced) || 0) + ironGain;
      patches.push({ op: "replace", path: "/resources/ore", value: resources.ore });
      patches.push({ op: "replace", path: "/resources/iron", value: resources.iron });
      patches.push({ op: "replace", path: "/statistics/totalIronProduced", value: statistics.totalIronProduced });
    }

    // Update tick and totalTicks
    patches.push({ op: "replace", path: "/clock/tick", value: state.clock.tick + 1 });
    patches.push({ op: "replace", path: "/statistics/totalTicks", value: state.statistics.totalTicks + 1 });

    return patches;
  },
};

export class KernelController {
  constructor(options = {}) {
    this.store = createStore(runtimeManifest, project, { seed: options.seed });
    this.seed = this.store.getState().world.seed;
    this.currentTick = this.store.getState().clock.tick;
  }

  async execute(input = {}) {
    return withDeterminismGuards(async () => {
      assert(isPlainObject(input), "[KERNEL] input muss Plain-Object sein.");
      const { domain, action } = input;
      assert(typeof domain === "string" && domain.trim(), "[KERNEL] domain fehlt.");
      assert(isPlainObject(action), "[KERNEL] action muss Plain-Object sein.");
      assert(typeof action.type === "string" && action.type.trim(), "[KERNEL] action.type fehlt.");

      // For actions that modify state, use store.dispatch
      if (domain === "game" || domain === "kernel") {
        const doc = this.store.dispatch(action);
        this.seed = doc.state.world.seed;
        this.currentTick = doc.state.clock.tick;
        return { success: true, domain, result: doc.state };
      } else if (domain === "query") {
        // Handle read-only queries directly or via a dedicated query handler
        switch (action.type) {
          case "game.inspectTile": {
            const state = this.store.getState();
            const x = Number.isInteger(action.x) ? action.x : 0;
            const y = Number.isInteger(action.y) ? action.y : 0;
            const tiles = Array.isArray(state.world?.tiles) ? state.world.tiles : [];
            const tile = tiles.find(t => t?.x === x && t?.y === y) || null;
            const structKey = `${x},${y}`;
            const structure = state.structures?.[structKey] || null;
            return { success: true, domain, result: { x, y, tile, structure } };
          }
          case "game.getBuildOptions": {
            const state = this.store.getState();
            const ore = Number(state.resources?.ore) || 0;
            return { success: true, domain, result: [
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
            ]};
          }
          case "kernel.status": {
            const state = this.store.getState();
            return { success: true, domain, result: { status: "deterministic", seed: state.world.seed, tick: state.clock.tick } };
          }
          default:
            throw new Error(`[KERNEL] Unbekannte Query-Action: ${domain}.${action.type}`);
        }
      }
      throw new Error(`[KERNEL] Unbekannte Domain: ${domain}`);
    });
  }

  async plan(input = {}) { return this.execute(input); }
  async apply(input = {}) { return this.execute(input); }

  getCurrentState() {
    return this.store.getState();
  }

  get router() {
    // The router concept might need to be re-evaluated with the new store structure
    return { callHistory: [] };
  }
}
