import { spawnSync } from "node:child_process";
import {
  GOVERNANCE_RUN_MODE_SYNC_AND_VERIFY,
  GOVERNANCE_RUN_MODE_VERIFY_FIRST
} from "../../../../app/src/kernel/GovernanceEngine.js";

const MODE_PREFIX = "--mode=";

export function parseRequestedRunMode(argv) {
  const explicitModeIndex = argv.indexOf("--mode");
  if (explicitModeIndex !== -1) {
    const value = argv[explicitModeIndex + 1];
    if (typeof value !== "string" || value.trim().length === 0 || value.startsWith("--")) {
      throw new Error("[REQUIRED_CHECK] --mode requires an explicit value");
    }
    return value.trim();
  }

  const modeArg = argv.find((arg) => typeof arg === "string" && arg.startsWith(MODE_PREFIX));
  if (modeArg) {
    return modeArg.slice(MODE_PREFIX.length).trim();
  }

  if (argv.includes("--verify-only")) {
    return GOVERNANCE_RUN_MODE_VERIFY_FIRST;
  }

  if (argv.includes("--sync-and-verify") || argv.includes("--auto-sync-and-verify")) {
    return GOVERNANCE_RUN_MODE_SYNC_AND_VERIFY;
  }

  return GOVERNANCE_RUN_MODE_VERIFY_FIRST;
}

export function resolveNpmCommand(script, scriptArgs = []) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && npmExecPath.endsWith("npm-cli.js")) {
    return {
      command: process.execPath,
      args: [npmExecPath, "run", script, ...(scriptArgs.length ? ["--", ...scriptArgs] : [])],
      rendered: `node ${npmExecPath} run ${script}${scriptArgs.length ? ` -- ${scriptArgs.join(" ")}` : ""}`
    };
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return {
    command: npmCmd,
    args: ["run", script, ...(scriptArgs.length ? ["--", ...scriptArgs] : [])],
    rendered: `${npmCmd} run ${script}${scriptArgs.length ? ` -- ${scriptArgs.join(" ")}` : ""}`
  };
}

export function gitValue(root, args, fallback = "unknown") {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return fallback;
  }
  const value = String(result.stdout || "").trim();
  return value || fallback;
}

export function gitRequiredValue(root, args, field) {
  const value = gitValue(root, args, "unknown");
  if (!value || value === "unknown") {
    throw new Error(`[REQUIRED_CHECK] missing git metadata: ${field}`);
  }
  return value;
}

export function assertFreshGitMetadata({ head, branch }) {
  if (!/^[0-9a-f]{40}$/i.test(head)) {
    throw new Error(`[REQUIRED_CHECK] stale git metadata: invalid head ${String(head)}`);
  }
  if (typeof branch !== "string" || !branch.trim() || branch === "unknown" || branch === "HEAD") {
    throw new Error(`[REQUIRED_CHECK] stale git metadata: invalid branch ${String(branch)}`);
  }
}

export function assertPipelineContract(runMode, pipeline) {
  const syncStepCount = pipeline.filter((item) => item.type === "sync").length;
  const verifyStepCount = pipeline.filter((item) => item.type === "verify").length;

  if (runMode === GOVERNANCE_RUN_MODE_VERIFY_FIRST) {
    if (syncStepCount !== 0) {
      throw new Error("[REQUIRED_CHECK] verify-first mode must not include sync steps");
    }
    if (verifyStepCount === 0) {
      throw new Error("[REQUIRED_CHECK] verify-first mode must include verify steps");
    }
    return;
  }

  if (runMode === GOVERNANCE_RUN_MODE_SYNC_AND_VERIFY) {
    if (syncStepCount === 0 || verifyStepCount === 0) {
      throw new Error("[REQUIRED_CHECK] sync-and-verify mode must include sync and verify steps");
    }
    return;
  }

  throw new Error(`[REQUIRED_CHECK] unsupported run mode: ${String(runMode)}`);
}
