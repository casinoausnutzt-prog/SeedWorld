// @doc-anchor ENGINE-CORE
// @doc-anchor DETERMINISTIC-RNG
// @mut-point MUT-RNG-CORE
//
// SplitMix32 Pseudozufallsgenerator.
// Identischer Seed erzeugt identische Zahlenfolge. Kein externer Zustand.

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[DETERMINISTIC_RNG] ${message}`);
  }
}

function hashSeedString(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export class DeterministicRNG {
  constructor(seed) {
    assert(typeof seed === "string" && seed.trim().length > 0, "seed muss ein nicht-leerer String sein.");
    this.state = hashSeedString(seed);
    if (this.state === 0) this.state = 1;
    this.callCount = 0;
  }

  nextUint32() {
    this.state += 0x9e3779b9;
    let z = this.state | 0;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    z = (z ^ (z >>> 16)) >>> 0;
    this.callCount += 1;
    return z;
  }

  next() {
    return this.nextUint32() / 4294967296;
  }

  nextInt(min, max) {
    assert(Number.isInteger(min) && Number.isInteger(max) && min <= max, "nextInt: min/max muessen ganze Zahlen sein, min <= max.");
    const range = max - min + 1;
    return min + (this.nextUint32() % range);
  }

  pick(array) {
    assert(Array.isArray(array) && array.length > 0, "pick: Array darf nicht leer sein.");
    return array[this.nextUint32() % array.length];
  }

  snapshot() {
    return Object.freeze({ state: this.state, callCount: this.callCount });
  }
}
