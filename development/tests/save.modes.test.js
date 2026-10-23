"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), test = require("node:test");
let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development/game/engine.js"))) ROOT = path.dirname(ROOT);
const copy = value => JSON.parse(JSON.stringify(value));
class Storage {
  constructor(initial = {}) { this.data = new Map(Object.entries(initial)); this.fail = null; this.writes = []; this.onWrite = null; }
  get length() { return this.data.size; }
  key(n) { return [...this.data.keys()][n] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.fail?.(key, value)) throw new Error("quota"); this.writes.push(key); this.data.set(key, String(value)); this.onWrite?.(key, value); }
  removeItem(key) { this.data.delete(key); }
}
function runtime(storage = new Storage(), withModes = true) {
  const box = { console, TextEncoder, Blob, Date, localStorage: storage }; box.window = box; vm.createContext(box);
  for (const name of ["content", "strategy", "projects", "journey", "save", "engine", ...(withModes ? ["modes"] : [])]) {
    const file = path.join(ROOT, "development/game", name + ".js");
    vm.runInContext(fs.readFileSync(file, "utf8"), box, { filename: file });
  }
  return { e: box.EchoTownEngine, s: box.EchoTownSave, m: box.EchoTownModes, c: box.EchoTownContent, box, storage };
}
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
function cmd(game, type, id) { return ok(game.e.dispatch({ type, id })); }
function startMain(game) { ok(game.m.boot()); ok(game.e.dispatch({ type: "SET_PRESET", routeId: "study" })); cmd(game, "START_LIFE"); ok(game.m.persist()); }
function enterChallenge(game) { return ok(game.m.switchTo("craft-start-v1")); }
function pointer(game) { return game.storage.getItem(game.s.MODE_CONTRACT.pointerKey); }
function currentSnapshot(game) { const i = JSON.parse(pointer(game)); return game.storage.getItem(i.refs[i.activeSlotId]); }
function finishConservativeLife(game) {
  for (const round of game.c.rounds) {
    cmd(game, "SKIP_OPPORTUNITY"); cmd(game, "END_LIFE_ACTIONS");
    cmd(game, "EVENT_ACTION", "steady-" + round.id); cmd(game, "ADVANCE_ROUND");
  }
}

test("actual factory is pure and gives identical fixed challenge, independent of main inheritance/settings/mode", () => {
  const game = runtime(); startMain(game);
  cmd(game, "SKIP_OPPORTUNITY");
  const state = game.e.getState(); state.world.legacyBank = ["small-tool"]; state.settings.volume = 0.11; game.e.replaceState(state);
  game.e.setRuntimeMode("craft-start-v1");
  const before = JSON.stringify(game.e.getState()), setup = JSON.stringify(game.e.getSetup()), writes = game.storage.writes.length;
  const first = game.e.createChallengeState("craft-start-v1"), second = game.e.createChallengeState("craft-start-v1");
  assert.equal(JSON.stringify(first), JSON.stringify(second)); assert.equal(JSON.stringify(game.e.getState()), before); assert.equal(JSON.stringify(game.e.getSetup()), setup);
  assert.equal(game.e.getRuntimeMode(), "craft-start-v1"); assert.equal(game.storage.writes.length, writes);
  assert.equal(first.currentLife.seed, 277191004); assert.equal(first.currentLife.generation, 1); assert.equal(first.currentLife.round, 0);
  assert.deepEqual(copy(first.world.legacyBank), []); assert.deepEqual(copy(first.currentLife.inheritedLegacyIds), []);
  assert.deepEqual(copy(first.setup.attributes), { appearance: 3, intelligence: 5, physique: 6, family: 6 });
  assert.deepEqual(copy(first.setup.talentIds), ["slow-and-steady", "good-memory", "warm-heart"]);
  ok(game.s.prepareSlotImport("craft-start-v1", game.s.serializeSlot("craft-start-v1", first)));
});

