// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor DEV-LLM-PLUGIN
//
// LLM-Plugin fuer SeedWorld Dev-Tooling.
// Laeuft NICHT zur Runtime – nur als Dev-Tool fuer Code-Review, Analyse, Generierung.
//
// Plugin-Architektur:
//   - Registriert sich als Dev-Plugin mit definierten Capabilities
//   - Nutzt Prompt-Templates aus dev/plugins/llm/prompts/
//   - Kann ueber OpenAI-kompatible API oder lokale Modelle angesprochen werden
//   - Ergebnisse werden als strukturierte Reports zurueckgegeben

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(PLUGIN_ROOT, "prompts");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[LLM_PLUGIN] ${message}`);
  }
}

// -- Plugin-Manifest ---------------------------------------------------------

export const PLUGIN_MANIFEST = Object.freeze({
  id: "llm-dev-plugin",
  version: "1.0.0",
  type: "dev",
  capabilities: Object.freeze([
    "code-review",
    "module-analysis",
    "determinism-audit",
    "documentation-generation",
    "test-generation"
  ]),
  runtime: false
});

// -- Prompt-Loader -----------------------------------------------------------

export async function loadPrompt(name) {
  assert(typeof name === "string" && name.trim().length > 0, "Prompt-Name fehlt.");
  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    throw new Error(`[LLM_PLUGIN] Prompt '${name}' nicht gefunden: ${filePath}`);
  }
}

// -- LLM-Client (OpenAI-kompatibel) ------------------------------------------

export class LLMClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || null;
    this.baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    this.model = options.model || "gpt-4.1-mini";
    this.maxTokens = options.maxTokens || 4096;
    this.temperature = typeof options.temperature === "number" ? options.temperature : 0;
  }

  async complete(messages) {
    assert(this.apiKey, "API-Key fehlt. Setze OPENAI_API_KEY.");
    assert(Array.isArray(messages) && messages.length > 0, "messages darf nicht leer sein.");

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`[LLM_PLUGIN] API-Fehler ${response.status}: ${text}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

// -- Vordefinierte Analyse-Funktionen ----------------------------------------

export async function reviewModuleSource(client, sourceCode, moduleName) {
  assert(client instanceof LLMClient, "client muss eine LLMClient-Instanz sein.");
  assert(typeof sourceCode === "string", "sourceCode fehlt.");

  let systemPrompt;
  try {
    systemPrompt = await loadPrompt("code-review");
  } catch {
    systemPrompt = "Du bist ein Code-Reviewer fuer deterministische Game-Engines. Pruefe den Code auf nicht-deterministische Muster, Seiteneffekte und Architektur-Probleme. Antworte auf Deutsch in strukturiertem Markdown.";
  }

  const response = await client.complete([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Pruefe folgendes Modul '${moduleName || "unknown"}':\n\n\`\`\`javascript\n${sourceCode}\n\`\`\`` }
  ]);

  return {
    module: moduleName,
    review: response,
    model: client.model,
    timestamp: new Date().toISOString()
  };
}

export async function auditDeterminism(client, proofReport) {
  assert(client instanceof LLMClient, "client muss eine LLMClient-Instanz sein.");

  let systemPrompt;
  try {
    systemPrompt = await loadPrompt("determinism-audit");
  } catch {
    systemPrompt = "Du bist ein Determinismus-Auditor fuer Game-Engines. Analysiere den Reproduktionsbeweis und identifiziere potentielle Schwachstellen. Antworte auf Deutsch in strukturiertem Markdown.";
  }

  const response = await client.complete([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Analysiere diesen Reproduktionsbeweis:\n\n\`\`\`json\n${JSON.stringify(proofReport, null, 2)}\n\`\`\`` }
  ]);

  return {
    audit: response,
    proofStatus: proofReport.status,
    model: client.model,
    timestamp: new Date().toISOString()
  };
}

export async function generateTests(client, moduleSource, moduleName) {
  assert(client instanceof LLMClient, "client muss eine LLMClient-Instanz sein.");

  let systemPrompt;
  try {
    systemPrompt = await loadPrompt("test-generation");
  } catch {
    systemPrompt = "Du bist ein Test-Generator fuer deterministische Game-Engines. Generiere umfassende Tests, die Determinismus, Randfaelle und Fehlerbehandlung abdecken. Antworte mit reinem JavaScript-Code.";
  }

  const response = await client.complete([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Generiere Tests fuer das Modul '${moduleName || "unknown"}':\n\n\`\`\`javascript\n${moduleSource}\n\`\`\`` }
  ]);

  return {
    module: moduleName,
    tests: response,
    model: client.model,
    timestamp: new Date().toISOString()
  };
}
