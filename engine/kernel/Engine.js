// @doc-anchor ENGINE-CORE
// @doc-anchor ENGINE-CORE
// @mut-point MUT-ENGINE-TICK
//
// Engine – Deterministischer Kernel fuer SeedWorld.
//
// Orchestriert: DeterministicRNG, RuntimeGuards, StateManager, ActionRouter,
//               ModuleValidator, Fingerprint.
//
// Garantiert:
//   - Identischer Seed + identische Actions = identischer State + identischer Fingerprint
//   - Kein Zugriff auf nicht-deterministische APIs waehrend der Ausfuehrung
//   - Game-Module werden vor Registrierung auf Konformitaet geprueft
//   - Jeder State-Snapshot ist immutable (deep-frozen)

import { DeterministicRNG } from "./deterministicRNG.js";
import { createFingerprint } from "./fingerprint.js";
import { activate, deactivate } from "./runtimeGuards.js";
import { assertSeedMatch, deriveSeedHash } from "./seedGuard.js";
import { StateManager, deepClone, deepFreeze, isPlainObject } from "./stateManager.js";
import { ActionRouter } from "./actionRouter.js";
import { validateModuleContract } from "./moduleValidator.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ENGINE] ${message}`);
  }
}

export class Engine {
  constructor(options = {}) {
    assert(isPlainObject(options), "options muss ein Plain Object sein.");
    const seed = typeof options.seed === "string" && options.seed.trim().length > 0
      ? options.seed.trim()
      : "default-seed";

    this.seed = seed;
    this.rng = new DeterministicRNG(seed);
    this.stateManager = new StateManager({ maxHistory: 256 });
    this.router = new ActionRouter();
    this.modules = new Map();
    this.currentTick = 0;
    this.auditTrail = [];
    this.maxAuditTrail = 1024;
    this.initialized = false;
  }

  // -- Modul-Registrierung --------------------------------------------------

