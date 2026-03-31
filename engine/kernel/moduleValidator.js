// @doc-anchor ENGINE-CORE
// @doc-anchor ENGINE-MODULE-VALIDATOR
// @mut-point MUT-MODULE-CHECK
//
// Prueft Game-Module auf Determinismus-Konformitaet bevor sie registriert werden.
// Ein Game-Modul muss:
//   1. Eine reine Funktion (oder Klasse mit reinen Methoden) sein
//   2. Keine verbotenen Globals referenzieren
//   3. Einen definierten Action-Schema und Mutation-Matrix liefern

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ENGINE_MODULE_VALIDATOR] ${message}`);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const FORBIDDEN_GLOBALS = Object.freeze([
  "Math.random",
  "Date.now",
  "performance.now",
  "crypto.getRandomValues",
  "crypto.randomUUID",
  "setTimeout",
  "setInterval",
  "fetch",
  "XMLHttpRequest"
]);

export function validateModuleContract(moduleExport) {
  assert(moduleExport && typeof moduleExport === "object", "Modul-Export muss ein Objekt sein.");

  const report = {
    valid: true,
    errors: [],
    warnings: [],
    checkedAt: new Date().toISOString()
  };

  // 1. Pflichtfelder pruefen
  if (typeof moduleExport.domain !== "string" || moduleExport.domain.trim().length === 0) {
    report.valid = false;
    report.errors.push("Modul muss 'domain' als nicht-leeren String exportieren.");
  }

  if (!isPlainObject(moduleExport.actionSchema)) {
    report.valid = false;
    report.errors.push("Modul muss 'actionSchema' als Plain Object exportieren.");
  }

  if (!isPlainObject(moduleExport.mutationMatrix)) {
    report.valid = false;
    report.errors.push("Modul muss 'mutationMatrix' als Plain Object exportieren.");
  }

  if (typeof moduleExport.reduce !== "function") {
    report.valid = false;
    report.errors.push("Modul muss 'reduce(state, action)' als Funktion exportieren.");
  }

  if (typeof moduleExport.createInitialState !== "function") {
    report.valid = false;
    report.errors.push("Modul muss 'createInitialState(seed, rng)' als Funktion exportieren.");
  }

  // 2. Action-Schema Struktur pruefen
  if (isPlainObject(moduleExport.actionSchema)) {
    for (const [actionType, schema] of Object.entries(moduleExport.actionSchema)) {
      if (!isPlainObject(schema)) {
        report.errors.push(`actionSchema['${actionType}'] muss ein Plain Object sein.`);
        report.valid = false;
      }
    }
  }

  // 3. Mutation-Matrix Struktur pruefen
  if (isPlainObject(moduleExport.mutationMatrix)) {
    for (const [domain, paths] of Object.entries(moduleExport.mutationMatrix)) {
      if (!Array.isArray(paths)) {
        report.errors.push(`mutationMatrix['${domain}'] muss ein Array von Pfaden sein.`);
        report.valid = false;
      }
    }
  }

  return Object.freeze(report);
}

export function validateModuleSource(sourceCode) {
  assert(typeof sourceCode === "string", "sourceCode muss ein String sein.");

  const report = {
    valid: true,
    forbiddenReferences: [],
    warnings: []
  };

  for (const global of FORBIDDEN_GLOBALS) {
    if (sourceCode.includes(global)) {
      report.valid = false;
      report.forbiddenReferences.push(global);
    }
  }

  // Warnung bei dynamischen Imports
  if (sourceCode.includes("import(")) {
    report.warnings.push("Dynamische Imports gefunden. Kann Determinismus gefaehrden.");
  }

  // Warnung bei eval
  if (sourceCode.includes("eval(") || sourceCode.includes("Function(")) {
    report.warnings.push("eval/Function gefunden. Kann Determinismus gefaehrden.");
    report.valid = false;
  }

  return Object.freeze(report);
}

export { FORBIDDEN_GLOBALS };
