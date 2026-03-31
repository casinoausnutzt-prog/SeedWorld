import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "20-gameplay-state-suite";
export const seed = "suite-20-gameplay-state-seed";
export const seedSource = "test-vector";
export const authority = {
  kernelPaths: [
    "app/src/game/GameLogicController.js",
    "app/src/game/gamePatchBuilders.js",
    "app/src/game/gameStateReducer.js"
  ],
  contentPaths: [
    "app/src/game/gameConfig.js",
    "app/src/game/worldGen.js",
    "app/src/game/contracts/ActionSchema.md",
    "app/src/game/contracts/MutationMatrix.md"
  ]
};

export async function runEvidence({ root, assert, seed: explicitSeed }) {
  const gameLogicModule = await import(pathToFileURL(path.join(root, "app/src/game/GameLogicController.js")).href);
  const { reduceGameState, GameLogicController } = gameLogicModule;

  const base = { resources: { ore: 50 }, level: 1 };
  const clone = reduceGameState(base, []);
  assert.deepEqual(clone, base);
  assert.notEqual(clone, base);

  const patched = reduceGameState(base, [{ op: "set", domain: "game", path: "level", value: 7 }]);
  assert.equal(patched.level, 7);
  assert.equal(base.level, 1);

  const logic = new GameLogicController({
    plan: async () => ({}),
    apply: async () => ({})
  });

  let state = logic.applyActionLocally(
    { type: "generate_world", payload: { seed: explicitSeed, width: 8, height: 6 } },
    {}
  ).previewState;
  assert.equal(state.world.tiles.length, 48);

  const placements = [
    { x: 2, y: 3, tileType: "mine", expectedOutput: "Erz" },
    { x: 1, y: 1, tileType: "storage", expectedOutput: "Lager" },
    { x: 0, y: 0, tileType: "factory", expectedOutput: "Fabrik" },
    { x: 4, y: 2, tileType: "connector", expectedOutput: "Verbindung" }
  ];

  for (const placement of placements) {
    state = logic.applyActionLocally({ type: "set_tile_type", payload: placement }, state).previewState;
    const tile = state.world.tiles.find((entry) => entry.x === placement.x && entry.y === placement.y);
    assert.equal(tile?.outputText, placement.expectedOutput);
  }

  const summaryTiles = state.world.tiles
    .filter((tile) => tile.type !== "empty")
    .map((tile) => `${tile.x},${tile.y}:${tile.type}:${tile.outputText}`)
    .sort((a, b) => a.localeCompare(b, "en"));

  return {
    worldSeed: state.world.seed,
    worldSize: state.world.size,
    tileSummary: summaryTiles,
    worldMeta: state.world.meta
  };
}
