const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ROOT = path.resolve(__dirname, "../..");
function runtime() {
  const box = { console, TextEncoder, Blob, Date };
  box.window = box;
  vm.createContext(box);
  for (const file of ["content.js", "strategy.js", "projects.js", "save.js", "engine.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "development/game", file), "utf8"), box, { filename: file });
  }
  return { e: box.EchoTownEngine, s: box.EchoTownSave, c: box.EchoTownContent, strategy: box.EchoTownStrategy };
}
function command(e, type, payload = {}) {
  const result = e.dispatch({ type, ...payload });
  assert.equal(result.ok, true, JSON.stringify({ type, payload, error: result.error }));
  return e.getState();
}
function start(e, routeId = "craft") {
  command(e, "SET_PRESET", { routeId });
  command(e, "START_LIFE");
}
function editLife(e, round, edit = () => {}) {
  const state = e.getState();
  const life = state.currentLife;
  life.round = round;
  life.age = e.constants.CONTENT.rounds[round].age;
  life.opportunity = { drawnIds: [], selectedId: null, skipped: true, history: [] };
  life.lastAction = null;
  life.actionPoints = 2;
  edit(life);
  life.ledger = undefined;
  e.replaceState(state);
}
function event(e, id) {
  if (e.getLifePhase() === "management") command(e, "END_LIFE_ACTIONS");
  return command(e, "EVENT_ACTION", { id });
}

test("preview and rejected commands never mutate state; setup snapshots are detached", () => {
  const { e } = runtime();
  const draft = e.getSetup(); draft.attributes.family = 99;
  assert.notEqual(e.getSetup().attributes.family, 99);
  start(e);
  const before = JSON.stringify(e.getState());
  e.previewAction({ type: "LIFE_ACTION", id: "routine-study" });
  assert.equal(JSON.stringify(e.getState()), before);
  assert.equal(e.dispatch({ type: "LIFE_ACTION", id: "routine-study" }).ok, false);
  assert.equal(e.dispatch({ type: "ADVANCE_ROUND" }).ok, false);
  assert.equal(JSON.stringify(e.getState()), before);
});

test("zero energy cannot buy labor; rest and a conservative event prevent deadlock", () => {
  const { e } = runtime(); start(e);
  editLife(e, 0, (life) => { life.resources.energy = 0; });
  assert.equal(e.dispatch({ type: "LIFE_ACTION", id: "routine-study" }).ok, false);
  command(e, "LIFE_ACTION", { id: "routine-rest" });
  assert.equal(e.getState().currentLife.resources.energy, 2);
  command(e, "LIFE_ACTION", { id: "routine-rest" });
  assert.equal(e.getState().currentLife.resources.energy, 3);
  event(e, "steady-childhood-yard");
  command(e, "ADVANCE_ROUND");
  assert.equal(e.getState().currentLife.resources.energy, 6);
  const saved = e.getState();
  e.replaceState(saved);
  assert.equal(e.getState().currentLife.resources.energy, 6);
  assert.equal(e.dispatch({ type: "ADVANCE_ROUND" }).ok, false);
});

test("cash over 100, wages, borrowing and repayment use the same ledger", () => {
  const { e } = runtime(); start(e);
  editLife(e, 5, (life) => { life.resources.money = 100; life.resources.energy = 10; life.skills.craft = 4; });
  const initial = e.getState().currentLife.cashflow.income;
  command(e, "LIFE_ACTION", { id: "shop-shift" });
  assert.equal(e.getState().currentLife.resources.money, 107);
  assert.equal(e.getState().currentLife.cashflow.income, initial + 7);
  editLife(e, 11, (life) => { life.resources.money = 0; life.cashflow = { income: 0, expenses: 0, debt: 0 }; });
  event(e, "take-risk-loan");
  let life = e.getState().currentLife;
  assert.equal(life.resources.money, 20);
  assert.equal(life.cashflow.income, 0);
  assert.equal(life.cashflow.debt, 20);
  assert.equal(life.ledger.totals.borrowed, 20);
  command(e, "ADVANCE_ROUND");
  const ap = e.getState().currentLife.actionPoints;
  command(e, "REPAY_DEBT", { amount: 10 });
  life = e.getState().currentLife;
  assert.equal(life.cashflow.debt, 10);
  assert.equal(life.actionPoints, ap);
  assert.equal(life.resources.money, 5);
  assert.equal(life.ledger.totals.expenses, 5);
  assert.equal(life.ledger.totals.repaid, 10);
});

test("all six items deliver their stated observable bonus", () => {
  const cases = [
    ["toolkit", "routine-repair", "skills", "craft", 2],
    ["study-notebook", "routine-study", "skills", "study", 2],
    ["old-phone", "routine-social", "relationships", "friend", 2],
    ["warm-coat", "routine-rest", "resources", "health", 2],
    ["first-aid", "routine-care", "resources", "health", 1],
    ["camera", "routine-record", "town", "archive", 1],
  ];
  for (const [item, action, group, key, delta] of cases) {
    const { e } = runtime(); start(e);
    editLife(e, 4, (life) => {
      life.inventory = [item]; life.resources.energy = 8; life.resources.health = 5;
      life.skills.craft = 1; life.skills.study = 1; life.relationships.friend = 1; life.town.archive = 0;
    });
    const before = e.getState().currentLife[group][key];
    command(e, "LIFE_ACTION", { id: action });
    assert.equal(e.getState().currentLife[group][key] - before, delta, item);
  }
});

test("growth caps apply to new gains without reducing an inherited or migrated skill", () => {
  const { e } = runtime(); start(e);
  editLife(e, 0, (life) => { life.skills.study = 4; life.resources.energy = 10; });
  command(e, "LIFE_ACTION", { id: "routine-study" });
  assert.equal(e.getState().currentLife.skills.study, 4);
  editLife(e, 0, (life) => { life.skills.study = 7; life.resources.energy = 10; });
  command(e, "LIFE_ACTION", { id: "routine-study" });
  assert.equal(e.getState().currentLife.skills.study, 7);
});

test("a failed workshop test cannot grant a successful workshop flag or goal evidence", () => {
  const { e } = runtime(); start(e);
  editLife(e, 12, (life) => {
    life.skills.craft = 4; life.resources.money = 50; life.resources.energy = 10;
    life.flags = life.flags.filter((flag) => flag !== "talent-luck");
    let seed = 0;
    while (e.hashSeed(seed + ":12:open-workshop") % 3 !== 1) seed++;
    life.seed = seed;
  });
  event(e, "open-workshop");
  const life = e.getState().currentLife;
  assert.equal(life.lastAction.test.score, 5);
  assert.equal(life.lastAction.test.success, false);
  assert.equal(life.flags.includes("workshop"), false);
  assert.ok(life.strategy.evidence.some((entry) => entry.id === "open-workshop" && entry.success === false));
});

test("future scene observations and repeated observations are rejected", () => {
  const { e } = runtime(); start(e);
  const before = JSON.stringify(e.getState());
  assert.equal(e.dispatch({ type: "INSPECT_SCENE", roundId: "middle-flood", clueId: "flood-rope" }).ok, false);
  assert.equal(JSON.stringify(e.getState()), before);
  editLife(e, 1);
  command(e, "INSPECT_SCENE", { roundId: "childhood-school", clueId: "school-window" });
  const after = JSON.stringify(e.getState());
  assert.equal(e.dispatch({ type: "INSPECT_SCENE", roundId: "childhood-school", clueId: "school-window" }).ok, false);
  assert.equal(JSON.stringify(e.getState()), after);
});

test("40 complete lives preserve compact save/export/import and unique stage settlement", () => {
  const { e, s, c } = runtime();
  let largest = 0;
  for (let generation = 0; generation < 40; generation++) {
    start(e, ["craft", "study", "community"][generation % 3]);
    for (let round = 0; round < 23; round++) {
      const life = e.getState().currentLife;
      const opportunity = life.opportunity.drawnIds.find((id) => e.previewAction({ type: "OPPORTUNITY", id }).available);
      if (opportunity) command(e, "OPPORTUNITY", { id: opportunity }); else command(e, "SKIP_OPPORTUNITY");
      command(e, "LIFE_ACTION", { id: "routine-rest" });
      command(e, "END_LIFE_ACTIONS");
      command(e, "EVENT_ACTION", { id: "steady-" + c.rounds[round].id });
      command(e, "ADVANCE_ROUND");
    }
    const ending = e.getState().currentLife;
    assert.equal(ending.status, "complete");
    assert.equal(Object.keys(ending.strategy.goals).length, 15);
    command(e, "TOGGLE_LEGACY", { id: ending.legacyCandidates[0] });
    command(e, "CONFIRM_LEGACIES");
    const exported = s.serialize(e.getState());
    largest = Math.max(largest, Buffer.byteLength(exported));
    const imported = s.prepareImport(exported);
    assert.equal(imported.ok, true, JSON.stringify(imported));
    assert.equal(imported.state.world.completedLives, generation + 1);
    e.replaceState(imported.state);
  }
  assert.equal(e.getState().world.history.length, 40);
  assert.ok(largest <= 512 * 1024, largest);
  console.log("40-life compact bytes", largest);
});

module.exports = { runtime, command, start, editLife, event };
