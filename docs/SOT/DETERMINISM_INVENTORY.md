# Determinism Inventory

## Purpose

This inventory defines which runtime APIs are blocked in deterministic kernel scopes.

## Blocked APIs (Guarded in Runtime)

- `Math.random()`: non-deterministic entropy source
- `Date.now()`: wall-clock variance
- `Date()` without fixed input: wall-clock variance
- `performance.now()`: execution-time variance
- `crypto.getRandomValues()`: non-deterministic entropy source
- `crypto.randomUUID()`: non-deterministic entropy source

Source implementation: `app/src/kernel/runtimeGuards.js`

## Expected Behavior on Violation

- Runtime guard violations throw `[KERNEL_GUARD]` errors immediately.
- Pflichttests duerfen danach keinen Reproduktionsstatus erfolgreich melden.
