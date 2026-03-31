import { readFile } from "node:fs/promises";
import path from "node:path";
import { getGeneratedHooks, HOOKS_DIRNAME } from "./installGitHooks.mjs";

const root = process.cwd();

async function main() {
  const problems = [];

  for (const hook of getGeneratedHooks()) {
    const hookPath = path.join(root, HOOKS_DIRNAME, hook.name);
    let actual = "";
    try {
      actual = await readFile(hookPath, "utf8");
    } catch (error) {
      problems.push(`missing hook file: ${path.relative(root, hookPath)} (${String(error?.message || error)})`);
      continue;
    }

    if (actual !== hook.content) {
      problems.push(`hook drift: ${path.relative(root, hookPath)}`);
    }
  }

  if (problems.length > 0) {
    console.error("[HOOKS] BLOCK");
    for (const problem of problems) {
      console.error(`[HOOKS] ${problem}`);
    }
    console.error("[HOOKS] Run `npm run hooks:install` to resync live hooks with the canonical generator.");
    process.exit(1);
  }

  console.log("[HOOKS] VERIFIED");
}

await main();
