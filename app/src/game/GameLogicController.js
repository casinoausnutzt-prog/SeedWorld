// @doc-anchor ENGINE-CORE
import { DEFAULT_ACTION_SCHEMA, DEFAULT_DOMAIN, DEFAULT_MUTATION_MATRIX } from "./gameConfig.js";
// Inline-Hilfsfunktionen (aus gameInput.js gemergt)
function isPlainObject(v) { if (!v || typeof v !== "object" || Array.isArray(v)) return false; const p = Object.getPrototypeOf(v); return p === Object.prototype || p === null; }
function deepClone(v) { return structuredClone(v); }
function deepFreeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); for (const k of Object.keys(v)) deepFreeze(v[k]); } return v; }
function coerceString(v, l) { if (typeof v !== "string") throw new Error("[GAME_LOGIC] " + l + " muss String sein."); const t = v.trim(); if (!t) throw new Error("[GAME_LOGIC] " + l + " darf nicht leer sein."); return t; }
function coerceInteger(v, l) { const n = Number(v); if (!Number.isInteger(n)) throw new Error("[GAME_LOGIC] " + l + " muss ganze Zahl sein."); return n; }
function coercePositiveInteger(v, l) { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw new Error("[GAME_LOGIC] " + l + " muss positive ganze Zahl sein."); return n; }
function normalizeKernelApi(api) { if (!api || typeof api !== "object") throw new Error("[GAME_LOGIC] kernelApi fehlt."); const fn = api.execute?.bind(api) || null; if (!fn) throw new Error("[GAME_LOGIC] kernelApi braucht execute."); return { planPatch: fn, applyPatch: fn }; }
function readAction(a) { if (!isPlainObject(a)) throw new Error("[GAME_LOGIC] action muss Plain-Object sein."); const type = coerceString(a.type, "action.type"); const payload = a.payload === undefined ? {} : a.payload; if (!isPlainObject(payload)) throw new Error("[GAME_LOGIC] action.payload muss Plain-Object sein."); return { type, payload }; }
function readState(s) { if (!isPlainObject(s)) throw new Error("[GAME_LOGIC] state muss Plain-Object sein."); return s; }
function reduceGameState(state, patches) { const next = deepClone(isPlainObject(state) ? state : {}); for (const p of patches) { if (p.op !== "set") throw new Error("[GAME_LOGIC] Unsupported op: " + p.op); const segs = p.path.split("."); let cur = next; for (let i = 0; i < segs.length - 1; i++) { if (!isPlainObject(cur[segs[i]])) cur[segs[i]] = {}; cur = cur[segs[i]]; } cur[segs[segs.length-1]] = deepClone(p.value); } return next; }
import {
  deepClone,
  deepFreeze,
  isPlainObject,
  normalizeKernelApi,
  readAction,
  readState
} from "./gameInput.js";
import { buildPatches } from "./gamePatchBuilders.js";
import { buildProgressSnapshot, buildRewardFeedback } from "./gameProgress.js";


function validateActionAgainstSchema(action, actionSchema) {
  const schema = actionSchema[action.type];
  if (!isPlainObject(schema)) {
    throw new Error(`[GAME_LOGIC] Action nicht erlaubt: ${action.type}`);
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(action.payload, key)) {
      throw new Error(`[GAME_LOGIC] Pflichtfeld fehlt: ${action.type}.${key}`);
    }
  }
}

