const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const GAME_DIR = path.join(ROOT, "development", "game");

function readRuntime(name) {
  return fs.readFileSync(path.join(GAME_DIR, name), "utf8");
}

function loadRuntime() {
  const sandbox = {
    console,
    Date,
    TextEncoder,
    Blob,
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readRuntime("content.js"), sandbox, { filename: "content.js" });
  vm.runInContext(readRuntime("strategy.js"), sandbox, { filename: "strategy.js" });
  vm.runInContext(readRuntime("projects.js"), sandbox, { filename: "projects.js" });
  vm.runInContext(readRuntime("save.js"), sandbox, { filename: "save.js" });
  vm.runInContext(readRuntime("engine.js"), sandbox, { filename: "engine.js" });
  return sandbox;
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("runtime namespace exposes separated modules and current contracts", () => {
  const sandbox = loadRuntime();
  const engine = sandbox.EchoTownEngine;
  const save = sandbox.EchoTownSave;

  assert.equal(engine.constants.SAVE_VERSION, 9);
  assert.equal(save.CONTRACT.version, 9);
  assert.equal(save.CONTRACT.maxBytes, 512 * 1024);
  assert.equal(engine.constants.CONTENT.maxRounds, 23);
  assert.equal(engine.constants.CONTENT.actionPointsPerRound, 2);
  assert.equal(typeof engine.dispatch, "function");
  assert.equal(typeof save.persist, "function");
  assert.equal(typeof save.import, "function");
});

test("engine initialization is deterministic and keeps state serializable", () => {
  const sandbox = loadRuntime();
  const engine = sandbox.EchoTownEngine;
  const setup = engine.getSetup();
  const first = engine.createPreviewLife(setup.profileId, setup.talentId, setup.goalId, setup);
  const second = engine.createPreviewLife(setup.profileId, setup.talentId, setup.goalId, setup);

  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.equal(first.round, 0);
  assert.equal(first.actionPoints, 2);
  assert.equal(first.opportunity.drawnIds.length, 3);
});

test("engine command flow enforces opportunity and action-point boundaries", () => {
  const sandbox = loadRuntime();
  const engine = sandbox.EchoTownEngine;
  engine.resetState();

  const started = engine.dispatch({ type: "START_LIFE" });
  assert.equal(started.ok, true);
  assert.equal(engine.getState().currentLife.status, "active");

  const blockedEvent = engine.dispatch({ type: "EVENT_ACTION", id: engine.constants.CONTENT.rounds[0].actions[0].id });
  assert.equal(blockedEvent.ok, false);
  assert.equal(engine.getState().currentLife.actionPoints, 2);

  const skipped = engine.dispatch({ type: "SKIP_OPPORTUNITY" });
  assert.equal(skipped.ok, true);
  assert.equal(engine.getState().currentLife.opportunity.skipped, true);

  const firstAction = engine.dispatch({ type: "LIFE_ACTION", id: "routine-rest" });
  assert.equal(firstAction.ok, true);
  assert.equal(engine.getState().currentLife.actionPoints, 1);

  const secondAction = engine.dispatch({ type: "LIFE_ACTION", id: "routine-rest" });
  assert.equal(secondAction.ok, true);
  assert.equal(engine.getState().currentLife.actionPoints, 0);

  const thirdAction = engine.dispatch({ type: "LIFE_ACTION", id: "routine-rest" });
  assert.equal(thirdAction.ok, false);
  assert.equal(engine.getState().currentLife.actionPoints, 0);
});

test("save round trip keeps v9 data and rejects invalid imports", () => {
  const sandbox = loadRuntime();
  const engine = sandbox.EchoTownEngine;
  const save = sandbox.EchoTownSave;
  const storage = new MemoryStorage();
  const state = engine.getState();

  assert.equal(save.persist(state, { storage }).ok, true);
  const stored = JSON.parse(storage.getItem(save.CONTRACT.storageKey));
  assert.equal(stored.version, 9);

  const parsed = save.import(storage.getItem(save.CONTRACT.storageKey), { normalize: engine.normalizeState });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state.version, 9);
  assert.deepEqual(parsed.state.world, state.world);

  const wrongVersion = save.import(JSON.stringify({ version: 6 }), { normalize: engine.normalizeState });
  assert.equal(wrongVersion.ok, false);
  assert.equal(wrongVersion.code, "WRONG_VERSION");

  const malformed = save.import("not-json", { normalize: engine.normalizeState });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, "INVALID_JSON");

  const tooLarge = save.import("x".repeat(2 * 1024 * 1024 + 1), { normalize: engine.normalizeState });
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.code, "INPUT_TOO_LARGE");
});

test("save write failure does not mutate the caller state", () => {
  const sandbox = loadRuntime();
  const save = sandbox.EchoTownSave;
  const state = sandbox.EchoTownEngine.getState();
  const failingStorage = {
    getItem() { return null; },
    setItem() { throw new Error("quota"); },
  };
  const before = JSON.stringify(state);
  const result = save.persist(state, { storage: failingStorage });

  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(state), before);
});
