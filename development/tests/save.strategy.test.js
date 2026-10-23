const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Runs in the proposal directory as well as development/tests after integration.
const SAVE_PATH = fs.existsSync(path.join(__dirname, "save.js"))
  ? path.join(__dirname, "save.js")
  : path.join(__dirname, "..", "game", "save.js");
const AGES = [6, 8, 10, 11, 13, 15, 17, 19, 21, 24, 28, 32, 36, 40, 44, 47, 49, 52, 56, 60, 65, 70, 75];
const copy = (value) => JSON.parse(JSON.stringify(value));
const map = (keys, amount = 0) => Object.fromEntries(keys.split(" ").map((key) => [key, amount]));

function loadSave(overrides = {}) {
  const sandbox = { console, Date, TextEncoder, Blob, ...overrides };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SAVE_PATH, "utf8"), sandbox, { filename: "save.js" });
  return sandbox.EchoTownSave;
}

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.writes = [];
    this.failKey = null;
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    if (key === this.failKey || (typeof this.failKey === "function" && this.failKey(key))) throw new Error("quota");
    this.writes.push(key);
    this.values.set(key, String(value));
  }
  removeItem(key) {
    if (key === this.failKey) throw new Error("blocked");
    this.values.delete(key);
  }
}

function v7State() {
  return {
    version: 7,
    introSeen: true,
    world: {
      completedLives: 0,
      town: map("shop bridge school market archive"),
      history: [], legacyBank: [], collectedLegacyIds: [], achievements: [], secrets: [], moments: [],
      totals: map("choices tests testWins workShifts moneyEarned moneySpent"),
    },
    screen: "game",
    settings: { fontScale: false, sound: false },
    notice: "",
    currentLife: {
      status: "active", generation: 1, age: 6, round: 0, seed: 123456789,
      profileId: "town-child", talentId: "slow-and-steady", goalId: "learn",
      resources: { money: 20, energy: 8, health: 8, happiness: 6, pressure: 0, expectation: 4 },
      maxResources: { energy: 10 },
      skills: map("study craft expression empathy courage", 1),
      relationships: map("family mentor friend partner child neighbor", 1),
      town: map("shop bridge school market archive"),
      build: { attributes: map("appearance intelligence physique family", 5), talentIds: ["slow-and-steady", "good-memory", "warm-heart"], interests: { reading: 1 }, routeTags: [] },
      characters: { mother: 1, qishu: 0 },
      actionPoints: 2, sideActionsUsed: 0, inventory: [], jobId: "none", jobShifts: 0, jobHistory: [],
      cashflow: { income: 0, expenses: 0, debt: 0 },
      lifeLog: [], lifeFeedback: null, sceneVisits: [], sceneFeedback: null, opportunityFeedback: null,
      flags: [], secrets: [], progress: map("learn home connection town record free"),
      inheritedLegacyIds: [], actions: [], lastAction: null, carryForward: null, outcome: null,
      legacyCandidates: [], selectedLegacies: [], newAchievements: [], newSecrets: [], moments: [], newMoments: [],
      opportunity: { drawnIds: ["borrowed-book", "repair-bench", "red-envelope"], selectedId: null, skipped: false, history: [] },
    },
  };
}

function atPhase(phase) {
  const state = v7State();
  const life = state.currentLife;
  if (phase === "home") {
    state.screen = "start";
    state.currentLife = null;
    return state;
  }
  if (phase === "opportunity") return state;
  life.opportunity.selectedId = "borrowed-book";
  life.opportunity.history = [{ age: 6, id: "borrowed-book", label: "借来的书" }];
  if (phase === "arrangement") {
    life.actionPoints = 1;
    return state;
  }
  const round = phase === "final-feedback" || phase === "handoff" ? 22 : 3;
  life.round = round;
  life.age = AGES[round];
  life.actions = Array.from({ length: round + 1 }, (_, index) => ({ round: index + 1, age: AGES[index], label: "一次决定", result: "留下原来的结果", success: true }));
  life.lastAction = {
    actionId: "original-action", title: "原来的选择", result: "这段结果不能重算", future: "下一页的回声",
    changes: ["学习 +1"], newLevels: [], newSecrets: [], tags: [], test: null, stageBreak: null, newMoments: [], milestones: [],
  };
  life.actionPoints = 0;
  if (phase === "handoff") {
    life.status = "complete";
    life.outcome = { title: "原来的结局", copy: "保持原结算", tone: "未完", score: 55 };
    life.legacyCandidates = ["steady-habit", "small-tool"];
    life.selectedLegacies = ["small-tool"];
    state.world.completedLives = 1;
    state.screen = "ending";
    state.world.history = [historyEntry(1)];
  }
  return state;
}

