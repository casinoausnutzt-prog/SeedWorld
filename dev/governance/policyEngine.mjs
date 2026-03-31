// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor DEV-GOVERNANCE-POLICY
//
// Dev-only Policy Engine.
// Prueft Repo-Integritaet, Modul-Konformitaet und Evidence-Konsistenz.
// Laeuft NICHT zur Runtime – nur als Dev-Tool / CI-Gate.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const POLICY_VERSION = 2;
const POLICY_ID = "seedworld-governance-engine.v2";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[DEV_GOVERNANCE] ${message}`);
  }
}

// -- Policy-Schritte ---------------------------------------------------------

export const VERIFY_STEPS = Object.freeze([
  Object.freeze({ id: "module:contract", description: "Game-Module exportieren den Engine-Vertrag", type: "verify" }),
  Object.freeze({ id: "module:source", description: "Game-Module enthalten keine verbotenen Globals", type: "verify" }),
  Object.freeze({ id: "determinism:proof", description: "Reproduktionsbeweis laeuft durch", type: "verify" }),
  Object.freeze({ id: "state:immutability", description: "State-Snapshots sind frozen", type: "verify" }),
  Object.freeze({ id: "seed:consistency", description: "Seed-Hash ist konsistent", type: "verify" }),
  Object.freeze({ id: "evidence:integrity", description: "Evidence-Artefakte sind vorhanden und konsistent", type: "verify" })
]);

export const SYNC_STEPS = Object.freeze([
  Object.freeze({ id: "evidence:generate", description: "Evidence-Artefakte neu generieren", type: "sync" }),
  Object.freeze({ id: "manifest:update", description: "Proof-Manifest aktualisieren", type: "sync" })
]);

// -- Pipeline-Builder --------------------------------------------------------

export function createPipeline({ mode = "verify-first" } = {}) {
  if (mode === "verify-first") {
    return [...VERIFY_STEPS];
  }
  if (mode === "sync-and-verify") {
    return [...SYNC_STEPS, ...VERIFY_STEPS];
  }
  throw new Error(`[DEV_GOVERNANCE] Unbekannter Modus: ${mode}`);
}

// -- Report-Struktur ---------------------------------------------------------

export function createReportBase({ mode = "verify-first", repo = "SeedWorld", startedAt } = {}) {
  return {
    schema_version: POLICY_VERSION,
    policy: POLICY_ID,
    mode,
    repo,
    started_at: startedAt || new Date().toISOString(),
    steps: [],
    overall_status: "PENDING",
    failure_step: null
  };
}

// -- Step-Runner -------------------------------------------------------------

export async function runStep(step, context = {}) {
  const result = {
    id: step.id,
    type: step.type,
    description: step.description,
    status: "PENDING",
    started_at: new Date().toISOString(),
    finished_at: null,
    error: null
  };

  try {
    const handler = STEP_HANDLERS[step.id];
    if (!handler) {
      result.status = "SKIPPED";
      result.error = `Kein Handler fuer Step '${step.id}'.`;
    } else {
      await handler(context);
      result.status = "PASS";
    }
  } catch (error) {
    result.status = "FAIL";
    result.error = String(error.message || error);
  }

  result.finished_at = new Date().toISOString();
  return Object.freeze(result);
}

// -- Pipeline-Runner ---------------------------------------------------------

export async function runPipeline({ mode = "verify-first", context = {} } = {}) {
  const pipeline = createPipeline({ mode });
  const report = createReportBase({ mode });

  for (const step of pipeline) {
    const result = await runStep(step, context);
    report.steps.push(result);
    if (result.status === "FAIL") {
      report.overall_status = "FAILED";
      report.failure_step = step.id;
      break;
    }
  }

  if (!report.failure_step) {
    report.overall_status = "PASS";
  }

  report.finished_at = new Date().toISOString();
  return Object.freeze(report);
}

// -- Step-Handler (erweiterbar) -----------------------------------------------

const STEP_HANDLERS = {
  "module:contract": async (ctx) => {
    assert(ctx.moduleReport, "moduleReport fehlt im Kontext.");
    assert(ctx.moduleReport.valid === true, `Modul-Vertrag ungueltig: ${JSON.stringify(ctx.moduleReport.errors)}`);
  },

  "module:source": async (ctx) => {
    assert(ctx.sourceReport, "sourceReport fehlt im Kontext.");
    assert(ctx.sourceReport.valid === true, `Verbotene Globals: ${ctx.sourceReport.forbiddenReferences.join(", ")}`);
  },

  "determinism:proof": async (ctx) => {
    assert(ctx.proofReport, "proofReport fehlt im Kontext.");
    assert(ctx.proofReport.status === "PASS_REPRODUCED" || ctx.proofReport.status === "SUITE_PASS",
      `Reproduktionsbeweis fehlgeschlagen: ${ctx.proofReport.status}`);
  },

  "state:immutability": async (ctx) => {
    assert(ctx.immutabilityCheck === true, "State-Immutability-Check fehlgeschlagen.");
  },

  "seed:consistency": async (ctx) => {
    assert(ctx.seedConsistent === true, "Seed-Konsistenz-Check fehlgeschlagen.");
  },

  "evidence:integrity": async (ctx) => {
    if (ctx.evidencePath) {
      const evidenceDir = ctx.evidencePath;
      const info = await stat(evidenceDir).catch(() => null);
      assert(info && info.isDirectory(), `Evidence-Verzeichnis nicht gefunden: ${evidenceDir}`);
    }
  },

  "evidence:generate": async (ctx) => {
    // Sync-Step: wird vom aufrufenden Skript ausgefuellt
    if (typeof ctx.generateEvidence === "function") {
      await ctx.generateEvidence();
    }
  },

  "manifest:update": async (ctx) => {
    // Sync-Step: wird vom aufrufenden Skript ausgefuellt
    if (typeof ctx.updateManifest === "function") {
      await ctx.updateManifest();
    }
  }
};

export function registerStepHandler(stepId, handler) {
  assert(typeof stepId === "string" && stepId.trim().length > 0, "stepId fehlt.");
  assert(typeof handler === "function", "handler muss eine Funktion sein.");
  STEP_HANDLERS[stepId] = handler;
}
