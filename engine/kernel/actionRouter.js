// @doc-anchor ENGINE-ROUTER
// @mut-point MUT-ROUTER-DISPATCH
//
// Leitet Actions an registrierte Domain-Handler weiter.
// Fuehrt ein Audit-Log aller Aufrufe.

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ENGINE_ROUTER] ${message}`);
  }
}

export class ActionRouter {
  constructor() {
    this.handlers = new Map();
    this.callHistory = [];
  }

  registerHandler(domain, handler) {
    assert(typeof domain === "string" && domain.trim().length > 0, "domain muss ein nicht-leerer String sein.");
    assert(typeof handler === "function", "handler muss eine Funktion sein.");
    this.handlers.set(domain, handler);
  }

  hasHandler(domain) {
    return this.handlers.has(domain);
  }

  async dispatch(domain, action) {
    assert(typeof domain === "string" && domain.trim().length > 0, "domain fehlt.");
    assert(action && typeof action === "object", "action muss ein Objekt sein.");
    const handler = this.handlers.get(domain);
    assert(handler, `Kein Handler fuer Domain '${domain}' registriert.`);
    const entry = {
      domain,
      actionType: action.type || "unknown",
      timestamp: this.callHistory.length
    };
    this.callHistory.push(entry);
    return handler(action);
  }

  getHistory() {
    return [...this.callHistory];
  }
}