function historyEntry(generation, resultLength = 16) {
  return {
    generation, age: 75, profileId: "town-child", talentId: "slow-and-steady", goalId: "learn",
    outcomeTitle: "一个原有的人生结局", outcomeCopy: "这段历史保持原样", bestSkill: "study", goalProgress: 4, goalTarget: 8,
    cashflow: { income: 17, expenses: 15, debt: 2 },
    talentIds: ["slow-and-steady", "good-memory", "warm-heart"], routeTags: [], inventory: [], legacyIds: ["steady-habit"], achievementIds: [], secretIds: [], momentIds: [], jobHistory: [],
    actions: AGES.map((age, index) => ({ round: index + 1, age, label: "原来的事件选择", result: "人".repeat(resultLength), success: true })),
    lifeLog: AGES.slice(0, 12).map((age) => ({ age, label: "原来的生活安排", result: "原来的结果", kind: "生活" })),
    opportunityHistory: AGES.map((age) => ({ age, id: "borrowed-book", label: "原来的机会" })),
  };
}

function largeHistoryState() {
  const state = atPhase("home");
  state.world.completedLives = 40;
  state.world.history = Array.from({ length: 40 }, (_, index) => historyEntry(index + 1, 80));
  return state;
}

test("v7 migration preserves facts in all operation phases and is idempotent", () => {
  const save = loadSave();
  for (const phase of ["home", "opportunity", "arrangement", "feedback", "final-feedback", "handoff"]) {
    const original = atPhase(phase);
    const snapshot = copy(original);
    const migrated = save.migrateV7ToV8(original);
    assert.deepEqual(original, snapshot, phase);
    assert.equal(migrated.version, 8);
    assert.equal(migrated.settings.volume, 0.6);
    const restored = copy(migrated);
    restored.version = 7;
    delete restored.settings.volume;
    if (restored.currentLife) {
      assert.equal(restored.currentLife.migration.deferGoals, true);
      assert.deepEqual(restored.currentLife.migration.legacyGoalProgress, original.currentLife.progress);
      assert.equal(restored.currentLife.migration.stageId, original.currentLife.round < 4 ? "childhood" : "later");
      delete restored.currentLife.migration;
    }
    assert.deepEqual(restored, original, phase);
    assert.deepEqual(copy(save.migrateV7ToV8(migrated)), copy(migrated), phase);
  }
});

test("strict import rejects shell saves, bad feedback and inconsistent lifecycle", () => {
  const save = loadSave();
  assert.equal(save.prepareImport('{"version":7}').code, "INVALID_SAVE");
  assert.equal(save.prepareImport('{"version":8}').code, "INVALID_SAVE");
  assert.equal(save.prepareImport('{"version":9}').code, "INVALID_SAVE");
  assert.equal(save.prepareImport('{"version":6}').code, "WRONG_VERSION");
  assert.equal(save.prepareImport("not-json").code, "INVALID_JSON");
  const variants = [
    (s) => { s.screen = "ending"; },
    (s) => { s.currentLife = null; },
    (s) => { s.currentLife.opportunity.skipped = true; s.currentLife.opportunity.selectedId = "borrowed-book"; },
    (s) => { s.currentLife.opportunity.selectedId = "unknown"; },
    (s) => { s.currentLife.actionPoints = 1; },
    (s) => { s.currentLife.seed = -1; },
    (s) => { s.currentLife.lifeFeedback = { title: "错误", copy: "错误", changes: "not-an-array" }; },
  ];
  for (const change of variants) {
    const state = v7State(); change(state);
    assert.equal(save.prepareImport(JSON.stringify(state)).ok, false);
  }
  const ending = atPhase("handoff");
  ending.currentLife.outcome = null;
  assert.equal(save.prepareImport(JSON.stringify(ending)).code, "INVALID_SAVE");
  const feedback = atPhase("feedback");
  delete feedback.currentLife.lastAction.newLevels;
  assert.equal(save.prepareImport(JSON.stringify(feedback)).code, "INVALID_SAVE");
});

