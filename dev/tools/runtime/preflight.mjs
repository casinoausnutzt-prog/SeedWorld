import { spawn } from "node:child_process";

function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: "inherit"
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptPath} failed with exit code ${code}`));
      }
    });
  });
}

await runNodeScript("dev/scripts/smoke-test.mjs");
await runNodeScript("dev/scripts/runtime-guards-test.mjs");
await runNodeScript("dev/tools/runtime/signing-guard.mjs", ["--config-only"]);
await runNodeScript("dev/tools/runtime/governance-verify.mjs");
await runNodeScript("dev/tools/runtime/syncDocs.mjs");
console.log("[PREFLIGHT] OK");
