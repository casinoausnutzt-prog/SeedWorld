// @doc-anchor ENGINE-CORE
function normalizeMode(value) {
  return value === "shadow" ? "shadow" : "enforce";
}

// Module-level counter ensures globally unique audit IDs across all instances
let globalAuditCounter = 0;

export class GateManager {
  #createAuditId() {
    globalAuditCounter += 1;
    return `audit-${String(globalAuditCounter).padStart(8, "0")}`;
  }

  constructor({ kernelGates, mode = "enforce", onAudit } = {}) {
    if (!kernelGates || typeof kernelGates.executeGate !== "function") {
      throw new Error("[GATE_MANAGER] kernelGates mit executeGate erforderlich.");
    }

    this.kernelGates = kernelGates;
    this.mode = normalizeMode(mode);
    this.onAudit = typeof onAudit === "function" ? onAudit : null;
  }

  setMode(mode) {
    this.mode = normalizeMode(mode);
  }

  async enforce({ domain, actionType, requiredGate, context = {} } = {}) {
    const auditId = this.#createAuditId();
    const baseEvent = {
      auditId,
      domain,
      actionType,
      gateName: requiredGate,
      timestamp: Date.now(),
      mode: this.mode
    };

    if (typeof requiredGate !== "string" || requiredGate.length === 0) {
      const denyEvent = { ...baseEvent, decision: "deny", reason: "missing_required_gate" };
      this.#emitAudit(denyEvent);
      return { allowed: false, auditId, event: denyEvent };
    }

    try {
      const result = await this.kernelGates.executeGate(requiredGate, context);
      const allowEvent = { ...baseEvent, decision: "allow", reason: "gate_pass", gateResult: result };
      this.#emitAudit(allowEvent);
      return { allowed: true, auditId, event: allowEvent };
    } catch (error) {
      const reason = String(error?.message || error || "gate_denied");
      if (this.mode === "shadow") {
        const shadowEvent = { ...baseEvent, decision: "shadow_allow", reason };
        this.#emitAudit(shadowEvent);
        return { allowed: true, auditId, event: shadowEvent };
      }

      const denyEvent = { ...baseEvent, decision: "deny", reason };
      this.#emitAudit(denyEvent);
      return { allowed: false, auditId, event: denyEvent };
    }
  }

  #emitAudit(event) {
    if (this.onAudit) {
      this.onAudit(event);
    }
  }
}
