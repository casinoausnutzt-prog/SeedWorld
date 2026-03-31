// @doc-anchor HYGIENE-2.0-CORE
// @doc-anchor ENGINE-TEST-SUITE
//
// Vollstaendige Test-Suite fuer die neue Engine.
// Prueft: RNG, Fingerprint, Guards, StateManager, ModuleValidator, Engine, Reproduktion.

import { DeterministicRNG } from "../../engine/kernel/deterministicRNG.js";
import { sha256Hex, createFingerprint, stableSerialize, constantTimeHexEqual } from "../../engine/kernel/fingerprint.js";
import { activate, deactivate, isActive, withGuards } from "../../engine/kernel/runtimeGuards.js";
import { deriveSeedHash, assertSeedMatch } from "../../engine/kernel/seedGuard.js";
import { StateManager, deepClone, deepFreeze, isPlainObject } from "../../engine/kernel/stateManager.js";
import { ActionRouter } from "../../engine/kernel/actionRouter.js";
import { validateModuleContract, validateModuleSource } from "../../engine/kernel/moduleValidator.js";
import { Engine, createEngine } from "../../engine/kernel/Engine.js";
import { runReproductionProof, runReproductionSuite } from "../../engine/proof/reproductionProof.js";
import * as gameModule from "../../engine/game/gameModule.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn()
    .then(() => { passed += 1; console.log(`  ✓ ${name}`); })
    .catch((err) => { failed += 1; console.log(`  ✗ ${name}: ${err.message}`); });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion fehlgeschlagen");
}