test("empty main boots defaults; switch snapshots latest main memory, refresh resumes challenge, load() still main", () => {
  const game = runtime(); ok(game.m.boot()); assert.equal(game.m.getSlotId(), "main"); assert.equal(game.e.getState().currentLife, null);
  cmd(game, "START_LIFE"); ok(game.m.persist()); const original = game.storage.getItem(game.s.CONTRACT.storageKey);
  cmd(game, "SKIP_OPPORTUNITY"); const latest = JSON.stringify(game.e.getState());
  enterChallenge(game); assert.equal(game.e.getRuntimeMode(), "craft-start-v1"); assert.equal(game.storage.getItem(game.s.CONTRACT.storageKey), original);
  assert.equal(JSON.stringify(ok(game.s.load()).state), latest);
  cmd(game, "SKIP_OPPORTUNITY"); cmd(game, "LIFE_ACTION", "routine-rest"); ok(game.m.persist());
  const challenge = JSON.stringify(game.e.getState()); const reloaded = runtime(game.storage); ok(reloaded.m.boot());
  assert.equal(reloaded.m.getSlotId(), "craft-start-v1"); assert.equal(JSON.stringify(reloaded.e.getState()), challenge);
  ok(reloaded.m.switchTo("main")); assert.equal(JSON.stringify(reloaded.e.getState()), latest);
  enterChallenge(reloaded); assert.equal(JSON.stringify(reloaded.e.getState()), challenge);
});

test("v7/v8 originals survive actual startup migration and both mode switches byte-for-byte", () => {
  for (const version of [7,8]) {
    const seed = runtime(), state = seed.e.createChallengeState("craft-start-v1"); state.version = version; delete state.currentLife.projects;
    if (version === 7) { delete state.currentLife.strategy; delete state.currentLife.ledger; delete state.settings.volume; }
    const key = version === 7 ? seed.s.CONTRACT.v7StorageKey : seed.s.CONTRACT.previousStorageKey;
    const raw = JSON.stringify(state, null, 2), storage = new Storage({ [key]: raw });
    const game = runtime(storage); ok(game.m.boot()); assert.equal(game.e.getState().version, 9); const v9 = storage.getItem(game.s.CONTRACT.storageKey);
    enterChallenge(game); ok(game.m.switchTo("main")); assert.equal(storage.getItem(key), raw); assert.equal(storage.getItem(game.s.CONTRACT.storageKey), v9);
    assert.equal(game.e.getState().currentLife.seed, state.currentLife.seed);
  }
});

test("candidate, snapshot and pointer failures preserve current memory/mode and effective main/challenge refs", () => {
  for (const stage of ["normalize", "snapshot", "pointer"]) {
    const game = runtime(); startMain(game); const before = JSON.stringify(game.e.getState()), main = game.storage.getItem(game.s.CONTRACT.storageKey);
    game.storage.fail = key => stage === "snapshot" ? key.startsWith(game.s.MODE_CONTRACT.snapshotPrefix) : stage === "pointer" && key === game.s.MODE_CONTRACT.pointerKey;
    const result = stage === "normalize" ? game.s.switchSlot("craft-start-v1", game.e.getState(), { expectedSourceSlotId: "main", normalize() { throw new Error("invalid target"); }, createTarget: id => game.e.createChallengeState(id) }) : game.m.switchTo("craft-start-v1");
    assert.equal(result.ok, false); assert.equal(JSON.stringify(game.e.getState()), before); assert.equal(game.m.getSlotId(), "main"); assert.equal(pointer(game), null); assert.equal(game.storage.getItem(game.s.CONTRACT.storageKey), main);
    game.storage.fail = null; enterChallenge(game); const active = pointer(game), challenge = JSON.stringify(game.e.getState()), stored = currentSnapshot(game);
    game.storage.fail = key => key === game.s.MODE_CONTRACT.pointerKey;
    assert.equal(game.m.switchTo("main").ok, false); assert.equal(pointer(game), active); assert.equal(currentSnapshot(game), stored); assert.equal(JSON.stringify(game.e.getState()), challenge); assert.equal(game.m.getSlotId(), "craft-start-v1");
  }
});

test("imports are envelope- and slot-bound; failed backup/snapshot/pointer never switches memory or primary refs", () => {
  for (const stage of ["backup", "snapshot", "pointer"]) {
    const game = runtime(); startMain(game); enterChallenge(game); const exported = game.m.serialize();
    assert.equal(JSON.parse(exported).format, "echo-town-challenge"); assert.equal(game.s.prepareSlotImport("main", exported).ok, false);
    assert.equal(game.m.prepareImport(game.s.serialize(game.e.getState())).ok, false);
    cmd(game, "SKIP_OPPORTUNITY"); cmd(game, "LIFE_ACTION", "routine-rest"); ok(game.m.persist());
    const before = JSON.stringify(game.e.getState()), refs = pointer(game), main = JSON.stringify(ok(game.s.load()).state);
    const prepared = ok(game.m.prepareImport(exported));
    game.storage.fail = key => stage === "backup" ? key === game.s.MODE_CONTRACT.challengeBackupKey : stage === "snapshot" ? key.startsWith(game.s.MODE_CONTRACT.snapshotPrefix) : key === game.s.MODE_CONTRACT.pointerKey;
    assert.equal(game.m.commitImport(prepared).ok, false); assert.equal(pointer(game), refs); assert.equal(JSON.stringify(game.e.getState()), before); assert.equal(JSON.stringify(ok(game.s.load()).state), main);
    game.storage.fail = null; ok(game.m.commitImport(prepared));
    assert.equal(JSON.parse(game.storage.getItem(game.s.MODE_CONTRACT.challengeBackupKey)).format, "echo-town-challenge");
    assert.equal(game.storage.getItem(game.s.CONTRACT.backupKey), null); assert.equal(game.e.getState().currentLife.actionPoints, 2);
  }
});

