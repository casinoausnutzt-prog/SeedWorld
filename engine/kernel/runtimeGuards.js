// @doc-anchor ENGINE-CORE
// @doc-anchor ENGINE-GUARDS
// @mut-point MUT-GUARD-SCOPE
//
// Sperrt nicht-deterministische globale APIs waehrend der Kernel-Ausfuehrung.
// Blockiert: Math.random, Date.now, Date(), performance.now, crypto.getRandomValues, crypto.randomUUID.
// Verschachtelte Aufrufe werden gezaehlt.

function createGuardError(message) {
  return new Error(`[ENGINE_GUARD] ${message}`);
}

function blocked(name) {
  return function () {
    throw createGuardError(`${name}() ist waehrend der Kernel-Ausfuehrung gesperrt. Nutze DeterministicRNG.`);
  };
}

let activeGuardScope = null;
let guardDepth = 0;

function patch(target, key, replacement) {
  const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
  const previousDescriptor = hadOwn ? Object.getOwnPropertyDescriptor(target, key) : undefined;
  try {
    if (previousDescriptor && "value" in previousDescriptor) {
      Object.defineProperty(target, key, {
        ...previousDescriptor,
        value: replacement,
        writable: false
      });
    } else {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: false,
        writable: false,
        value: replacement
      });
    }
  } catch {
    throw createGuardError(`Konnte Guard fuer ${String(key)} nicht erzwingen.`);
  }
  if (target[key] !== replacement) {
    throw createGuardError(`Konnte Guard fuer ${String(key)} nicht erzwingen.`);
  }
  return () => {
    if (hadOwn && previousDescriptor) {
      Object.defineProperty(target, key, previousDescriptor);
      return;
    }
    delete target[key];
  };
}

export function activate() {
  guardDepth += 1;
  if (guardDepth > 1) return;

  const restorers = [];
  const originalMathRandom = Math.random;
  const originalDate = globalThis.Date;
  const originalDateNow = Date.now;

  restorers.push(patch(Math, "random", blocked("Math.random")));

  const DateProxy = function (...args) {
    if (args.length === 0) {
      throw createGuardError("new Date() ohne Argumente ist nicht-deterministisch.");
    }
    return new originalDate(...args);
  };
  DateProxy.prototype = originalDate.prototype;
  DateProxy.now = blocked("Date.now");
  DateProxy.parse = originalDate.parse;
  DateProxy.UTC = originalDate.UTC;
  globalThis.Date = DateProxy;

  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    const origPerfNow = performance.now.bind(performance);
    restorers.push(patch(performance, "now", blocked("performance.now")));
    restorers.push(() => { performance.now = origPerfNow; });
  }

  if (typeof crypto !== "undefined") {
    if (typeof crypto.getRandomValues === "function") {
      restorers.push(patch(crypto, "getRandomValues", blocked("crypto.getRandomValues")));
    }
    if (typeof crypto.randomUUID === "function") {
      restorers.push(patch(crypto, "randomUUID", blocked("crypto.randomUUID")));
    }
  }

  activeGuardScope = {
    restorers,
    originalMathRandom,
    originalDate,
    originalDateNow
  };
}

export function deactivate() {
  if (guardDepth <= 0) {
    throw createGuardError("deactivate() ohne vorheriges activate().");
  }
  guardDepth -= 1;
  if (guardDepth > 0) return;
  if (!activeGuardScope) return;

  for (const restore of activeGuardScope.restorers) {
    restore();
  }
  globalThis.Date = activeGuardScope.originalDate;
  Date.now = activeGuardScope.originalDateNow;
  Math.random = activeGuardScope.originalMathRandom;

  if (Math.random !== activeGuardScope.originalMathRandom) {
    throw createGuardError("Math.random konnte nicht wiederhergestellt werden.");
  }
  if (globalThis.Date !== activeGuardScope.originalDate) {
    throw createGuardError("Date konnte nicht wiederhergestellt werden.");
  }

  activeGuardScope = null;
}

export function isActive() {
  return guardDepth > 0;
}

export function currentDepth() {
  return guardDepth;
}

export async function withGuards(fn) {
  activate();
  try {
    return await fn();
  } finally {
    deactivate();
  }
}