test("pretty v7 exports above 512 KiB import and round-trip as compact v9 without trimming forty histories", () => {
  const save = loadSave();
  const original = largeHistoryState();
  const pretty = JSON.stringify(original, null, 2);
  assert.ok(save.byteLength(pretty) > save.CONTRACT.maxBytes, "fixture must reproduce the legacy exporter defect");
  assert.ok(save.byteLength(pretty) < save.CONTRACT.maxInputBytes);
  const result = save.prepareImport(pretty);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.state.world.history.length, 40);
  assert.deepEqual(copy(result.state.world.history), original.world.history);
  assert.ok(save.byteLength(result.payload) <= save.CONTRACT.maxBytes);
  assert.equal(result.payload.includes("\n"), false);
  assert.equal(save.serialize(result.state, { pretty: true }), result.payload);
  const restored = save.prepareImport(save.serialize(result.state));
  assert.equal(restored.ok, true);
  assert.deepEqual(copy(restored.state), copy(result.state));
});

test("input byte limit and effective compact limit are independent and count UTF-8", () => {
  const save = loadSave();
  assert.equal(save.prepareImport(" ".repeat(save.CONTRACT.maxInputBytes + 1)).code, "INPUT_TOO_LARGE");
  const state = v7State();
  state.notice = "字".repeat(180000);
  const raw = JSON.stringify(state);
  assert.ok(raw.length < save.CONTRACT.maxBytes);
  assert.ok(save.byteLength(raw) > save.CONTRACT.maxBytes);
  assert.equal(save.prepareImport(raw).code, "SAVE_TOO_LARGE");
  const fallback = loadSave({ TextEncoder: undefined, Blob: undefined });
  assert.equal(fallback.byteLength("A字😀"), 8);
});

test("import alias only prepares and never calls the old destructive normalizer", () => {
  let normalized = false;
  let storageAccesses = 0;
  const save = loadSave({ localStorage: { getItem() { storageAccesses++; }, setItem() { storageAccesses++; } } });
  const result = save.import(JSON.stringify(v7State()), { normalize() { normalized = true; return { version: 7 }; } });
  assert.equal(result.ok, true);
  assert.equal(normalized, false);
  assert.equal(storageAccesses, 0);
  assert.equal(result.state.version, 9);
});

test("successful import backs up the latest memory, preserves raw v7 and commits only the v9 key", () => {
  const save = loadSave();
  const source = JSON.stringify(atPhase("feedback"), null, 2);
  const prepared = save.prepareImport(source);
  const current = save.migrateToCurrent(v7State());
  current.notice = "晚于磁盘的当前进度";
  const originalMemory = copy(current);
  const storage = new MemoryStorage({ [save.CONTRACT.storageKey]: "previous-disk", [save.CONTRACT.v7StorageKey]: "original-v7" });
  const result = save.commitImport(prepared, current, { storage });
  assert.equal(result.ok, true);
  assert.deepEqual(copy(current), originalMemory);
  assert.deepEqual(JSON.parse(storage.getItem(save.CONTRACT.backupKey)), originalMemory);
  assert.equal(storage.getItem(save.CONTRACT.v7StorageKey), "original-v7");
  assert.equal(storage.getItem(result.sourceBackupKey), source);
  assert.equal(storage.writes[0], save.CONTRACT.backupKey);
  assert.equal(storage.writes.at(-1), save.CONTRACT.storageKey);
  assert.deepEqual(JSON.parse(storage.getItem(save.CONTRACT.storageKey)), copy(prepared.state));
  result.state.currentLife.resources.money++;
  assert.notEqual(result.state.currentLife.resources.money, prepared.state.currentLife.resources.money);
});

test("backup, raw-source backup and main-write failures never change caller memory or the active save", () => {
  const save = loadSave();
  const prepared = save.prepareImport(JSON.stringify(atPhase("feedback")));
  for (const failing of [save.CONTRACT.backupKey, (key) => key.startsWith(save.CONTRACT.v7BackupPrefix), save.CONTRACT.storageKey]) {
    const current = save.migrateToCurrent(v7State());
    const original = JSON.stringify(current);
    const storage = new MemoryStorage({ [save.CONTRACT.storageKey]: "valid-previous-save", [save.CONTRACT.v7StorageKey]: "untouched-v7" });
    storage.failKey = failing;
    const result = save.commitImport(prepared, current, { storage });
    assert.equal(result.ok, false);
    assert.equal(result.code, failing === save.CONTRACT.storageKey ? "STORAGE_WRITE_FAILED" : "BACKUP_WRITE_FAILED");
    assert.equal(JSON.stringify(current), original);
    assert.equal(storage.getItem(save.CONTRACT.storageKey), "valid-previous-save");
    assert.equal(storage.getItem(save.CONTRACT.v7StorageKey), "untouched-v7");
    assert.equal(storage.writes.includes(save.CONTRACT.storageKey), false);
  }
});

