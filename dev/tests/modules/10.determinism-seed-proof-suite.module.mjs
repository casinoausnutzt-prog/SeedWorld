import path from "node:path";
import { pathToFileURL } from "node:url";

function expectedSeedSignature(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function checkpointHashes(states, createMutFingerprint) {
  return Promise.all(
    states.map((state) =>
      createMutFingerprint({
        tick: state.tick,
        resources: state.resources,
        statistics: state.statistics
      })
    )
  );
}

export const id = "10-determinism-seed-proof-suite";
export const seed = "suite-10-determinism-seed-proof-seed";
export const seedSource = "test-vector";
export const authority = {
  kernelPaths: [
    "app/src/kernel/deterministicKernel.js",
    "app/src/kernel/fingerprint.js",
    "app/src/kernel/runtimeGuards.js",
    "app/src/kernel/seedGuard.js",
    "app/src/kernel/KernelController.js"
  ],
  contentPaths: [
    "app/src/game/worldGen.js"
  ]
};

export async function runEvidence({ root, assert, seed: explicitSeed }) {
  const worldGen = await import(pathToFileURL(path.join(root, "app/src/game/worldGen.js")).href);
  const kernelModule = await import(pathToFileURL(path.join(root, "app/src/kernel/KernelController.js")).href);
  const deterministicKernel = await import(pathToFileURL(path.join(root, "app/src/kernel/deterministicKernel.js")).href);
  const fingerprint = await import(pathToFileURL(path.join(root, "app/src/kernel/fingerprint.js")).href);

  const { KernelController } = kernelModule;
  const { runDeterministicKernel } = deterministicKernel;
  const { createMutFingerprint, sha256Hex } = fingerprint;

  const worldA = worldGen.generateWorld({ seed: explicitSeed, width: 16, height: 12 });
  const worldARepeat = worldGen.generateWorld({ seed: explicitSeed, width: 16, height: 12 });
  const worldB = worldGen.generateWorld({ seed: `${explicitSeed}-alt`, width: 16, height: 12 });
  worldGen.validateWorldShape(worldA);
  assert.equal(JSON.stringify(worldA), JSON.stringify(worldARepeat));
  assert.notEqual(JSON.stringify(worldA), JSON.stringify(worldB));

  const expectedHash = await sha256Hex(explicitSeed);
  const runA = await runDeterministicKernel(explicitSeed, 24, { expectedSeedHash: expectedHash });
  const runB = await runDeterministicKernel(explicitSeed, 24, { expectedSeedHash: expectedHash });
  assert.equal(runA.seedHash, runB.seedHash);
  assert.equal(runA.mutFingerprint, runB.mutFingerprint);
  assert.equal(Object.isFrozen(runA), true, "runA must be deeply frozen");
  assert.equal(Object.isFrozen(runB), true, "runB must be deeply frozen");
  assert.equal(Object.isFrozen(runA.states), true, "runA.states must be frozen");
  assert.equal(Object.isFrozen(runB.states), true, "runB.states must be frozen");
  assert.equal(Object.isFrozen(runA.states[0]), true, "runA.states[0] must be frozen");
  assert.equal(Object.isFrozen(runB.states[0]), true, "runB.states[0] must be frozen");
  assert.equal(Object.isFrozen(runA.states[0].resources), true, "runA.states[0].resources must be frozen");
  assert.equal(Object.isFrozen(runB.states[0].resources), true, "runB.states[0].resources must be frozen");
  assert.equal(Object.isFrozen(runA.states[0].statistics), true, "runA.states[0].statistics must be frozen");
  assert.equal(Object.isFrozen(runB.states[0].statistics), true, "runB.states[0].statistics must be frozen");

  const checkpointsA = await checkpointHashes(runA.states, createMutFingerprint);
  const checkpointsB = await checkpointHashes(runB.states, createMutFingerprint);
  assert.deepEqual(checkpointsA, checkpointsB);

  const controller = new KernelController({ seed: explicitSeed });
  const initial = await controller.execute({ domain: "game", action: { type: "createInitialState" } });
  assert.equal(initial.result.statistics.seedSignature, expectedSeedSignature(explicitSeed));

  controller.actionRegistry.entries.set("game::guardedProbe", {
    domain: "game",
    actionType: "guardedProbe",
    requiredGate: "game.action",
    validator: () => {
      Math.random();
      return { valid: true };
    },
    handler: () => ({ ok: true })
  });

  let guardError = null;
  try {
    await controller.execute({
      domain: "game",
      action: { type: "guardedProbe" }
    });
  } catch (error) {
    guardError = error;
  }
  assert.ok(guardError, "guarded validator must throw");
  assert.match(String(guardError?.message ?? guardError), /\[KERNEL_GUARD\]/);

  controller.actionRegistry.entries.set("game::smuggleProbe", {
    domain: "game",
    actionType: "smuggleProbe",
    requiredGate: "game.action",
    validator: (action) => {
      action.payload.value = 99;
      action.smuggled = "validator";
      return { valid: true };
    },
    handler: (action) => ({
      value: action.payload.value,
      smuggled: action.smuggled ?? null
    })
  });

  const smuggleAction = { type: "smuggleProbe", payload: { value: 1 } };
  const smuggleResult = await controller.execute({ domain: "game", action: smuggleAction });
  assert.equal(smuggleResult.result.value, 1);
  assert.equal(smuggleResult.result.smuggled, null);
  assert.equal(smuggleAction.payload.value, 1);
  assert.equal(smuggleAction.smuggled, undefined);

  const detachedInitial = await controller.execute({
    domain: "game",
    action: { type: "createInitialState" }
  });
  const detachedAdvance = await controller.execute({
    domain: "game",
    action: { type: "advanceTick", state: detachedInitial.result, ticks: 1 }
  });
  const detachedBiome = detachedInitial.result.world.tiles[0].biome;
  detachedInitial.result.world.tiles[0].biome = "__mutated__";
  assert.equal(detachedAdvance.result.world.tiles[0].biome, detachedBiome);

  return {
    worldFingerprint: await createMutFingerprint(worldA),
    alternateWorldFingerprint: await createMutFingerprint(worldB),
    kernelSeedHash: runA.seedHash,
    kernelFingerprint: runA.mutFingerprint,
    checkpointFingerprints: checkpointsA,
    seedSignature: initial.result.statistics.seedSignature
  };
}
