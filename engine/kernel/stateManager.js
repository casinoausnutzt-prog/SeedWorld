// @doc-anchor ENGINE-CORE
// @doc-anchor ENGINE-STATE
// @mut-point MUT-STATE-COMMIT
//
// Verwaltet den immutablen Kernel-State.
// Jeder Uebergang erzeugt einen neuen, eingefrorenen Snapshot.
// Kein Aliasing: Rueckgaben sind immer deep-geclonte, eingefrorene Kopien.

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ENGINE_STATE] ${message}`);
  }
}

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepClone(value) {
  try {
    return structuredClone(value);
  } catch (error) {
    throw new Error(`[ENGINE_STATE] deepClone fehlgeschlagen: ${error.message}`);
  }
}

export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    if (Array.isArray(value)) {
      for (const item of value) deepFreeze(item);
    } else {
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
  }
  return value;
}

export class StateManager {
  constructor({ maxHistory = 256 } = {}) {
    this.history = [];
    this.maxHistory = Number.isInteger(maxHistory) && maxHistory > 0 ? maxHistory : 256;
  }

  commit(state) {
    assert(isPlainObject(state), "State muss ein Plain Object sein.");
    const frozen = deepFreeze(deepClone(state));
    this.history.push(frozen);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    return frozen;
  }

  current() {
    if (this.history.length === 0) return null;
    return deepClone(this.history[this.history.length - 1]);
  }

  at(index) {
    if (index < 0 || index >= this.history.length) return null;
    return deepClone(this.history[index]);
  }

  get length() {
    return this.history.length;
  }

  all() {
    return this.history.map((s) => deepClone(s));
  }
}