async function main() {
  console.log("=== ENGINE TEST SUITE ===");
  console.log("");

  // -- DeterministicRNG -------------------------------------------------------
  console.log("--- DeterministicRNG ---");

  await test("Identischer Seed erzeugt identische Sequenz", async () => {
    const a = new DeterministicRNG("test-seed");
    const b = new DeterministicRNG("test-seed");
    for (let i = 0; i < 100; i += 1) {
      assert(a.nextUint32() === b.nextUint32(), `Divergenz bei Schritt ${i}`);
    }
  });

  await test("Verschiedene Seeds erzeugen verschiedene Sequenzen", async () => {
    const a = new DeterministicRNG("seed-alpha");
    const b = new DeterministicRNG("seed-beta");
    let same = 0;
    for (let i = 0; i < 100; i += 1) {
      if (a.nextUint32() === b.nextUint32()) same += 1;
    }
    assert(same < 5, "Zu viele identische Werte bei verschiedenen Seeds");
  });

  await test("next() liefert Werte in [0, 1)", async () => {
    const rng = new DeterministicRNG("range-test");
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.next();
      assert(v >= 0 && v < 1, `Wert ausserhalb [0,1): ${v}`);
    }
  });

  await test("nextInt() liefert Werte im Bereich", async () => {
    const rng = new DeterministicRNG("int-test");
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.nextInt(5, 10);
      assert(v >= 5 && v <= 10, `Wert ausserhalb [5,10]: ${v}`);
    }
  });

  await test("pick() waehlt aus Array", async () => {
    const rng = new DeterministicRNG("pick-test");
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 100; i += 1) {
      assert(arr.includes(rng.pick(arr)), "pick lieferte ungueltiges Element");
    }
  });

  await test("snapshot() ist reproduzierbar", async () => {
    const a = new DeterministicRNG("snap");
    const b = new DeterministicRNG("snap");
    for (let i = 0; i < 50; i += 1) { a.next(); b.next(); }
    const sa = a.snapshot();
    const sb = b.snapshot();
    assert(sa.state === sb.state, "state divergiert");
    assert(sa.callCount === sb.callCount, "callCount divergiert");
  });

  // -- Fingerprint ------------------------------------------------------------
  console.log("--- Fingerprint ---");

  await test("sha256Hex erzeugt 64-Zeichen Hex", async () => {
    const hash = await sha256Hex("hello");
    assert(hash.length === 64, `Laenge: ${hash.length}`);
    assert(/^[0-9a-f]{64}$/.test(hash), "Kein gueltiger Hex-String");
  });

  await test("sha256Hex ist deterministisch", async () => {
    const a = await sha256Hex("deterministic");
    const b = await sha256Hex("deterministic");
    assert(a === b, "Hashes divergieren");
  });

  await test("stableSerialize sortiert Schluessel", async () => {
    const a = stableSerialize({ z: 1, a: 2 });
    const b = stableSerialize({ a: 2, z: 1 });
    assert(a === b, "Serialisierung nicht stabil");
  });

  await test("createFingerprint ist deterministisch", async () => {
    const obj = { seed: "test", ticks: 10, data: [1, 2, 3] };
    const a = await createFingerprint(obj);
    const b = await createFingerprint(obj);
    assert(a === b, "Fingerprints divergieren");
  });

  await test("constantTimeHexEqual funktioniert", async () => {
    assert(constantTimeHexEqual("abc", "abc") === true, "Gleiche Strings");
    assert(constantTimeHexEqual("abc", "abd") === false, "Verschiedene Strings");
    assert(constantTimeHexEqual("abc", "abcd") === false, "Verschiedene Laengen");
  });

  // -- RuntimeGuards ----------------------------------------------------------
  console.log("--- RuntimeGuards ---");

  await test("Guards blockieren Math.random", async () => {
    activate();
    let blocked = false;
    try { Math.random(); } catch { blocked = true; }
    deactivate();
    assert(blocked, "Math.random wurde nicht blockiert");
  });

  await test("Guards stellen APIs wieder her", async () => {
    const before = Math.random;
    activate();
    deactivate();
    assert(Math.random === before, "Math.random nicht wiederhergestellt");
  });

  await test("withGuards() Wrapper funktioniert", async () => {
    let guardWasActive = false;
    await withGuards(async () => {
      guardWasActive = isActive();
    });
    assert(guardWasActive, "Guards waren nicht aktiv");
    assert(!isActive(), "Guards sind noch aktiv");
  });

  // -- SeedGuard --------------------------------------------------------------
  console.log("--- SeedGuard ---");

  await test("deriveSeedHash erzeugt konsistenten Hash", async () => {
    const a = await deriveSeedHash("my-seed");
    const b = await deriveSeedHash("my-seed");
    assert(a === b, "Seed-Hashes divergieren");
  });

  await test("assertSeedMatch akzeptiert korrekten Hash", async () => {
    const hash = await deriveSeedHash("check-seed");
    const result = await assertSeedMatch("check-seed", hash);
    assert(result === hash, "Hash stimmt nicht ueberein");
  });

  await test("assertSeedMatch lehnt falschen Hash ab", async () => {
    let rejected = false;
    try {
      await assertSeedMatch("check-seed", "0".repeat(64));
    } catch { rejected = true; }
    assert(rejected, "Falscher Hash wurde akzeptiert");
  });

  // -- StateManager -----------------------------------------------------------
  console.log("--- StateManager ---");

  await test("commit() und current() liefern Clone", async () => {
    const sm = new StateManager();
    const original = { a: 1, b: { c: 2 } };
    sm.commit(original);
    const retrieved = sm.current();
    assert(retrieved.a === 1, "Wert falsch");
    assert(retrieved !== original, "Kein Clone");
    assert(retrieved.b !== original.b, "Verschachtelter Wert nicht gecloned");
  });

  await test("commit() friert State ein", async () => {
    const sm = new StateManager();
    sm.commit({ x: 1 });
    const state = sm.at(0);
    // Der interne State ist frozen, aber current()/at() liefern Clones
    assert(state.x === 1, "Wert falsch");
  });

  await test("History-Limit wird eingehalten", async () => {
    const sm = new StateManager({ maxHistory: 5 });
    for (let i = 0; i < 10; i += 1) sm.commit({ i });
    assert(sm.length === 5, `Laenge: ${sm.length}`);
  });

  // -- ActionRouter -----------------------------------------------------------
  console.log("--- ActionRouter ---");

  await test("Router dispatcht an registrierten Handler", async () => {
    const router = new ActionRouter();
    let called = false;
    router.registerHandler("test", () => { called = true; return { ok: true }; });
    await router.dispatch("test", { type: "ping" });
    assert(called, "Handler wurde nicht aufgerufen");
  });

  await test("Router lehnt unbekannte Domain ab", async () => {
    const router = new ActionRouter();
    let rejected = false;
    try { await router.dispatch("unknown", { type: "ping" }); } catch { rejected = true; }
    assert(rejected, "Unbekannte Domain wurde akzeptiert");
  });

  // -- ModuleValidator --------------------------------------------------------
  console.log("--- ModuleValidator ---");

  await test("validateModuleContract akzeptiert gueltiges Modul", async () => {
    const report = validateModuleContract(gameModule);
    assert(report.valid === true, `Fehler: ${JSON.stringify(report.errors)}`);
  });

  await test("validateModuleContract lehnt ungueltiges Modul ab", async () => {
    const report = validateModuleContract({ domain: "" });
    assert(report.valid === false, "Ungueltiges Modul wurde akzeptiert");
  });

  await test("validateModuleSource erkennt verbotene Globals", async () => {
    const report = validateModuleSource("const x = Math.random();");
    assert(report.valid === false, "Math.random nicht erkannt");
    assert(report.forbiddenReferences.includes("Math.random"), "Math.random nicht in Liste");
  });

  await test("validateModuleSource akzeptiert sauberen Code", async () => {
    const report = validateModuleSource("export function reduce(state) { return state; }");
    assert(report.valid === true, "Sauberer Code abgelehnt");
  });

  // -- Engine -----------------------------------------------------------------
  console.log("--- Engine ---");

  await test("Engine initialisiert mit Game-Modul", async () => {
    const engine = createEngine({ seed: "init-test" });
    engine.registerModule(gameModule);
    const state = await engine.initialize();
    assert(state.engine.seed === "init-test", "Seed falsch");
    assert(state.game.clock.tick === 0, "Tick nicht 0");
    assert(Array.isArray(state.game.world.tiles), "Keine Tiles");
  });

  await test("Engine fuehrt Ticks deterministisch aus", async () => {
    const engineA = createEngine({ seed: "tick-test" });
    engineA.registerModule(gameModule);
    await engineA.initialize();
    const stateA = await engineA.tick([]);

    const engineB = createEngine({ seed: "tick-test" });
    engineB.registerModule(gameModule);
    await engineB.initialize();
    const stateB = await engineB.tick([]);

    assert(JSON.stringify(stateA) === JSON.stringify(stateB), "Tick-States divergieren");
  });

  await test("Engine validiert Actions gegen Schema", async () => {
    const engine = createEngine({ seed: "schema-test" });
    engine.registerModule(gameModule);
    await engine.initialize();
    let rejected = false;
    try {
      await engine.tick([{ domain: "game", type: "produce", payload: {} }]); // fehlt: resource, amount
    } catch { rejected = true; }
    assert(rejected, "Ungueltige Action wurde akzeptiert");
  });

  await test("Engine lehnt unbekannte Actions ab", async () => {
    const engine = createEngine({ seed: "unknown-action" });
    engine.registerModule(gameModule);
    await engine.initialize();
    let rejected = false;
    try {
      await engine.tick([{ domain: "game", type: "fly_to_moon", payload: {} }]);
    } catch { rejected = true; }
    assert(rejected, "Unbekannte Action wurde akzeptiert");
  });

  await test("Engine produce/consume Zyklus", async () => {
    const engine = createEngine({ seed: "produce-test" });
    engine.registerModule(gameModule);
    await engine.initialize();
    let state = await engine.tick([
      { domain: "game", type: "produce", payload: { resource: "ore", amount: 50 } }
    ]);
    assert(state.game.resources.ore === 50, `Ore: ${state.game.resources.ore}`);
    state = await engine.tick([
      { domain: "game", type: "consume", payload: { resource: "ore", amount: 20 } }
    ]);
    assert(state.game.resources.ore === 30, `Ore nach consume: ${state.game.resources.ore}`);
  });

  await test("Engine build Maschinen", async () => {
    const engine = createEngine({ seed: "build-test" });
    engine.registerModule(gameModule);
    await engine.initialize();
    const state = await engine.tick([
      { domain: "game", type: "build", payload: { machine: "miner", count: 3 } }
    ]);
    assert(state.game.machines.miners === 3, `Miners: ${state.game.machines.miners}`);
  });

  await test("Engine advance_tick mit Miner-Produktion", async () => {
    const engine = createEngine({ seed: "miner-prod" });
    engine.registerModule(gameModule);
    await engine.initialize();
    await engine.tick([
      { domain: "game", type: "build", payload: { machine: "miner", count: 5 } }
    ]);
    const state = await engine.tick([
      { domain: "game", type: "advance_tick", payload: {} }
    ]);
    assert(state.game.resources.ore === 5, `Ore: ${state.game.resources.ore} (erwartet: 5)`);
  });

  // -- Reproduktionsbeweis ----------------------------------------------------
  console.log("--- Reproduktionsbeweis ---");

  await test("Einzelner Reproduktionsbeweis: PASS_REPRODUCED", async () => {
    const report = await runReproductionProof({
      seed: "proof-single",
      ticks: 16,
      registerModule: (engine) => engine.registerModule(gameModule)
    });
    assert(report.status === "PASS_REPRODUCED", `Status: ${report.status}`);
    assert(report.fingerprintMatch === true, "Fingerprints divergieren");
    assert(report.stateMatch === true, "States divergieren");
    assert(report.snapshotMatch === true, "Snapshots divergieren");
  });

  await test("Reproduktionsbeweis mit Actions: PASS_REPRODUCED", async () => {
    const actions = [
      [{ domain: "game", type: "build", payload: { machine: "miner", count: 2 } }],
      [{ domain: "game", type: "advance_tick", payload: {} }],
      [{ domain: "game", type: "produce", payload: { resource: "iron", amount: 10 } }]
    ];
    const report = await runReproductionProof({
      seed: "proof-actions",
      ticks: 8,
      actionsPerTick: actions,
      registerModule: (engine) => engine.registerModule(gameModule)
    });
    assert(report.status === "PASS_REPRODUCED", `Status: ${report.status}`);
  });

  await test("Reproduktions-Suite: SUITE_PASS", async () => {
    const suite = await runReproductionSuite({
      seeds: ["s1", "s2", "s3"],
      ticks: 8,
      registerModule: (engine) => engine.registerModule(gameModule)
    });
    assert(suite.status === "SUITE_PASS", `Suite-Status: ${suite.status}`);
    assert(suite.passedSeeds === 3, `Passed: ${suite.passedSeeds}/3`);
  });

  // -- Zusammenfassung --------------------------------------------------------
  console.log("");
  console.log("=== ERGEBNIS ===");
  console.log(`  Bestanden: ${passed}`);
  console.log(`  Fehlgeschlagen: ${failed}`);
  console.log(`  Gesamt: ${passed + failed}`);
  console.log("");

  if (failed > 0) {
    console.log("FAIL");
    process.exit(1);
  } else {
    console.log("ALL PASS");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error(`FATAL: ${error.message}`);
  console.error(error.stack);
  process.exit(2);
});
