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
const copy = (value) => JSON.parse(JSON.stringify(value));

class MemoryStorage {
  constructor(initial = {}) { this.data = new Map(Object.entries(initial)); this.writes = []; this.failKey = null; }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) {
    if (this.failKey === key) throw new Error("quota");
    this.writes.push(key);
    this.data.set(key, String(value));
  }
  removeItem(key) { this.data.delete(key); }
}

function runtime(storage = new MemoryStorage()) {
  const sandbox = { console, Date, TextEncoder, Blob, localStorage: storage, navigator: {}, location: { protocol: "file:" } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const name of ["content.js", "strategy.js", "projects.js", "save.js", "engine.js"]) {
    const file = path.join(GAME, name);
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  return { sandbox, engine: sandbox.EchoTownEngine, save: sandbox.EchoTownSave, content: sandbox.EchoTownContent, storage };
}

function legacySnapshot(rt, round, phase, actionPoints = 2) {
  const { engine, content } = rt;
  engine.resetState();
  assert.equal(engine.dispatch({ type: "START_LIFE" }).ok, true);
  const state = engine.getState();
  state.version = 7;
  delete state.settings.volume;
  const life = state.currentLife;
  delete life.strategy; delete life.ledger; delete life.projects;
  life.round = round;
  life.age = content.rounds[round].age;
  life.seed = 4294967001;
  life.resources = { money: 70, energy: 3, health: 7, happiness: 6, pressure: 4, expectation: 5 };
  life.maxResources.energy = 10;
  life.cashflow = { income: 111, expenses: 37, debt: 9 };
  life.skills.study = 8;
  life.progress.learn = 4;
  life.actionPoints = actionPoints;
  const drawnIds = content.opportunities.filter((item) => life.age >= (item.minAge || 0) && (!item.maxAge || life.age <= item.maxAge)).slice(0, 3).map((item) => item.id).reverse();
  life.opportunity = { drawnIds, selectedId: phase === "opportunity" || phase === "skipped" ? null : drawnIds[0], skipped: phase === "skipped", history: [] };
  const feedback = ["feedback", "complete"].includes(phase);
  const count = round + (feedback ? 1 : 0);
  life.actions = Array.from({ length: count }, (_, index) => ({ round: index + 1, age: content.rounds[index].age, label: "旧版选择", result: "不可重算的旧结果", success: index % 2 === 0 }));
  life.lastAction = feedback ? {
    actionId: content.rounds[round].actions[0].id, title: "原事件", result: "原检定结果", future: "原来的后果预告",
    changes: ["学习 +1"], newLevels: [], newSecrets: [], tags: [], newMoments: [], milestones: [], stageBreak: null,
    test: { label: "旧检定", roll: 2, score: 5, difficulty: 6, success: false, text: "这次未通过" },
  } : null;
  state.world.totals = { choices: 53, tests: 7, testWins: 4, workShifts: 12, moneyEarned: 111, moneySpent: 37 };
  if (phase === "complete") {
    life.status = "complete";
    life.outcome = { title: "旧版原结局", copy: "不重新评分", tone: "有人记得", score: 70 };
    life.legacyCandidates = content.legacies.slice(0, 3).map((item) => item.id);
    life.selectedLegacies = life.legacyCandidates.slice(0, 2);
    state.world.completedLives = 1;
    state.world.history = [{ generation: 1, age: life.age, profileId: life.profileId, talentId: life.talentId, goalId: life.goalId, outcomeTitle: life.outcome.title, outcomeCopy: life.outcome.copy, bestSkill: "study", goalProgress: 4, goalTarget: 8, actions: copy(life.actions), legacyIds: [] }];
    state.screen = "ending";
  }
  return copy(state);
}

function installLegacy(rt, state) {
  const prepared = rt.save.prepareImport(JSON.stringify(state));
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  rt.engine.replaceState(prepared.state);
  return rt.engine.getState();
}

function assertMoneyConserved(life) {
  const { opening, totals, entries } = life.ledger;
  assert.equal(life.resources.money, opening.money + totals.income - totals.expenses + totals.borrowed - totals.repaid);
  assert.equal(life.cashflow.debt, opening.debt + totals.borrowed + totals.unpaid - totals.repaid);
  assert.equal(life.cashflow.income, opening.income + totals.income);
  assert.equal(life.cashflow.expenses, opening.expenses + totals.expenses);
  assert.equal(entries.reduce((sum, entry) => sum + entry.money, opening.money), life.resources.money);
  assert.equal(entries.reduce((sum, entry) => sum + entry.debt, opening.debt), life.cashflow.debt);
}

test("v7 migration matrix preserves pending opportunities, AP 0/1/2, feedback and end-of-life facts", () => {
  const rt = runtime();
  let cases = 0;
  for (const round of [0, 3, 6, 10, 16, 22]) {
    const phases = [["opportunity", 2], ...["selected", "skipped", "feedback"].flatMap((phase) => [0, 1, 2].map((ap) => [phase, ap]))];
    if (round === 22) phases.push(["complete", 0], ["complete", 2]);
    for (const [phase, ap] of phases) {
      const source = legacySnapshot(rt, round, phase, ap);
      const original = copy(source);
      const installed = installLegacy(rt, source);
      const life = copy(installed.currentLife);
      delete life.strategy; delete life.ledger; delete life.migration; delete life.projects;
      assert.deepEqual(life, source.currentLife, `${round}/${phase}/${ap}`);
      assert.deepEqual(copy(installed.world), source.world);
      assert.equal(installed.version, 9);
      assert.equal(installed.currentLife.projects.current, null, "old jobs cannot become new project steps");
      assert.equal(installed.currentLife.projects.eligibleFromRound, round < 7 ? 7 : null);
      assert.deepEqual(source, original);
      assert.equal(installed.currentLife.strategy.evidence.length, 0);
      assert.equal(installed.currentLife.strategy.consequences.length, 0);
      assert.ok(Object.values(installed.currentLife.strategy.goals).every((goal) => goal.status === "legacy-settled"));
      assert.equal(installed.currentLife.strategy.migratedThroughStage, rt.content.rounds[round].stage);
      assertMoneyConserved(installed.currentLife);
      const phaseBefore = rt.engine.getLifePhase();
      const reloaded = rt.save.prepareImport(rt.save.serialize(installed));
      assert.equal(reloaded.ok, true);
      rt.engine.replaceState(reloaded.state);
      assert.deepEqual(copy(rt.engine.getState()), copy(installed), "refresh cannot redraw, restore energy, reroll or bill");
      assert.equal(rt.engine.getLifePhase(), phaseBefore);
      assert.equal(rt.storage.writes.length, 0);
      cases++;
    }
  }
  assert.equal(cases, 62);
});

test("a migrated feedback advances once, recovers energy once and charges exactly one next-node bill", () => {
  const rt = runtime();
  const source = legacySnapshot(rt, 10, "feedback", 0);
  installLegacy(rt, source);
  const before = rt.engine.getState().currentLife;
  const result = rt.engine.dispatch({ type: "ADVANCE_ROUND" });
  assert.equal(result.ok, true);
  const after = rt.engine.getState().currentLife;
  const bill = rt.engine.getLivingCost(after.age).cost;
  assert.equal(after.round, 11);
  assert.equal(after.resources.energy, Math.min(before.maxResources.energy, before.resources.energy + 3));
  assert.equal(after.resources.money, before.resources.money - bill);
  assert.equal(after.ledger.entries.filter((item) => item.kind === "bill").length, 1);
  assertMoneyConserved(after);
  const snapshot = rt.engine.getState();
  assert.equal(rt.engine.dispatch({ type: "ADVANCE_ROUND" }).ok, false);
  assert.deepEqual(copy(rt.engine.getState()), copy(snapshot));
});

test("loan proceeds, repayment and unpaid bills obey the ledger conservation equations", () => {
  const rt = runtime();
  const source = legacySnapshot(rt, 11, "skipped", 0);
  installLegacy(rt, source);
  const before = rt.engine.getState().currentLife;
  assert.equal(rt.engine.dispatch({ type: "EVENT_ACTION", id: "take-risk-loan" }).ok, true);
  let life = rt.engine.getState().currentLife;
  assert.equal(life.resources.money - before.resources.money, 20);
  assert.equal(life.cashflow.debt - before.cashflow.debt, 20);
  assert.equal(life.cashflow.income, before.cashflow.income);
  assertMoneyConserved(life);
  assert.equal(rt.engine.dispatch({ type: "ADVANCE_ROUND" }).ok, true);
  const beforeRepay = rt.engine.getState().currentLife;
  assert.equal(rt.engine.dispatch({ type: "REPAY_DEBT", amount: 5 }).ok, true);
  life = rt.engine.getState().currentLife;
  assert.equal(life.cashflow.debt, beforeRepay.cashflow.debt - 5);
  assert.equal(life.cashflow.expenses, beforeRepay.cashflow.expenses);
  assert.equal(life.resources.money, beforeRepay.resources.money - 5);
  assert.equal(life.actionPoints, beforeRepay.actionPoints);
  assertMoneyConserved(life);

  const poor = legacySnapshot(rt, 10, "feedback", 0);
  poor.currentLife.resources.money = 1;
  installLegacy(rt, poor);
  assert.equal(rt.engine.dispatch({ type: "ADVANCE_ROUND" }).ok, true);
  life = rt.engine.getState().currentLife;
  assert.equal(life.resources.money, 0);
  assert.equal(life.cashflow.expenses, poor.currentLife.cashflow.expenses + 1);
  assert.equal(life.cashflow.debt, poor.currentLife.cashflow.debt + 4);
  assertMoneyConserved(life);
});

test("legacy skills above the new stage cap are preserved when buying positive growth", () => {
  const rt = runtime();
  const source = legacySnapshot(rt, 0, "skipped", 2);
  source.currentLife.skills.study = 8;
  installLegacy(rt, source);
  assert.equal(rt.engine.dispatch({ type: "LIFE_ACTION", id: "routine-study" }).ok, true);
  assert.equal(rt.engine.getState().currentLife.skills.study, 8);
});

test("insufficient resources reject before spending points or changing ledger and evidence", () => {
  const rt = runtime();
  const source = legacySnapshot(rt, 11, "selected", 2);
  source.currentLife.resources.money = 0;
  installLegacy(rt, source);
  const before = rt.engine.getState();
  const expensive = rt.content.items.find((item) => item.price > 0);
  assert.equal(rt.engine.dispatch({ type: "BUY_ITEM", id: expensive.id }).ok, false);
  assert.deepEqual(copy(rt.engine.getState()), copy(before));
});

test("choosing a legacy requests persistence so a refresh keeps the pending handoff", () => {
  const rt = runtime();
  installLegacy(rt, legacySnapshot(rt, 22, "complete", 0));
  const life = rt.engine.getState().currentLife;
  const next = life.legacyCandidates.find((id) => !life.selectedLegacies.includes(id));
  const result = rt.engine.dispatch({ type: "TOGGLE_LEGACY", id: next });
  assert.equal(result.ok, true);
  assert.ok(result.events.some((event) => event.type === "persist"));
  const committed = rt.save.persist(rt.engine.getState(), { storage: rt.storage });
  assert.equal(committed.ok, true);
  const restored = rt.save.load({ storage: rt.storage });
  rt.engine.replaceState(restored.state);
  assert.ok(rt.engine.getState().currentLife.selectedLegacies.includes(next));
});

test("malformed or wrong-version v9 primary data cannot be overwritten by ordinary autosave", () => {
  const rt = runtime();
  const defaults = rt.engine.getState();
  for (const malformed of ["not-json", "", '{"version":9}', '{"version":8}', JSON.stringify({ ...defaults, version: 8 }), JSON.stringify({ ...defaults, version: 7 })]) {
    const storage = new MemoryStorage({ [rt.save.CONTRACT.storageKey]: malformed });
    const result = rt.save.persist(defaults, { storage });
    assert.equal(result.ok, false, `must preserve ${JSON.stringify(malformed)}`);
    assert.equal(result.code, "RECOVERY_REQUIRED");
    assert.equal(storage.getItem(rt.save.CONTRACT.storageKey), malformed);
    assert.equal(storage.writes.length, 0);
  }
});