test("a changed candidate is revalidated before backups or committing", () => {
  const save = loadSave();
  const prepared = save.prepareImport(JSON.stringify(v7State()));
  prepared.state.currentLife.lastAction = { changes: "broken" };
  const storage = new MemoryStorage({ [save.CONTRACT.storageKey]: "unchanged" });
  const result = save.commitImport(prepared, save.migrateToCurrent(v7State()), { storage });
  assert.equal(result.ok, false);
  assert.equal(storage.writes.length, 0);
});

test("load is read-only and startup migration needs only one new v9 write", () => {
  const save = loadSave();
  const original = JSON.stringify(atPhase("final-feedback"));
  const storage = new MemoryStorage({ [save.CONTRACT.v7StorageKey]: original });
  const loaded = save.load({ storage });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.needsCommit, true);
  assert.equal(loaded.state.currentLife.round, 22);
  assert.equal(storage.writes.length, 0);
  const committed = save.commitImport(loaded, null, { storage, startupMigration: true });
  assert.equal(committed.ok, true);
  assert.deepEqual(storage.writes, [save.CONTRACT.storageKey]);
  assert.equal(storage.getItem(save.CONTRACT.v7StorageKey), original);
  const reloaded = save.load({ storage });
  assert.equal(reloaded.needsCommit, false);
  assert.deepEqual(copy(reloaded.state), copy(committed.state));
});

test("startup migration cannot overwrite a newly appeared v9/v8 or a changed v7", () => {
  const save = loadSave();
  for (const changedKey of [save.CONTRACT.storageKey, save.CONTRACT.previousStorageKey, save.CONTRACT.v7StorageKey]) {
    const storage = new MemoryStorage({ [save.CONTRACT.v7StorageKey]: JSON.stringify(v7State()) });
    const loaded = save.load({ storage });
    storage.values.set(changedKey, "newer-save");
    const result = save.commitImport(loaded, null, { storage, startupMigration: true });
    assert.equal(result.code, "STORAGE_CHANGED");
    assert.equal(storage.writes.length, 0);
    assert.equal(storage.getItem(changedKey), "newer-save");
  }
});

test("load never replaces corrupt v9/v8 with older v7 or an empty default", () => {
  const save = loadSave();
  for (const sourceKey of [save.CONTRACT.storageKey, save.CONTRACT.previousStorageKey]) {
    const storage = new MemoryStorage({ [save.CONTRACT.v7StorageKey]: JSON.stringify(v7State()), [sourceKey]: "bad-json" });
    const result = save.load({ storage, defaultState: save.migrateToCurrent(atPhase("home")) });
    assert.equal(result.ok, false);
    assert.equal(result.recoveryRequired, true);
    assert.equal(result.sourceKey, sourceKey);
    assert.equal(result.state, undefined);
    assert.equal(storage.writes.length, 0);
  }
});

test("ordinary save failure preserves memory and does not write or downgrade the v7 key", () => {
  const save = loadSave();
  const current = save.migrateToCurrent(v7State());
  const before = copy(current);
  const stored = save.serialize(current);
  const storage = new MemoryStorage({ [save.CONTRACT.storageKey]: stored, [save.CONTRACT.v7StorageKey]: "old-v7" });
  storage.failKey = save.CONTRACT.storageKey;
  assert.equal(save.persist(current, { storage }).code, "STORAGE_WRITE_FAILED");
  assert.deepEqual(copy(current), before);
  assert.equal(storage.getItem(save.CONTRACT.storageKey), stored);
  assert.equal(storage.getItem(save.CONTRACT.v7StorageKey), "old-v7");
  assert.equal(save.persist(v7State(), { storage }).code, "WRONG_VERSION");
  assert.equal(save.persist(current, { storage: null }).code, "STORAGE_UNAVAILABLE");
});

