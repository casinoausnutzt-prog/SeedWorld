import { spawn } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node dev/tools/patch/import-dispatch.mjs <zip|json> [--actor <name>] [--session-id <id>]");
  process.exit(1);
}

const child = spawn(process.execPath, ["dev/tools/patch/apply.mjs", "--input", args[0], ...args.slice(1)], {
  cwd: process.cwd(),
  stdio: "inherit"
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});
