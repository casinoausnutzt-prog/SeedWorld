import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { LOCK_HEARTBEAT_MS, LOCK_TTL_MS } from './constants.mjs';
import { appendAudit, writeJson } from './session-store.mjs';

function nowIso() {
  return new Date().toISOString();
}

function parseLock(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function acquireLock({ rootDir, lockPath, sessionId, actor }) {
  const now = Date.now();
  const startedAt = nowIso();
  const expiresAt = new Date(now + LOCK_TTL_MS).toISOString();
  const lock = {
    pid: process.pid,
    startedAt,
    heartbeatAt: startedAt,
    expiresAt,
    sessionId,
    actor
  };

  if (existsSync(lockPath)) {
    const existing = parseLock(await readFile(lockPath, 'utf8'));
    if (existing) {
      const expiry = Date.parse(existing.expiresAt || '');
      if (Number.isFinite(expiry) && expiry > now) {
        const error = new Error(`Active terminal lock held by ${existing.sessionId}`);
        error.code = 'LOCK_HELD';
        error.details = existing;
        throw error;
      }

      await appendAudit(rootDir, {
        ts: startedAt,
        type: 'lock-takeover',
        sessionId,
        actor,
        previous: existing
      });
    }
  }

  await writeJson(lockPath, lock);
  const interval = setInterval(async () => {
    const heartbeatAt = nowIso();
    const nextLock = {
      ...lock,
      heartbeatAt,
      expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString()
    };
    await writeJson(lockPath, nextLock);
  }, LOCK_HEARTBEAT_MS);

  return {
    lock,
    heartbeat: interval
  };
}

export async function releaseLock({ lockPath, heartbeat }) {
  if (heartbeat) {
    clearInterval(heartbeat);
  }

  if (existsSync(lockPath)) {
    await rm(lockPath, { force: true });
  }
}
