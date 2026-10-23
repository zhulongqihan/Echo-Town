const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development", "game", "content.js"))) {
  const parent = path.dirname(ROOT);
  if (parent === ROOT) throw new Error("Cannot find game workspace");
  ROOT = parent;
}
const GAME = path.join(ROOT, "development", "game");
const SAVE_PATH = fs.existsSync(path.join(__dirname, "save.js")) ? path.join(__dirname, "save.js") : path.join(GAME, "save.js");
const STRATEGY_PATH = path.join(GAME, "strategy.js");
const copy = (value) => JSON.parse(JSON.stringify(value));

function runtime() {
  const storage = {
    data: new Map(), writes: [],
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
    setItem(key, value) { this.writes.push(key); this.data.set(key, String(value)); },
  };
  const sandbox = { console, Date, TextEncoder, Blob, localStorage: storage };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of [path.join(GAME, "content.js"), STRATEGY_PATH, path.join(GAME, "projects.js"), SAVE_PATH, path.join(GAME, "engine.js")]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  const engine = sandbox.EchoTownEngine;
  assert.equal(engine.dispatch({ type: "START_LIFE" }).ok, true);
  return { sandbox, engine, save: sandbox.EchoTownSave, storage };
}

function validChainState(rt, success) {
  const state = rt.engine.getState();
  const life = state.currentLife;
  life.round = 12;
  life.age = 36;
  life.strategy.evidence = [{ id: "chain-craft-workshop", kind: "event", round: 12, success }];
  life.strategy.consequences = [{ id: success ? "craft-orders-delivered" : "craft-orders-rework", round: 12, success }];
  return state;
}

test("semantic import rejects unknown or noncanonical evidence before any disk or memory change", () => {
  const rt = runtime();
  const before = rt.engine.getState();
  rt.storage.data.set(rt.save.CONTRACT.storageKey, rt.save.serialize(before));
  const rawBefore = rt.storage.getItem(rt.save.CONTRACT.storageKey);
  for (const evidence of [
    { id: "not-a-real-action", kind: "event", round: 0, success: true },
    { id: "chain-craft-workshop", kind: "event", round: 0, success: true },
    { id: "routine-study", kind: "job", round: 0, success: true },
  ]) {
    const incoming = copy(before);
    incoming.currentLife.strategy.evidence = [evidence];
    const original = copy(incoming);
    const prepared = rt.save.prepareImport(JSON.stringify(incoming));
    assert.equal(prepared.ok, false, JSON.stringify(evidence));
    assert.equal(prepared.code, "INVALID_SAVE");
    assert.equal(prepared.path, "currentLife.strategy.evidence");
    assert.deepEqual(copy(rt.engine.getState()), copy(before));
    assert.deepEqual(incoming, original);
    assert.equal(rt.storage.getItem(rt.save.CONTRACT.storageKey), rawBefore);
    assert.equal(rt.storage.writes.length, 0);
  }
});

test("semantic import rejects missing, invented or mismatched consequences", () => {
  const rt = runtime();
  const malformed = [];
  const withoutProof = validChainState(rt, true);
  withoutProof.currentLife.strategy.evidence = [];
  malformed.push(withoutProof);
  const omittedResult = validChainState(rt, true);
  omittedResult.currentLife.strategy.consequences = [];
  malformed.push(omittedResult);
  const wrongResult = validChainState(rt, false);
  wrongResult.currentLife.strategy.consequences[0] = { id: "craft-orders-delivered", round: 12, success: true };
  malformed.push(wrongResult);
  const wrongRound = validChainState(rt, true);
  wrongRound.currentLife.strategy.consequences[0].round = 11;
  malformed.push(wrongRound);
  const unknownResult = validChainState(rt, true);
  unknownResult.currentLife.strategy.consequences[0].id = "invented-result";
  malformed.push(unknownResult);
  for (const incoming of malformed) {
    const result = rt.save.prepareImport(JSON.stringify(incoming));
    assert.equal(result.ok, false);
    assert.equal(result.path, "currentLife.strategy.consequences");
  }
  assert.equal(rt.storage.writes.length, 0);
});

test("valid success and failure chain records remain identical in committed disk and installed memory", () => {
  for (const success of [true, false]) {
    const rt = runtime();
    const incoming = validChainState(rt, success);
    const original = copy(incoming);
    const prepared = rt.save.prepareImport(JSON.stringify(incoming));
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    assert.deepEqual(copy(prepared.state), original);
    assert.deepEqual(copy(incoming), original);
    const committed = rt.save.commitImport(prepared, rt.engine.getState(), { storage: rt.storage });
    assert.equal(committed.ok, true);
    rt.engine.replaceState(committed.state);
    const disk = JSON.parse(rt.storage.getItem(rt.save.CONTRACT.storageKey));
    const memory = rt.engine.getState();
    assert.deepEqual(copy(memory.currentLife.strategy.evidence), disk.currentLife.strategy.evidence);
    assert.deepEqual(copy(memory.currentLife.strategy.consequences), disk.currentLife.strategy.consequences);
  }
});

test("migration may add legacy goal marks without rejecting unchanged evidence or consequences", () => {
  const rt = runtime();
  const incoming = rt.engine.getState();
  incoming.currentLife.migration = { fromVersion: 7, round: 0, stageId: "childhood", deferGoals: true, legacyGoalProgress: copy(incoming.currentLife.progress) };
  incoming.currentLife.strategy.goals = {};
  incoming.currentLife.strategy.migratedThroughStage = null;
  const prepared = rt.save.prepareImport(JSON.stringify(incoming));
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.deepEqual(copy(prepared.state.currentLife.strategy.goals), {});
  rt.engine.replaceState(prepared.state);
  const strategy = rt.engine.getState().currentLife.strategy;
  assert.equal(Object.keys(strategy.goals).length, 3);
  assert.ok(Object.values(strategy.goals).every((goal) => goal.status === "legacy-settled"));
  assert.deepEqual(copy(strategy.evidence), []);
  assert.deepEqual(copy(strategy.consequences), []);
});

test("standalone save keeps structural validation when the strategy runtime is intentionally absent", () => {
  const rt = runtime();
  const incoming = rt.engine.getState();
  incoming.currentLife.strategy.evidence = [{ id: "not-a-real-action", kind: "event", round: 0, success: true }];
  rt.sandbox.EchoTownStrategy = undefined;
  assert.equal(rt.save.prepareImport(JSON.stringify(incoming)).ok, true);
  incoming.currentLife.strategy.evidence = {};
  assert.equal(rt.save.prepareImport(JSON.stringify(incoming)).ok, false);
});
