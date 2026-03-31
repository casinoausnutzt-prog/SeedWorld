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

  const checkpointsA = await checkpointHashes(runA.states, createMutFingerprint);
  const checkpointsB = await checkpointHashes(runB.states, createMutFingerprint);
  assert.deepEqual(checkpointsA, checkpointsB);

  const controller = new KernelController({ seed: explicitSeed });
  const initial = await controller.execute({ domain: "game", action: { type: "createInitialState" } });
  assert.equal(initial.result.statistics.seedSignature, expectedSeedSignature(explicitSeed));

  return {
    worldFingerprint: await createMutFingerprint(worldA),
    alternateWorldFingerprint: await createMutFingerprint(worldB),
    kernelSeedHash: runA.seedHash,
    kernelFingerprint: runA.mutFingerprint,
    checkpointFingerprints: checkpointsA,
    seedSignature: initial.result.statistics.seedSignature
  };
}
