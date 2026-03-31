// @doc-anchor ENGINE-SEED-GUARD
// @mut-point MUT-SEED-GUARD
//
// Validiert Seeds und gleicht Seed-Hashes ab (constant-time).

import { sha256Hex, constantTimeHexEqual } from "./fingerprint.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ENGINE_SEED_GUARD] ${message}`);
  }
}

function isHex64(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export async function deriveSeedHash(seed) {
  assert(typeof seed === "string" && seed.trim().length > 0, "seed fehlt oder ungueltig.");
  return sha256Hex(seed);
}

export async function assertSeedMatch(seed, expectedSeedHash) {
  assert(typeof seed === "string" && seed.trim().length > 0, "seed fehlt oder ungueltig.");
  if (expectedSeedHash === undefined || expectedSeedHash === null) {
    return deriveSeedHash(seed);
  }
  const normalized = String(expectedSeedHash).trim().toLowerCase();
  assert(isHex64(normalized), "expectedSeedHash muss 64 Hex-Zeichen haben.");
  const actualSeedHash = await sha256Hex(seed);
  const ok = constantTimeHexEqual(actualSeedHash, normalized);
  assert(ok, "Seed-Abgleich fehlgeschlagen (Hash mismatch).");
  return actualSeedHash;
}