function validatePatchesAgainstMatrix(patches, mutationMatrix) {
  const allowedPrefixes = mutationMatrix[DEFAULT_DOMAIN];
  if (!Array.isArray(allowedPrefixes) || allowedPrefixes.length === 0) {
    throw new Error("[GAME_LOGIC] mutationMatrix fuer game fehlt.");
  }

  for (const patch of patches) {
    if (!isPlainObject(patch)) {
      throw new Error("[GAME_LOGIC] Patch muss Plain-Object sein.");
    }

    if (patch.domain !== DEFAULT_DOMAIN) {
      throw new Error(`[GAME_LOGIC] Patch-Domain ungueltig: ${String(patch.domain)}`);
    }

    if (typeof patch.path !== "string" || !patch.path.trim()) {
      throw new Error("[GAME_LOGIC] Patch path fehlt.");
    }

    if (patch.path.includes("__proto__") || patch.path.includes("prototype") || patch.path.includes("constructor")) {
      throw new Error("[GAME_LOGIC] Ungueltiger Patch-Pfad.");
    }

    const allowed = allowedPrefixes.some((prefix) => patch.path === prefix || patch.path.startsWith(`${prefix}.`));
    if (!allowed) {
      throw new Error(`[GAME_LOGIC] Patch-Pfad nicht erlaubt: ${patch.path}`);
    }
  }
}

function buildOperationSummary(action, patches) {
  return {
    action: action.type,
    patchCount: patches.length,
    affectedPaths: patches.map((patch) => patch.path)
  };
}

export class GameLogicController {
  constructor(kernelApi, options = {}) {
    this.kernel = normalizeKernelApi(kernelApi);
    this.domain = typeof options.domain === "string" && options.domain.trim() ? options.domain.trim() : DEFAULT_DOMAIN;
    this.actionSchema = deepFreeze({
      ...DEFAULT_ACTION_SCHEMA,
      ...(isPlainObject(options.actionSchema) ? options.actionSchema : {})
    });
    this.mutationMatrix = deepFreeze({
      ...DEFAULT_MUTATION_MATRIX,
      ...(isPlainObject(options.mutationMatrix) ? options.mutationMatrix : {})
    });
  }

  getActionSchema() {
    return deepClone(this.actionSchema);
  }

  getMutationMatrix() {
    return deepClone(this.mutationMatrix);
  }

  getProgressSnapshot(state = {}) {
    return deepClone(buildProgressSnapshot(state));
  }

  getRewardFeedback(beforeState = {}, afterState = {}, summary = null) {
    return deepClone(buildRewardFeedback(beforeState, afterState, summary));
  }

  calculateAction(input = {}, state = {}) {
    const action = readAction(input);
    const safeState = readState(state);

    validateActionAgainstSchema(action, this.actionSchema);
    const patches = buildPatches(action, safeState);
    validatePatchesAgainstMatrix(patches, this.mutationMatrix);

    return {
      ok: true,
      domain: this.domain,
      action,
      patches: deepClone(patches),
      summary: buildOperationSummary(action, patches)
    };
  }

  reduceState(state = {}, patches = []) {
    return reduceGameState(state, patches);
  }

  applyActionLocally(input = {}, state = {}) {
    const calculation = this.calculateAction(input, state);
    return {
      ...calculation,
      previewState: this.reduceState(state, calculation.patches)
    };
  }

  async planAction(input = {}) {
    const action = readAction(input.action);
    const state = readState(input.state);
    const calculation = this.calculateAction(action, state);

    return this.kernel.planPatch({
      domain: this.domain,
      action,
      state,
      patches: calculation.patches,
      actionSchema: this.actionSchema,
      mutationMatrix: this.mutationMatrix
    });
  }

  async applyAction(input = {}) {
    const action = readAction(input.action);
    const state = readState(input.state);
    const calculation = this.calculateAction(action, state);

    return this.kernel.applyPatch({
      domain: this.domain,
      action,
      state,
      patches: calculation.patches,
      actionSchema: this.actionSchema,
      mutationMatrix: this.mutationMatrix
    });
  }
}

export function createGameLogicController(kernelApi, options = {}) {
  return new GameLogicController(kernelApi, options);
}

export function getDefaultGameActionSchema() {
  return deepClone(DEFAULT_ACTION_SCHEMA);
}

export function getDefaultGameMutationMatrix() {
  return deepClone(DEFAULT_MUTATION_MATRIX);
}