test("fixed challenge identity, rule version, inheritance and second generations cannot be imported", () => {
  const game = runtime(); startMain(game); enterChallenge(game); const raw = JSON.parse(game.m.serialize());
  for (const mutate of [x => x.challengeId = "other", x => x.rulesVersion = "6.1.0", x => x.state.currentLife.seed++, x => x.state.setup.attributes.appearance++, x => x.state.currentLife.generation++, x => x.state.world.legacyBank.push("small-tool"), x => x.state.currentLife.inheritedLegacyIds.push("small-tool")]) {
    const bad = copy(raw); mutate(bad);
    assert.equal(game.m.prepareImport(JSON.stringify(bad)).ok, false);
  }
  assert.equal(game.s.prepareSlotImport("main", JSON.stringify(raw)).ok, false);
});

test("clearing current mode retains active selection and cannot resurrect other or older progress", () => {
  const game = runtime(); startMain(game); const main = JSON.stringify(game.e.getState()); enterChallenge(game);
  cmd(game, "SKIP_OPPORTUNITY"); ok(game.m.persist()); const refs = pointer(game), before = JSON.stringify(game.e.getState());
  game.storage.fail = key => key === game.s.MODE_CONTRACT.pointerKey; assert.equal(game.m.remove().ok, false); assert.equal(pointer(game), refs); assert.equal(JSON.stringify(game.e.getState()), before);
  game.storage.fail = null; ok(game.m.remove()); assert.equal(game.m.getSlotId(), "craft-start-v1");
  const reboot = runtime(game.storage); ok(reboot.m.boot()); assert.equal(reboot.e.getState().currentLife.round, 0); assert.equal(reboot.e.getState().currentLife.opportunity.skipped, false);
  assert.equal(JSON.stringify(ok(reboot.s.load()).state), main); ok(reboot.m.switchTo("main")); ok(reboot.m.remove());
  const cleared = runtime(game.storage); ok(cleared.m.boot()); assert.equal(cleared.e.getState().currentLife, null); enterChallenge(cleared); assert.equal(cleared.e.getState().currentLife.round, 0);
});

test("malformed/missing top refs block fallback, and old main write APIs refuse challenge activity", () => {
  const game = runtime(); startMain(game); enterChallenge(game); const before = game.storage.getItem(game.s.CONTRACT.storageKey);
  assert.equal(game.s.persist(ok(game.s.load()).state).ok, false); assert.equal(game.s.remove().ok, false); assert.equal(game.s.commitImport(game.s.prepareImport(before), ok(game.s.load()).state).ok, false);
  const good = pointer(game), index = JSON.parse(good); game.storage.removeItem(index.refs["craft-start-v1"]);
  assert.equal(game.s.loadActive().ok, false); assert.equal(runtime(game.storage).m.boot().ok, false); assert.equal(game.storage.getItem(game.s.CONTRACT.storageKey), before);
  game.storage.setItem(game.s.MODE_CONTRACT.pointerKey, "bad"); assert.equal(game.s.load().ok, false); assert.equal(game.s.loadActive().ok, false); assert.equal(game.s.persist(game.e.getState()).ok, false);
});

test("snapshot cleanup is bounded across saves, retains both slots, untouched originals and foreign keys", () => {
  const game = runtime(); startMain(game); game.storage.setItem("other-app-snapshot", "retain"); enterChallenge(game);
  const main = JSON.stringify(ok(game.s.load()).state);
  for (let n = 0; n < 80; n++) { ok(game.e.dispatch({ type: "SET_VOLUME", value: n / 100 })); ok(game.m.persist()); }
  const keys = [...game.storage.data.keys()].filter(key => key.startsWith(game.s.MODE_CONTRACT.snapshotPrefix)); assert.equal(keys.length, 2);
  assert.equal(JSON.stringify(ok(game.s.load()).state), main); assert.equal(game.storage.getItem("other-app-snapshot"), "retain");
  assert.notEqual(game.storage.getItem(game.s.CONTRACT.storageKey), null);
});