test("clearing v9 does not resurrect preserved v8/v7 on reload; failed clear keeps the active save", () => {
  const save = loadSave();
  const oldV7 = JSON.stringify(v7State());
  const oldV8 = save.serialize(save.migrateV7ToV8(atPhase("feedback")));
  const currentV9 = save.serialize(save.migrateToCurrent(atPhase("feedback")));
  const storage = new MemoryStorage({ [save.CONTRACT.storageKey]: currentV9, [save.CONTRACT.previousStorageKey]: oldV8, [save.CONTRACT.v7StorageKey]: oldV7 });
  storage.failKey = save.CONTRACT.storageKey;
  assert.equal(save.remove({ storage }).ok, false);
  assert.equal(storage.getItem(save.CONTRACT.storageKey), currentV9);
  storage.failKey = null;
  assert.equal(save.remove({ storage }).ok, true);
  assert.equal(storage.getItem(save.CONTRACT.v7StorageKey), oldV7);
  assert.equal(storage.getItem(save.CONTRACT.previousStorageKey), oldV8);
  const loaded = save.load({ storage, defaultState: save.migrateToCurrent(atPhase("home")) });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.cleared, true);
  assert.equal(loaded.needsCommit, false);
  assert.equal(loaded.state.currentLife, null);
  assert.equal(loaded.state.world.completedLives, 0);
});

test("optional setup is preserved and malformed arrays or non-finite values are rejected", () => {
  const save = loadSave();
  const state = save.migrateToCurrent(atPhase("home"));
  state.setup = { profileId: "scholar", talentId: "good-memory", talentIds: ["good-memory"], goalId: "learn", routeId: "study", attributes: { appearance: 3, intelligence: 8, physique: 5, family: 4 } };
  const imported = save.prepareImport(JSON.stringify(state));
  assert.equal(imported.ok, true);
  assert.deepEqual(copy(imported.state.setup), state.setup);
  state.setup.talentIds = "bad";
  assert.equal(save.prepareImport(JSON.stringify(state)).ok, false);
  state.setup.talentIds = [];
  state.setup.attributes.intelligence = Infinity;
  assert.equal(save.validateState(state).ok, false);
  const ending = atPhase("handoff");
  ending.currentLife.outcome.consequences = {};
  assert.equal(save.prepareImport(JSON.stringify(ending)).ok, false);
});

test("ledger extensions retain exact transactions and reject malformed numeric or array fields", () => {
  const save = loadSave();
  const state = save.migrateToCurrent(v7State());
  state.currentLife.ledger = {
    opening: { money: 20, debt: 0, income: 0, expenses: 0 },
    totals: { income: 5, expenses: 2, borrowed: 0, repaid: 0, unpaid: 0 },
    entries: [{ round: 0, id: "job-1", kind: "job", money: 5, debt: 0, balance: 25 }, { round: 0, id: "purchase-1", kind: "item", money: -2, debt: 0, balance: 23 }],
  };
  const result = save.prepareImport(JSON.stringify(state));
  assert.equal(result.ok, true);
  assert.deepEqual(copy(result.state.currentLife.ledger), state.currentLife.ledger);
  for (const change of [
    (ledger) => { ledger.entries = {}; },
    (ledger) => { ledger.totals.repaid = "2"; },
    (ledger) => { ledger.entries[0].balance = Infinity; },
    (ledger) => { ledger.entries[0].money = null; },
    (ledger) => { ledger.opening.debt = -1; },
  ]) {
    const malformed = copy(state); change(malformed.currentLife.ledger);
    assert.equal(save.validateState(malformed).ok, false);
  }
  const history = historyEntry(1);
  history.ledger = { opening: copy(state.currentLife.ledger.opening), totals: copy(state.currentLife.ledger.totals) };
  const archived = save.migrateToCurrent(atPhase("home"));
  archived.world.completedLives = 1;
  archived.world.history = [history];
  assert.equal(save.prepareImport(JSON.stringify(archived)).ok, true);
});

