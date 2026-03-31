import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function resolveNpmCommand(script) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && npmExecPath.endsWith("npm-cli.js")) {
    return {
      command: process.execPath,
      args: [npmExecPath, "run", script],
      rendered: `node ${npmExecPath} run ${script}`
    };
  }
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return {
    command: npmCmd,
    args: ["run", script],
    rendered: `${npmCmd} run ${script}`
  };
}

function run(command, args, rendered) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  if (result.error) {
    throw new Error(`[GOVERNANCE_POLICY] command failed: ${rendered} (${String(result.error?.message || result.error)})`);
  }
  if (result.status !== 0) {
    throw new Error(`[GOVERNANCE_POLICY] command failed (${result.status}): ${rendered}`);
  }
}

function readGitValue(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return "";
  }
  return String(result.stdout || "").trim();
}

function resolveCiRange() {
  const eventName = String(process.env.GITHUB_EVENT_NAME || "").trim();
  if (eventName === "push") {
    const eventPath = String(process.env.GITHUB_EVENT_PATH || "").trim();
    if (!eventPath) {
      throw new Error("[GOVERNANCE_POLICY] missing GITHUB_EVENT_PATH for push range resolution");
    }
    const payload = JSON.parse(readFileSync(eventPath, "utf8"));
    const before = String(payload?.before || "").trim();
    if (!before || /^0+$/.test(before)) {
      throw new Error("[GOVERNANCE_POLICY] invalid push 'before' SHA for range verification");
    }
    return `${before}..HEAD`;
  }

  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main";
  if (!readGitValue(["rev-parse", "--verify", baseRef])) {
    throw new Error(`[GOVERNANCE_POLICY] missing CI base ref for range verify: ${baseRef}`);
  }
  return `${baseRef}..HEAD`;
}

function ensureHooksPath() {
  const hooksPath = readGitValue(["config", "--get", "core.hooksPath"]);
  if (hooksPath !== ".githooks") {
    throw new Error(`[GOVERNANCE_POLICY] core.hooksPath must be '.githooks' (found '${hooksPath || "<empty>"}')`);
  }
}

function main() {
  const isCi = String(process.env.CI || "").toLowerCase() === "true" || !!process.env.GITHUB_ACTIONS;
  const signingArgs = ["dev/tools/runtime/signing-guard.mjs", "--head-only", "--allow-empty-range"];
  if (isCi) {
    signingArgs.push("--skip-config");
  }
  run(process.execPath, signingArgs, `node ${signingArgs.join(" ")}`);

  if (isCi) {
    const ciRange = resolveCiRange();
    const rangeArgs = ["dev/tools/runtime/signing-guard.mjs", "--range", ciRange, "--skip-config"];
    run(process.execPath, rangeArgs, `node ${rangeArgs.join(" ")}`);
  } else {
    ensureHooksPath();
    const localRangeArgs = ["dev/tools/runtime/signing-guard.mjs", "--unpublished-origin", "--allow-empty-range"];
    run(process.execPath, localRangeArgs, `node ${localRangeArgs.join(" ")}`);
  }

  const hooks = resolveNpmCommand("hooks:verify");
  run(hooks.command, hooks.args, hooks.rendered);
  const headSubject = readGitValue(["show", "-s", "--format=%s", "HEAD"]);
  if (/^Revert\b/i.test(headSubject)) {
    console.log("[GOVERNANCE_POLICY] rollback parity enforced: revert commits use full required-gate contract");
  }
  console.log(`[GOVERNANCE_POLICY] OK mode=${isCi ? "ci-signature-range+head" : "local-signature+hooks-config"}`);
}

main();