  registerModule(moduleExport) {
    const report = validateModuleContract(moduleExport);
    if (!report.valid) {
      const reasons = report.errors.join("; ");
      throw new Error(`[ENGINE] Modul-Registrierung fehlgeschlagen: ${reasons}`);
    }

    const domain = moduleExport.domain;
    assert(!this.modules.has(domain), `Domain '${domain}' ist bereits registriert.`);

    this.modules.set(domain, {
      domain,
      actionSchema: deepFreeze(deepClone(moduleExport.actionSchema)),
      mutationMatrix: deepFreeze(deepClone(moduleExport.mutationMatrix)),
      reduce: moduleExport.reduce,
      createInitialState: moduleExport.createInitialState,
      validate: typeof moduleExport.validate === "function" ? moduleExport.validate : null
    });

    this.router.registerHandler(domain, (action) => this.#handleAction(domain, action));
    return report;
  }

  // -- Initialisierung -------------------------------------------------------

  async initialize(options = {}) {
    assert(!this.initialized, "Engine ist bereits initialisiert.");
    assert(this.modules.size > 0, "Mindestens ein Game-Modul muss registriert sein.");

    const seedHash = await deriveSeedHash(this.seed);

    // Initial-State aus allen registrierten Modulen zusammenbauen
    let combinedState = {
      engine: {
        seed: this.seed,
        seedHash,
        version: "2.0.0",
        tick: 0
      }
    };

    for (const [domain, mod] of this.modules) {
      const domainState = mod.createInitialState(this.seed, this.rng);
      assert(isPlainObject(domainState), `createInitialState von '${domain}' muss Plain Object liefern.`);
      combinedState[domain] = domainState;
    }

    this.stateManager.commit(combinedState);
    this.initialized = true;

    this.#audit("initialize", { seedHash, domains: [...this.modules.keys()] });
    return deepClone(combinedState);
  }

  // -- Tick-Ausfuehrung (deterministisch) ------------------------------------

  async tick(actions = []) {
    assert(this.initialized, "Engine muss zuerst initialisiert werden.");
    assert(Array.isArray(actions), "actions muss ein Array sein.");

    activate(); // RuntimeGuards: blockiert Math.random, Date.now etc.
    try {
      let state = this.stateManager.current();
      this.currentTick += 1;
      state.engine = { ...state.engine, tick: this.currentTick };

      // Alle Actions ausfuehren
      for (const action of actions) {
        assert(isPlainObject(action), "Jede Action muss ein Plain Object sein.");
        assert(typeof action.domain === "string", "action.domain fehlt.");
        assert(typeof action.type === "string", "action.type fehlt.");

        const mod = this.modules.get(action.domain);
        assert(mod, `Kein Modul fuer Domain '${action.domain}' registriert.`);

        // Action gegen Schema validieren
        this.#validateAction(mod, action);

        // Reducer ausfuehren
        const domainState = state[action.domain] || {};
        const nextDomainState = mod.reduce(deepClone(domainState), action, this.rng);
        assert(isPlainObject(nextDomainState), `reduce von '${action.domain}' muss Plain Object liefern.`);

        // Mutation-Matrix pruefen
        this.#validateMutations(mod, domainState, nextDomainState);

        state[action.domain] = nextDomainState;
      }

      // State committen (deep-clone + freeze)
      const committed = this.stateManager.commit(state);
      this.#audit("tick", { tick: this.currentTick, actionCount: actions.length });
      return deepClone(committed);
    } finally {
      deactivate(); // RuntimeGuards: stellt globale APIs wieder her
    }
  }

  // -- Mehrere Ticks auf einmal (fuer Reproduktion) --------------------------

  async runTicks(count, actionsPerTick = []) {
    assert(Number.isInteger(count) && count > 0 && count <= 4096, "count muss zwischen 1 und 4096 liegen.");
    const snapshots = [];
    for (let i = 0; i < count; i += 1) {
      const actions = Array.isArray(actionsPerTick[i]) ? actionsPerTick[i] : [];
      const state = await this.tick(actions);
      snapshots.push({
        tick: this.currentTick,
        resources: state.game?.resources ? { ...state.game.resources } : {},
        statistics: state.game?.statistics ? { ...state.game.statistics } : {}
      });
    }
    return snapshots;
  }

  // -- Fingerprint (Reproduzierbarkeitsbeweis) --------------------------------

  async createProof(snapshots) {
    assert(Array.isArray(snapshots) && snapshots.length > 0, "snapshots darf nicht leer sein.");
    const seedHash = await deriveSeedHash(this.seed);
    return createFingerprint({
      engine: "seedworld.engine.v2",
      seedHash,
      ticks: this.currentTick,
      snapshots,
      routerCalls: this.router.callHistory.length
    });
  }

  // -- Zustandsabfragen -------------------------------------------------------

  getCurrentState() {
    return this.stateManager.current();
  }

  getCurrentTick() {
    return this.currentTick;
  }

  getStateAt(index) {
    return this.stateManager.at(index);
  }

  getAuditTrail() {
    return [...this.auditTrail];
  }

  getModuleDomains() {
    return [...this.modules.keys()];
  }

  // -- Interne Hilfsfunktionen ------------------------------------------------

  #handleAction(domain, action) {
    const mod = this.modules.get(domain);
    if (!mod) throw new Error(`[ENGINE] Kein Modul fuer Domain '${domain}'.`);
    const state = this.stateManager.current();
    const domainState = state[domain] || {};
    return mod.reduce(deepClone(domainState), action, this.rng);
  }

  #validateAction(mod, action) {
    const schema = mod.actionSchema[action.type];
    if (!isPlainObject(schema)) {
      throw new Error(`[ENGINE] Action '${action.type}' ist in Domain '${mod.domain}' nicht erlaubt.`);
    }
    const required = Array.isArray(schema.required) ? schema.required : [];
    const payload = isPlainObject(action.payload) ? action.payload : {};
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) {
        throw new Error(`[ENGINE] Pflichtfeld fehlt: ${action.type}.${key}`);
      }
    }
  }

  #validateMutations(mod, prevState, nextState) {
    const allowedPaths = mod.mutationMatrix[mod.domain];
    if (!Array.isArray(allowedPaths) || allowedPaths.length === 0) return;

    const changedKeys = Object.keys(nextState).filter((key) => {
      return JSON.stringify(nextState[key]) !== JSON.stringify(prevState[key]);
    });

    for (const key of changedKeys) {
      const allowed = allowedPaths.some((prefix) => key === prefix || key.startsWith(`${prefix}.`));
      if (!allowed) {
        throw new Error(`[ENGINE] Mutation an '${key}' ist in Domain '${mod.domain}' nicht erlaubt.`);
      }
    }
  }

  #audit(action, details) {
    this.auditTrail.push({
      action,
      tick: this.currentTick,
      details
    });
    if (this.auditTrail.length > this.maxAuditTrail) {
      this.auditTrail = this.auditTrail.slice(-this.maxAuditTrail);
    }
  }
}

export function createEngine(options = {}) {
  return new Engine(options);
}