test("normalization or storage changes during a switch reject stale candidates before pointer commit", () => {
  const game = runtime(); startMain(game); const main = game.e.getState(), before = JSON.stringify(main);
  let calls = 0;
  const result = game.s.switchSlot("craft-start-v1", main, { expectedSourceSlotId: "main", defaultState: game.e.getState(), createTarget: id => game.e.createChallengeState(id), normalize(state) { calls++; if (calls === 2) game.storage.setItem(game.s.CONTRACT.storageKey, JSON.stringify({ ...main, notice: "another tab" })); return game.e.normalizeState(state); } });
  assert.equal(result.ok, false); assert.equal(result.code, "STORAGE_CHANGED"); assert.equal(pointer(game), null); assert.equal(JSON.stringify(game.e.getState()), before);
});

test("actual challenge runs all 23 nodes, saves terminal state, prevents second life and restarts fixed without changing main", () => {
  const game = runtime(); startMain(game); const main = JSON.stringify(game.e.getState()); enterChallenge(game);
  for (const type of ["UPDATE_SETUP", "SET_PRESET", "TOGGLE_LEGACY", "CONFIRM_LEGACIES"]) assert.equal(game.e.dispatch({ type, routeId: "study", id: "small-tool", patch: { goalId: "home" } }).ok, false, type);
  finishConservativeLife(game); assert.equal(game.e.getState().currentLife.status, "complete"); ok(game.m.persist());
  assert.equal(game.e.dispatch({ type: "START_LIFE" }).ok, false); assert.equal(game.e.dispatch({ type: "CONFIRM_LEGACIES" }).ok, false);
  const terminal = game.m.serialize(); ok(game.m.prepareImport(terminal)); const reload = runtime(game.storage); ok(reload.m.boot()); assert.equal(reload.e.getState().currentLife.age, 75);
  ok(reload.m.switchTo("craft-start-v1", { resetTarget: true })); assert.equal(reload.e.getState().currentLife.seed, 277191004); assert.equal(reload.e.getState().currentLife.age, 6); assert.equal(reload.e.getState().world.history.length, 0);
  assert.equal(JSON.stringify(ok(reload.s.load()).state), main); assert.equal(JSON.parse(reload.storage.getItem(reload.s.MODE_CONTRACT.challengeBackupKey)).state.currentLife.status, "complete");
});

test("forty command-only lives survive indexed main persistence/export/reimport without deleting histories", () => {
  const game = runtime(); startMain(game); enterChallenge(game); ok(game.m.switchTo("main")); let largest = 0;
  for (let n = 0; n < 40; n++) {
    if (n) cmd(game, "START_LIFE"); finishConservativeLife(game);
    const life = game.e.getState().currentLife; cmd(game, "TOGGLE_LEGACY", life.legacyCandidates[0]); cmd(game, "CONFIRM_LEGACIES");
    ok(game.m.persist()); const payload = game.m.serialize(); largest = Math.max(largest, Buffer.byteLength(payload));
    ok(game.m.commitImport(ok(game.m.prepareImport(payload)))); assert.equal(game.e.getState().world.history.length, n + 1);
  }
  assert.equal(game.e.getState().world.history.length, 40); assert.ok(largest < 512 * 1024); assert.equal(ok(game.s.load()).state.world.history.length, 40);
  console.log("indexed-main-40-lives-bytes", largest);
});

module.exports = { runtime, Storage, ok, cmd, copy, finishConservativeLife };

test("challenge capacity counts envelope bytes and rejects oversized input before changing effective progress", () => {
  const game = runtime(); startMain(game); enterChallenge(game);
  const candidate = game.e.getState(), original = game.m.serialize();
  candidate.notice = ""; const emptyLength = Buffer.byteLength(game.s.serializeSlot("craft-start-v1", candidate));
  candidate.notice = "x".repeat(game.s.CONTRACT.maxBytes - emptyLength);
  const exact = game.s.serializeSlot("craft-start-v1", candidate); assert.equal(Buffer.byteLength(exact), game.s.CONTRACT.maxBytes); ok(game.m.prepareImport(exact));
  candidate.notice += "x"; const tooBig = { ...JSON.parse(original), state: candidate };
  assert.equal(game.m.prepareImport(JSON.stringify(tooBig)).ok, false); assert.throws(() => game.s.serializeSlot("craft-start-v1", candidate));
  assert.equal(game.m.prepareImport(" ".repeat(game.s.CONTRACT.maxInputBytes + 1)).code, "INPUT_TOO_LARGE");
  assert.equal(game.m.serialize(), original);
});

