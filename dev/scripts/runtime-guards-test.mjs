import { strict as assert } from 'node:assert';
import { withDeterminismGuards } from '../../app/src/kernel/runtimeGuards.js';

function expectThrow(label, fn) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof Error, `${label} should throw`);
}

await withDeterminismGuards(async () => {
  expectThrow('Math.random', () => Math.random());
  expectThrow('Date.now', () => Date.now());
  expectThrow('Date() function call', () => Date());
  expectThrow('new Date() without args', () => new Date());

  if (globalThis.performance && typeof globalThis.performance.now === 'function') {
    expectThrow('performance.now', () => globalThis.performance.now());
  }

  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    expectThrow('crypto.getRandomValues', () => globalThis.crypto.getRandomValues(new Uint8Array(8)));
  }

  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    expectThrow('crypto.randomUUID', () => globalThis.crypto.randomUUID());
  }
});

assert.equal(typeof Math.random(), 'number', 'Math.random should be restored after guard scope');

console.log('[runtime-guards-test] ok');
