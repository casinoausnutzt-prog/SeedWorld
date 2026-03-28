import { runScriptTest } from "../helpers/runScriptTest.mjs";

export const id = "02-patch-flow-script";

export async function test({ root }) {
  await runScriptTest({ root, scriptPath: "dev/scripts/patch-flow-test.mjs", label: id });
}

export const run = test;
