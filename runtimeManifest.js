import { assertPluginDomainPatchesAllowed } from "./engine/kernel/validation/gates.js";

export const SCHEMA_VERSION = "seedworld-v3";

export const stateSchema = {
  type: "object",
  properties: {
    world: {
      type: "object",
      properties: {
        seed: { type: "string" },
        size: { type: "object", properties: { width: { type: "number" }, height: { type: "number" } } },
        tiles: { type: "array", items: { type: "object" } },
      },
      required: ["seed", "size", "tiles"],
    },
    clock: {
      type: "object",
      properties: { tick: { type: "number" } },
      required: ["tick"],
    },
    resources: {
      type: "object",
      properties: { ore: { type: "number" }, iron: { type: "number" } },
      required: ["ore", "iron"],
    },
    structures: { type: "object" },
    statistics: {
      type: "object",
      properties: {
        totalTicks: { type: "number" },
        structuresBuilt: { type: "number" },
        totalOreProduced: { type: "number" },
        totalIronProduced: { type: "number" },
        seedSignature: { type: "string" },
      },
      required: ["totalTicks", "structuresBuilt", "totalOreProduced", "totalIronProduced", "seedSignature"],
    },
  },
  required: ["world", "clock", "resources", "structures", "statistics"],
};

export const actionSchema = {
  type: "object",
  properties: {
    type: { type: "string" },
    payload: { type: "object" },
  },
  required: ["type"],
};

export const mutationMatrix = {
  "game.generate_world": [
    "/world/seed",
    "/world/size/width",
    "/world/size/height",
    "/world/tiles",
    "/clock/tick",
    "/resources/ore",
    "/resources/iron",
    "/structures",
    "/statistics/totalTicks",
    "/statistics/structuresBuilt",
    "/statistics/totalOreProduced",
    "/statistics/totalIronProduced",
    "/statistics/seedSignature",
  ],
  "game.advanceTick": [
    "/clock/tick",
    "/resources/ore",
    "/resources/iron",
    "/statistics/totalTicks",
    "/statistics/totalOreProduced",
    "/statistics/totalIronProduced",
  ],
  "game.placeStructure": [
    "/structures/",
    "/resources/ore",
    "/statistics/structuresBuilt",
  ],
  "game.removeStructure": [
    "/structures/",
  ],
  "kernel.setDeterministicSeed": [
    "/world/seed",
    "/statistics/seedSignature",
  ],
};

export const simGate = {
  // Define simGate structure based on LifeGameLab's simGate.js
  // For now, keep it minimal, as SeedWorld's state is simpler.
  limits: {
    maxPatches: 1000,
    maxTiles: 10000,
  },
  world: {
    keys: {
      seed: { type: "string" },
      width: { type: "number" },
      height: { type: "number" },
      tiles: { type: "array" },
    },
  },
  sim: {
    keys: [
      "tick", "ore", "iron", "totalTicks", "structuresBuilt", "totalOreProduced", "totalIronProduced", "seedSignature"
    ],
    booleanKeys: [],
    stringKeys: ["seedSignature"],
    objectKeys: ["world", "resources", "structures", "statistics"],
  },
};

export const runtimeManifest = {
  SCHEMA_VERSION,
  stateSchema,
  actionSchema,
  mutationMatrix,
  simGate,
  simStepActionType: "game.advanceTick",
  domainPatchGate: assertPluginDomainPatchesAllowed,
};
