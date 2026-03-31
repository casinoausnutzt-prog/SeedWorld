import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { resolveNpmCommand } from "./runtime-metadata.mjs";

// Governance metadata for llm-governance compliance
export const SCHEMA_VERSION = "1.0.0";
export const CHECK_ID = "runtime-execution";
export const CHECK_TYPE = "required-check";

function resolveStepScriptArgs(step) {
  return step.id === "governance:policy:verify" ? ["--head-only"] : [];
}

export function digestText(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function gitWorkingTreeStatus(root) {
  const result = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(
      `[REQUIRED_CHECK] unable to inspect working tree: ${String(result.stderr || result.stdout || "git status failed")}`
    );
  }
  return String(result.stdout || "");
}

export async function sha256File(absPath) {
  const content = await readFile(absPath);
  return createHash("sha256").update(content).digest("hex");
}

export async function runStep(root, step) {
  const scriptArgs = resolveStepScriptArgs(step);
  const npmCommand = resolveNpmCommand(step.script, scriptArgs);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const outputChunks = [];
  const workingTreeBefore = step.type === "verify" ? gitWorkingTreeStatus(root) : null;

  return await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(npmCommand.command, npmCommand.args, {
        cwd: root,
        stdio: ["inherit", "pipe", "pipe"],
        env: {
          ...process.env,
          ...(step.type === "verify"
            ? {
                RUNTIME_VERIFY_READ_ONLY: "1"
              }
            : {})
        }
      });
    } catch (error) {
      reject({
        ...step,
        command: npmCommand.rendered,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        status: "FAILED",
        exit_code: null,
        output_sha256: digestText(String(error?.message || error)),
        error: String(error?.message || error)
      });
      return;
    }

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      outputChunks.push(text);
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      outputChunks.push(text);
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      const endedAt = new Date().toISOString();
      const outputText = outputChunks.join("");
      reject({
        ...step,
        command: npmCommand.rendered,
        started_at: startedAt,
        ended_at: endedAt,
        duration_ms: Date.now() - startedMs,
        status: "FAILED",
        exit_code: null,
        output_sha256: digestText(`${outputText}\n${String(error?.message || error)}`),
        error: String(error?.message || error)
      });
    });

    child.on("close", (code) => {
      const endedAt = new Date().toISOString();
      const outputText = outputChunks.join("");
      if (step.type === "verify") {
        const workingTreeAfter = gitWorkingTreeStatus(root);
        if (workingTreeAfter !== workingTreeBefore) {
          reject({
            ...step,
            command: npmCommand.rendered,
            started_at: startedAt,
            ended_at: endedAt,
            duration_ms: Date.now() - startedMs,
            status: "FAILED",
            exit_code: code,
            output_sha256: digestText(outputText),
            error: "[VERIFY_WRITE_VIOLATION] verify step changed the working tree",
            working_tree_before_sha256: digestText(workingTreeBefore),
            working_tree_after_sha256: digestText(workingTreeAfter)
          });
          return;
        }
      }

      const gate = {
        ...step,
        command: npmCommand.rendered,
        started_at: startedAt,
        ended_at: endedAt,
        duration_ms: Date.now() - startedMs,
        status: code === 0 ? "PASSED" : "FAILED",
        exit_code: code,
        output_sha256: digestText(outputText)
      };
      if (code === 0) {
        resolve(gate);
        return;
      }
      reject(gate);
    });
  });
}

export async function runInternalNodeScript(root, scriptRel, args = [], extraEnv = {}) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptRel, ...args], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...extraEnv
      }
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      reject({
        script: scriptRel,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        exit_code: null,
        output_sha256: digestText(`${output}\n${String(error?.message || error)}`),
        error: String(error?.message || error)
      });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          script: scriptRel,
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startedMs,
          exit_code: 0,
          output_sha256: digestText(output)
        });
        return;
      }
      reject({
        script: scriptRel,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        exit_code: code,
        output_sha256: digestText(output),
        error: `script failed: ${scriptRel}`
      });
    });
  });
}

export function toSyntheticVerifyStep(result, id) {
  return {
    id,
    script: id,
    type: "verify",
    command: `node ${result.script}`,
    started_at: result.started_at,
    ended_at: result.ended_at,
    duration_ms: result.duration_ms,
    status: result.exit_code === 0 ? "PASSED" : "FAILED",
    exit_code: result.exit_code,
    output_sha256: result.output_sha256
  };
}
