// @doc-anchor ENGINE-FINGERPRINT
// @mut-point MUT-SHA256-CALC
//
// Deterministisches Hashing und stabile Serialisierung.
// Schluessel werden alphabetisch sortiert. Reproduzierbar ueber Plattformen.

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ENGINE_FINGERPRINT] ${message}`);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export async function sha256Hex(input) {
  assert(typeof input === "string", "sha256Hex erwartet eine Zeichenkette.");
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function stableSerialize(value) {
  return _serialize(value, new WeakSet());
}

function _serialize(value, seen) {
  if (value === null) return "null";
  if (value === undefined) return "undef";
  const t = typeof value;
  if (t === "boolean") return `bool:${value ? "true" : "false"}`;
  if (t === "number") {
    if (Number.isNaN(value)) return "num:NaN";
    if (!Number.isFinite(value)) return value > 0 ? "num:+Infinity" : "num:-Infinity";
    return Object.is(value, -0) ? "num:-0" : `num:${String(value)}`;
  }
  if (t === "string") return `str:${JSON.stringify(value)}`;
  if (t === "bigint") return `bigint:${value.toString()}`;
  if (t === "function" || t === "symbol") {
    throw new TypeError(`[ENGINE_FINGERPRINT] Kann ${t} nicht serialisieren.`);
  }
  if (seen.has(value)) {
    throw new TypeError("[ENGINE_FINGERPRINT] Zyklische Strukturen sind nicht erlaubt.");
  }
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    const items = value.map((v) => _serialize(v, seen));
    result = `arr:[${items.join(",")}]`;
  } else if (value instanceof Map) {
    const entries = [...value.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${_serialize(k, seen)}:${_serialize(v, seen)}`);
    result = `map:{${entries.join(",")}}`;
  } else if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${_serialize(value[k], seen)}`);
    result = `obj:{${entries.join(",")}}`;
  } else {
    seen.delete(value);
    throw new TypeError(
      `[ENGINE_FINGERPRINT] Nur Arrays, Maps und Plain-Objects erlaubt; gesehen: ${Object.prototype.toString.call(value)}`
    );
  }
  seen.delete(value);
  return result;
}

export async function createFingerprint(payload) {
  const canonical = stableSerialize(payload);
  return sha256Hex(canonical);
}

export function constantTimeHexEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
