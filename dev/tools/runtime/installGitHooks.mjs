import { chmod, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] ? resolve(process.argv[1]) === modulePath : false;

export const HOOKS_DIRNAME = ".githooks";
export const HOOK_FILE_NAMES = Object.freeze({
  preCommit: "pre-commit",
  prePush: "pre-push"
});

function parseArgs(argv) {
  const args = {
    explicit: false
  };
  for (const arg of argv) {
    if (arg === "--explicit") {
      args.explicit = true;
    }
  }
  return args;
}

export function renderPreCommitHook() {
  return `#!/bin/sh
set -e

echo "[hook:pre-commit] verify hook sync + chain preflight"
npm run hooks:verify
npm run llm:guard -- --action commit
npm run governance:policy:verify -- --head-only
npm run governance:modularity:verify
npm run governance:llm:verify
npm run governance:subagent:verify
npm run test:verify
`;
}

export function renderPrePushHook() {
  return `#!/bin/sh
set -e

ZERO_SHA="0000000000000000000000000000000000000000"

# Hard safety gate: reject history rewrites and ref deletions.
# pre-push stdin lines: <local ref> <local sha> <remote ref> <remote sha>
verify_ref() {
  local_ref="$1"
  local_sha="$2"
  remote_ref="$3"
  remote_sha="$4"

  if [ "$local_sha" = "$ZERO_SHA" ]; then
    echo "[hook:pre-push] BLOCK: ref deletion is forbidden ($remote_ref)"
    exit 1
  fi

  if [ "$remote_sha" != "$ZERO_SHA" ]; then
    if ! git merge-base --is-ancestor "$remote_sha" "$local_sha"; then
      echo "[hook:pre-push] BLOCK: non-fast-forward push is forbidden ($local_ref -> $remote_ref)"
      echo "[hook:pre-push] BLOCK: --force/--force-with-lease/history rewrite are not allowed."
      exit 1
    fi
    range="$remote_sha..$local_sha"
  else
    upstream_ref=$(git rev-parse --abbrev-ref --symbolic-full-name "\${local_ref}@{upstream}" 2>/dev/null || true)
    if [ -z "$upstream_ref" ]; then
      echo "[hook:pre-push] BLOCK: no deterministic base range for new ref ($local_ref -> $remote_ref)"
      echo "[hook:pre-push] BLOCK: configure an upstream or push with a tracked ref base."
      exit 1
    fi
    range="$upstream_ref..$local_sha"
  fi

  echo "[hook:pre-push] verify ref=$local_ref range=$range"
  npm run governance:policy:verify -- --range "$range"
}

while read local_ref local_sha remote_ref remote_sha
do
  [ -z "$local_ref" ] && continue
  verify_ref "$local_ref" "$local_sha" "$remote_ref" "$remote_sha"
done

echo "[hook:pre-push] verify hook sync + fail-closed proof gate"
echo "[hook:pre-push] all pushed refs verified explicitly"
npm run hooks:verify
npm run check:required:verify-only
echo "[hook:pre-push] recommendation: run 'npm run check:required:verify-only' separately if you need runner-level validation"
`;
}

export function getGeneratedHooks() {
  return Object.freeze([
    { name: HOOK_FILE_NAMES.preCommit, content: renderPreCommitHook() },
    { name: HOOK_FILE_NAMES.prePush, content: renderPrePushHook() }
  ]);
}

export async function installHooks(root = process.cwd()) {
  const hooksDir = resolve(root, HOOKS_DIRNAME);
  await mkdir(hooksDir, { recursive: true });

  for (const hook of getGeneratedHooks()) {
    const hookPath = resolve(hooksDir, hook.name);
    await writeFile(hookPath, hook.content, "utf8");
    await chmod(hookPath, 0o755);
  }

  const configured = spawnSync("git", ["config", "core.hooksPath", HOOKS_DIRNAME], {
    cwd: root,
    stdio: "inherit"
  });
  if (configured.status !== 0) {
    throw new Error("git config core.hooksPath .githooks failed");
  }

  console.log("[HOOKS] installed (.githooks)");
}

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.explicit) {
    console.error("[HOOKS] explicit install required: use `npm run hooks:install`");
    process.exit(1);
  }
  await installHooks();
}