test("strategy state is preserved without trusting malformed arrays, goal marks or evidence", () => {
  const save = loadSave();
  const state = save.migrateToCurrent(atPhase("feedback"));
  state.currentLife.strategy = {
    version: 1, routeId: "craft", migratedThroughStage: "childhood",
    goals: { "craft:childhood": { status: "legacy-settled", round: 3, checks: [] } },
    evidence: [{ id: "routine-repair", kind: "life", round: 3, success: true }],
    consequences: [],
  };
  const imported = save.prepareImport(JSON.stringify(state));
  assert.equal(imported.ok, true);
  assert.deepEqual(copy(imported.state.currentLife.strategy), state.currentLife.strategy);
  for (const change of [
    (strategy) => { strategy.goals = []; },
    (strategy) => { strategy.goals["craft:childhood"].checks = {}; },
    (strategy) => { strategy.goals["craft:childhood"].round = Infinity; },
    (strategy) => { strategy.goals["craft:childhood"].status = "invented"; },
    (strategy) => { strategy.evidence = "broken"; },
    (strategy) => { strategy.evidence.push(copy(strategy.evidence[0])); },
    (strategy) => { strategy.evidence[0].round = 4; },
    (strategy) => { strategy.consequences = {}; },
    (strategy) => { strategy.consequences = [{ id: "outcome", round: 3, success: "yes" }]; },
    (strategy) => { strategy.migratedThroughStage = "unknown-stage"; },
  ]) {
    const malformed = copy(state); change(malformed.currentLife.strategy);
    assert.equal(save.validateState(malformed).ok, false);
  }
  const archived = save.migrateToCurrent(atPhase("home"));
  const history = historyEntry(1);
  history.strategy = { routeId: "craft", goals: copy(state.currentLife.strategy.goals), consequences: [] };
  archived.world.completedLives = 1;
  archived.world.history = [history];
  assert.equal(save.prepareImport(JSON.stringify(archived)).ok, true);
});

test("forty archives with full goal marks, compact consequences, project summaries and ledger totals still round-trip below 512 KiB", () => {
  const save = loadSave();
  const state = save.migrateToCurrent(largeHistoryState());
  for (const entry of state.world.history) {
    const goals = {};
    for (const route of ["craft", "study", "community"]) {
      ["childhood", "adolescence", "youth", "middle", "later"].forEach((stage, index) => {
        goals[`${route}:${stage}`] = { status: "achieved", round: [3, 6, 10, 16, 22][index], checks: [true, true, true, true] };
      });
    }
    entry.strategy = {
      routeId: "craft", goals,
      consequences: ["craft-orders-delivered", "study-report-verified", "community-roster-worked"].map((id) => ({ id, round: 16, success: true })),
    };
    entry.projects = { id: "craft-customers-youth-v1", status: "completed", resultId: "craft-customers-youth-v1:completed", settledRound: 10, stepsDone: 3, preparationActionId: "toolkit", finalCraft: 6 };
    entry.ledger = {
      opening: { money: 20, debt: 0, income: 0, expenses: 0 },
      totals: { income: 99, expenses: 87, borrowed: 10, repaid: 10, unpaid: 0 },
    };
  }
  const serialized = save.serialize(state);
  assert.ok(save.byteLength(serialized) <= save.CONTRACT.maxBytes);
  const imported = save.prepareImport(serialized);
  assert.equal(imported.ok, true);
  assert.deepEqual(copy(imported.state), copy(state));
});

test("failed startup migration leaves its sole original v7 backup intact", () => {
  const save = loadSave();
  const raw = JSON.stringify(atPhase("handoff"));
  const storage = new MemoryStorage({ [save.CONTRACT.v7StorageKey]: raw });
  const prepared = save.load({ storage });
  storage.failKey = save.CONTRACT.storageKey;
  const before = copy(prepared.state);
  const result = save.commitImport(prepared, null, { storage, startupMigration: true });
  assert.equal(result.code, "STORAGE_WRITE_FAILED");
  assert.equal(storage.getItem(save.CONTRACT.storageKey), null);
  assert.equal(storage.getItem(save.CONTRACT.v7StorageKey), raw);
  assert.deepEqual(copy(prepared.state), before);
});

test("missing or incomplete build is rejected before import can replace playable progress", () => {
  const save = loadSave();
  for (const version of [7, 8, 9]) {
    for (const malformedBuild of [undefined, null, {}, { attributes: {} }]) {
      const state = version === 7 ? v7State() : version === 8 ? save.migrateV7ToV8(v7State()) : save.migrateToCurrent(v7State());
      state.currentLife.build = malformedBuild;
      assert.equal(save.prepareImport(JSON.stringify(state)).code, "INVALID_SAVE");
    }
  }
});