test("journey variants require exact target, prior failed action and current evidence; archives retain checked variants", () => {
  const game = runtime(); startMain(game);
  const specs = [
    ["journey-craft-repair-v1", "chain-craft-workshop", 12, "chain-craft-trial", 8],
    ["journey-study-recheck-v1", "chain-study-report", 16, "chain-study-trial", 8],
    ["journey-community-replan-v1", "chain-community-flood", 15, "chain-community-roster", 11],
  ];
  for (const [variant, targetId, targetRound, sourceId, sourceRound] of specs) {
    const state = game.e.getState(), life = state.currentLife;
    life.round = targetRound; life.age = game.c.rounds[targetRound].age; life.actionPoints = 0;
    life.opportunity = { drawnIds: [], selectedId: null, skipped: true, history: [] };
    life.actions = [
      { round: sourceRound + 1, age: game.c.rounds[sourceRound].age, actionId: sourceId, label: "此前尝试", result: "失败", success: false },
      { round: targetRound + 1, age: life.age, actionId: targetId, label: "后来补救", result: "结果", success: true, journeyVariant: variant },
    ];
    life.strategy.evidence = [{ round: sourceRound, kind: "event", id: sourceId, success: false }, { round: targetRound, kind: "event", id: targetId, success: true }];
    life.lastAction = { actionId: targetId, title: "补救", result: "结果", future: "以后", changes: [], newLevels: [], newSecrets: [], test: null, stageBreak: null, journeyVariant: variant };
    game.box.EchoTownStrategy.initLife(life);
    ok(game.s.prepareImport(JSON.stringify(state)));
    for (const mutate of [
      x => x.currentLife.actions[1].journeyVariant = "invented", x => x.currentLife.actions[1].actionId = "other",
      x => x.currentLife.actions[0].success = true, x => x.currentLife.strategy.evidence[0].success = true,
      x => x.currentLife.strategy.evidence[0].kind = "life", x => x.currentLife.actions[1].round--,
      x => delete x.currentLife.lastAction.journeyVariant,
    ]) { const bad = copy(state); mutate(bad); assert.equal(game.s.prepareImport(JSON.stringify(bad)).ok, false); }
    const old = copy(state); delete old.currentLife.actions[1].journeyVariant; delete old.currentLife.lastAction.journeyVariant;
    const oldResult = ok(game.s.prepareImport(JSON.stringify(old))); assert.equal(oldResult.state.currentLife.actions[1].journeyVariant, undefined);
  }
  finishConservativeLife(game); const archived = game.e.getState(), history = archived.world.history[0];
  history.actions[8] = { ...history.actions[8], actionId: "chain-craft-trial", success: false };
  history.actions[12] = { ...history.actions[12], actionId: "chain-craft-workshop", journeyVariant: "journey-craft-repair-v1" };
  ok(game.s.prepareImport(JSON.stringify(archived)));
  history.actions[8].success = true; assert.equal(game.s.prepareImport(JSON.stringify(archived)).ok, false);
});

test("indexed main imports keep raw v7/v8 backups isolated from challenge and backup latest unsaved memory", () => {
  const game = runtime(); startMain(game); enterChallenge(game); const challenge = game.m.serialize(); ok(game.m.switchTo("main"));
  for (const version of [7,8]) {
    ok(game.e.dispatch({ type: "SET_VOLUME", value: 0.37 + version / 100 }));
    const latest = JSON.stringify(game.e.getState()), source = game.e.getState(); source.version = version; delete source.currentLife.projects;
    if (version === 7) { delete source.currentLife.strategy; delete source.currentLife.ledger; }
    const raw = JSON.stringify(source, null, 2), result = ok(game.m.commitImport(ok(game.m.prepareImport(raw))));
    assert.equal(game.storage.getItem(game.s.CONTRACT.backupKey), latest); assert.equal(game.storage.getItem(result.sourceBackupKey), raw);
    const expectedPrefix = version === 7 ? game.s.CONTRACT.v7BackupPrefix : game.s.CONTRACT.v8BackupPrefix; assert.ok(result.sourceBackupKey.startsWith(expectedPrefix));
  }
  enterChallenge(game); assert.equal(game.m.serialize(), challenge);
});
