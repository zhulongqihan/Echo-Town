"use strict";

// Behavior verification against the integrated runtime. All source modules and
// gameplay commands are used verbatim. No runtime source strings are rewritten.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development/game/content.js"))) {
  const parent = path.dirname(ROOT);
  if (parent === ROOT) throw new Error("Cannot locate the Echo Town repository root");
  ROOT = parent;
}
const DIR = path.join(ROOT, "development/game");
const clone = value => JSON.parse(JSON.stringify(value));
const sources = Object.fromEntries(["content", "strategy", "save", "engine"].map(name => [name, fs.readFileSync(path.join(DIR, name + ".js"), "utf8")]));
const projectSource = fs.readFileSync(path.join(DIR, "projects.js"), "utf8");
const prefixEvents = ["fix-radio", "share-notes", "rest-at-home", "repair-lantern", "chain-craft-promise", "join-repair", "stay-for-family"];
const prefixSchedules = [["routine-rest"], ["routine-repair", "routine-rest"], ["routine-rest"], ["routine-rest"], ["routine-repair", "routine-repair"], ["shop-shift"], ["shop-shift"]];

function game() {
  const scope = { console, Date, TextEncoder, Blob, setTimeout, clearTimeout };
  scope.window = scope;
  vm.createContext(scope);
  vm.runInContext(sources.content, scope);
  vm.runInContext(projectSource, scope);
  vm.runInContext(sources.strategy, scope);
  vm.runInContext(sources.save, scope);
  vm.runInContext(sources.engine, scope);
  const engine = scope.EchoTownEngine;
  const project = scope.EchoTownProjects;
  assert.ok(sources.engine.includes('type === "ACCEPT_PROJECT"'), "formal project hooks are required");
  const getLife = () => engine.getState().currentLife;
  function send(command) {
    const before = getLife();
    const outcome = engine.dispatch(command);
    assert.equal(outcome.ok, true, JSON.stringify({ command, age: before && before.age, error: outcome.error, resources: before && before.resources }));
    const life = getLife();
    if (life) assert.ok(life.projects, "formal engine must initialize project state itself");
    return getLife();
  }
  function accept() { return send({ type: "ACCEPT_PROJECT", id: project.ID }); }
  function withdraw() { return send({ type: "WITHDRAW_PROJECT", id: project.ID }); }
  function node(schedule, event, advance = true) {
    send({ type: "SKIP_OPPORTUNITY" });
    for (const entry of schedule) send(typeof entry === "string" ? { type: "LIFE_ACTION", id: entry } : entry);
    if (getLife().actionPoints) send({ type: "END_LIFE_ACTIONS" });
    send({ type: "EVENT_ACTION", id: event });
    return advance ? send({ type: "ADVANCE_ROUND" }) : getLife();
  }
  function youth() {
    send({ type: "SET_PRESET", routeId: "craft" });
    send({ type: "START_LIFE" });
    for (let index = 0; index < 7; index += 1) node(prefixSchedules[index], prefixEvents[index]);
    assert.equal(getLife().age, 19);
    assert.equal(getLife().inheritedLegacyIds.length, 0);
    return getLife();
  }
  return { engine, project, save: scope.EchoTownSave, content: scope.EchoTownContent, getLife, send, accept, withdraw, node, youth };
}

function runPath(mode) {
  const app = game();
  const initial = app.youth();
  if (mode !== "stable") app.accept();
  app.node(["shop-shift"], "city-library");
  const preparation = mode === "stable" || mode === "missed" ? ["shop-shift"] : mode === "tool" ? [{ type: "BUY_ITEM", id: "toolkit" }, "routine-rest"] : ["routine-repair", "routine-rest"];
  app.node(preparation, "chain-craft-trial");
  if (mode === "withdrawn") app.withdraw();
  app.node(["shop-shift"], "keep-friendship");
  app.send({ type: "SKIP_OPPORTUNITY" });
  app.send({ type: "LIFE_ACTION", id: "shop-shift" });
  const beforeEvent = app.getLife();
  app.send({ type: "EVENT_ACTION", id: "return-workshop" });
  const result = app.getLife();
  return { ...app, initial, beforeEvent, result };
}

test("practice and purchase paths use five existing AP, finish existing youth goal, and unlock actual later work", () => {
  const stable = runPath("stable");
  const practice = runPath("practice");
  const tool = runPath("tool");
  for (const app of [practice, tool]) {
    const record = app.result.projects.current;
    assert.equal(record.status, "completed");
    assert.equal(Object.values(record.steps).reduce((sum, step) => sum + step.ap, 0), 5);
    assert.equal(app.result.strategy.goals["craft:youth"].status, "achieved");
    assert.equal(app.result.resources.money, app.beforeEvent.resources.money - 2, "only the existing return-workshop event charges its own cost");
    assert.equal(app.project.settle(app.result).changed, false, "settlement replay has no result or wage");
    assert.equal(app.engine.previewAction({ type: "LIFE_ACTION", id: app.project.JOB_ID }).available, false, "28 feedback cannot work");
    app.send({ type: "ADVANCE_ROUND" });
    app.send({ type: "SKIP_OPPORTUNITY" });
    const before = app.getLife();
    assert.equal(before.age, 32);
    assert.equal(app.engine.previewAction({ type: "LIFE_ACTION", id: app.project.JOB_ID }).available, true);
    app.send({ type: "LIFE_ACTION", id: app.project.JOB_ID });
    const after = app.getLife();
    assert.equal(after.actionPoints, 0);
    assert.equal(after.resources.money - before.resources.money, 14);
    assert.equal(after.resources.energy - before.resources.energy, -4);
    assert.equal(after.resources.pressure, Math.min(12, before.resources.pressure + 2));
    assert.equal(after.town.shop, before.town.shop);
    assert.equal(after.ledger.entries.filter(entry => entry.id === app.project.JOB_ID && entry.kind === "work").length, 1);
  }
  assert.equal(stable.result.resources.money - practice.result.resources.money, 7, "preparation replaces one stable wage");
  assert.equal(practice.result.resources.money - tool.result.resources.money, 12, "tool option pays its actual price once");
  assert.equal(stable.result.projects.current, null);
  console.log(JSON.stringify({ witness: "youth-19-28", entryMoney: practice.initial.resources.money, stable: stable.result.resources.money, practice: practice.result.resources.money, tool: tool.result.resources.money, projectAP: 5, availableAP: 8, originalYouthGoal: "achieved" }));
});

test("accept and duplicate receipt never produce AP, cash, progress, or ledger rewards", () => {
  const app = game();
  const before = app.youth();
  app.accept();
  const accepted = app.getLife();
  assert.deepEqual(accepted.resources, before.resources);
  assert.deepEqual(accepted.ledger, before.ledger);
  assert.equal(accepted.actionPoints, 2);
  assert.equal(app.project.accept(accepted).ok, false);
  app.send({ type: "SKIP_OPPORTUNITY" });
  const beforeWork = app.getLife();
  app.send({ type: "LIFE_ACTION", id: "shop-shift" });
  const after = app.getLife();
  const receipt = { type: "LIFE_ACTION", id: "shop-shift", round: 7, before: { actionPoints: beforeWork.actionPoints, sideActionsUsed: beforeWork.sideActionsUsed, money: beforeWork.resources.money, energy: beforeWork.resources.energy, hadToolkit: false } };
  assert.equal(app.project.record(after, receipt).changed, false);
  assert.equal(app.engine.dispatch({ type: "LIFE_ACTION", id: "shop-shift" }).ok, false);
  assert.deepEqual(app.getLife(), after);
});

test("preparation is recorded once even if both paid qualifying choices execute", () => {
  const app = game();
  app.youth(); app.accept(); app.node(["shop-shift"], "city-library");
  app.send({ type: "SKIP_OPPORTUNITY" });
  app.send({ type: "BUY_ITEM", id: "toolkit" });
  const first = app.getLife().projects;
  app.send({ type: "LIFE_ACTION", id: "routine-repair" });
  assert.deepEqual(app.getLife().projects, first);
  assert.equal(app.getLife().actionPoints, 0);
});

test("withdraw keeps paid costs, original goals, and the ability to continue", () => {
  const app = game();
  app.youth(); app.accept(); app.node(["shop-shift"], "city-library");
  app.send({ type: "SKIP_OPPORTUNITY" }); app.send({ type: "BUY_ITEM", id: "toolkit" });
  const before = app.getLife();
  app.withdraw();
  const after = app.getLife();
  assert.deepEqual(after.resources, before.resources); assert.deepEqual(after.ledger, before.ledger);
  assert.deepEqual(after.inventory, before.inventory); assert.equal(after.actionPoints, before.actionPoints);
  assert.equal(app.project.accept(after).ok, false);
  app.send({ type: "END_LIFE_ACTIONS" }); app.send({ type: "EVENT_ACTION", id: "chain-craft-trial" }); app.send({ type: "ADVANCE_ROUND" });
  app.node(["shop-shift"], "keep-friendship"); app.node(["shop-shift"], "return-workshop");
  assert.equal(app.getLife().age, 32); assert.equal(app.getLife().projects.current.status, "withdrawn");
  assert.equal(app.project.isUnlocked(app.getLife()), false);
  assert.equal(app.getLife().strategy.goals["craft:youth"].status, "achieved");
});

test("missing preparation produces a terminal incomplete result without extra penalty", () => {
  const app = runPath("missed");
  const stable = runPath("stable");
  assert.equal(app.result.projects.current.status, "incomplete");
  assert.equal(app.project.isUnlocked(app.result), false);
  assert.deepEqual(clone(app.result.resources), clone(stable.result.resources));
  assert.deepEqual(clone(app.result.ledger), clone(stable.result.ledger));
  const grown = clone(app.result); grown.skills.craft = 10;
  assert.equal(app.project.settle(grown).changed, false);
  assert.equal(app.project.isUnlocked(grown), false);
});

test("migration accepts only untouched 19-year entry, never reconstructs previous steps", () => {
  const app = game();
  const life = app.youth();
  delete life.projects;
  assert.equal(app.project.normalize(undefined, life).eligibleFromRound, 7);
  assert.equal(app.project.accept(life).ok, true);
  const early = clone(life); early.round = 2; early.age = 9;
  assert.equal(app.project.normalize(undefined, early).eligibleFromRound, 7);
  for (const ap of [0, 1]) {
    const spent = clone(life); spent.actionPoints = ap; spent.sideActionsUsed = 1;
    assert.equal(app.project.normalize(undefined, spent).eligibleFromRound, null);
    assert.equal(app.project.accept(spent).ok, false);
  }
  const feedback = clone(life); feedback.lastAction = { actionId: "city-library" };
  assert.equal(app.project.normalize(undefined, feedback).eligibleFromRound, null);
  const middle = clone(life); middle.round = 8; middle.age = 21;
  middle.strategy.evidence.push({ round: 7, kind: "job", id: "shop-shift", success: true });
  assert.deepEqual(clone(app.project.normalize(undefined, middle)), { version: 1, eligibleFromRound: null, current: null });
  const completed = clone(life); completed.status = "complete"; completed.round = 22;
  assert.equal(app.project.normalize(undefined, completed).eligibleFromRound, null);
});

test("strict normalization rejects forged completion, cost, slot, purchase, or event proof", () => {
  for (const mode of ["practice", "tool"]) {
    const app = runPath(mode);
    const valid = app.result;
    assert.doesNotThrow(() => app.project.normalize(valid.projects, valid));
    for (const mutate of [
      life => { life.projects.current.steps.firstWork.slot = 2; },
      life => { life.projects.current.steps.firstWork.energySpent = 0; },
      life => { delete life.projects.current.steps.returnWork; },
      life => { life.projects.current.finalCraft = 4; },
      life => { life.projects.current.settledRound = 9; },
      life => { life.strategy.evidence = life.strategy.evidence.filter(entry => !(entry.round === 7 && entry.id === "shop-shift")); },
      life => { life.actions = life.actions.filter(entry => entry.age !== 28); },
      life => { life.lastAction = null; },
      life => { life.projects.eligibleFromRound = null; },
    ]) {
      const bad = clone(valid); mutate(bad);
      assert.throws(() => app.project.normalize(bad.projects, bad), /项目记录无效/);
    }
    if (mode === "tool") {
      const bad = clone(valid); bad.ledger.entries = bad.ledger.entries.filter(entry => entry.kind !== "purchase");
      assert.throws(() => app.project.normalize(bad.projects, bad), /真实行动记录/);
    }
  }
});

test("view and definitions are detached, and failed project work cannot bypass energy", () => {
  const app = runPath("practice");
  const before = JSON.stringify(app.result);
  const view = app.project.getView(app.result);
  assert.equal(view.status, "completed"); assert.equal(view.progress.current, 3);
  view.steps[0].receipt.ap = 99; view.unlock.unlocked = false;
  app.project.getJobDefinition().effect.resources.money = 999;
  assert.equal(JSON.stringify(app.result), before);
  assert.equal(app.project.getJobDefinition().effect.resources.money, 14);
  app.send({ type: "ADVANCE_ROUND" }); app.send({ type: "SKIP_OPPORTUNITY" });
  const state = app.engine.getState(); state.currentLife.resources.energy = 3;
  app.engine.replaceState(state);
  const blocked = app.getLife();
  assert.equal(app.engine.dispatch({ type: "LIFE_ACTION", id: app.project.JOB_ID }).ok, false);
  assert.deepEqual(app.getLife(), blocked);
});

test("real spending leaves no cash, zero-energy withdrawal and conservative events still advance", () => {
  const app = game();
  app.youth(); app.accept();
  app.node([{ type: "BUY_ITEM", id: "camera" }, { type: "BUY_ITEM", id: "warm-coat" }], "city-library");
  assert.equal(app.getLife().resources.money, 0, "existing purchases and the next bill consume the actual cash");
  assert.ok(app.getLife().cashflow.debt > 0);
  app.send({ type: "SKIP_OPPORTUNITY" });
  const state = app.engine.getState(); state.currentLife.resources.energy = 0;
  app.engine.replaceState(state); // Explicit scarcity fixture: only energy changes.
  const before = app.getLife();
  assert.equal(app.engine.dispatch({ type: "BUY_ITEM", id: "toolkit" }).ok, false);
  assert.equal(app.engine.dispatch({ type: "LIFE_ACTION", id: "shop-shift" }).ok, false);
  assert.deepEqual(app.getLife(), before);
  app.withdraw();
  assert.deepEqual(app.getLife().resources, before.resources);
  assert.equal(app.getLife().actionPoints, 2);
  app.send({ type: "END_LIFE_ACTIONS" });
  app.send({ type: "EVENT_ACTION", id: "steady-youth-mentor" });
  app.send({ type: "ADVANCE_ROUND" });
  assert.equal(app.getLife().age, 24);
  assert.equal(app.getLife().projects.current.status, "withdrawn");
  app.node(["routine-rest", "routine-rest"], "steady-youth-love");
  app.node(["routine-rest", "routine-rest"], "steady-youth-career");
  assert.equal(app.getLife().age, 32);
  assert.ok(app.getLife().cashflow.debt > 0);
  assert.equal(app.project.isUnlocked(app.getLife()), false);
});

test("project success, original craft chain and later independent-work evidence coexist", () => {
  const app = runPath("practice");
  app.send({ type: "ADVANCE_ROUND" });
  const events = ["ask-family-share", "chain-craft-workshop", "talk-through", "tell-regret", "steady-middle-flood", "keep-wet-pages"];
  const jobs = [app.project.JOB_ID, app.project.JOB_ID, app.project.JOB_ID, "town-job", "town-job", app.project.JOB_ID];
  for (let index = 0; index < events.length; index += 1) app.node([jobs[index]], events[index]);
  const life = app.getLife();
  assert.equal(life.age, 52);
  assert.equal(life.projects.current.status, "completed");
  assert.equal(life.strategy.consequences.filter(entry => entry.id === "craft-orders-delivered" && entry.success).length, 1);
  assert.equal(life.strategy.goals["craft:middle"].status, "achieved");
  assert.ok(life.strategy.evidence.some(entry => entry.kind === "job" && entry.id === app.project.JOB_ID && entry.round > 12));
  const before = clone(life.strategy.evidence);
  app.engine.replaceState(app.engine.getState());
  assert.deepEqual(clone(app.getLife().strategy.evidence), before, "refresh/import normalization retains the new job evidence");
  console.log(JSON.stringify({ witness: "project-with-craft-chain", age: life.age, cash: life.resources.money, debt: life.cashflow.debt, middleGoal: life.strategy.goals["craft:middle"].status, project: life.projects.current.status, chain: "craft-orders-delivered" }));
});

test("independent work trades growth and energy for cash against helper and town work, and protects health against nights", () => {
  for (const mode of ["practice", "tool"]) {
    const app = runPath(mode);
    app.send({ type: "ADVANCE_ROUND" }); app.send({ type: "SKIP_OPPORTUNITY" });
    const snapshot = app.engine.getState();
    const before = app.getLife();
    app.send({ type: "LIFE_ACTION", id: "shop-shift" });
    const helper = app.getLife();
    app.engine.replaceState(snapshot);
    const preview = app.engine.previewAction({ type: "LIFE_ACTION", id: app.project.JOB_ID });
    app.send({ type: "LIFE_ACTION", id: app.project.JOB_ID });
    const independent = app.getLife();
    assert.equal(independent.resources.money - helper.resources.money, 7);
    assert.equal(independent.resources.energy - helper.resources.energy, -2);
    assert.equal(independent.resources.pressure - helper.resources.pressure, 1);
    assert.equal(independent.resources.health, before.resources.health);
    assert.equal(independent.skills.craft - before.skills.craft, mode === "tool" ? 1 : 0);
    assert.equal(helper.skills.craft - independent.skills.craft, 1);
    assert.equal(independent.town.shop, before.town.shop);
    assert.ok(helper.town.shop >= independent.town.shop);
    assert.equal(preview.remaining.money, independent.resources.money);
    assert.equal(preview.remaining.energy, independent.resources.energy);
    assert.equal(independent.actionPoints, helper.actionPoints);
    app.engine.replaceState(snapshot);
    app.send({ type: "LIFE_ACTION", id: "town-job" });
    const town = app.getLife();
    assert.equal(independent.resources.money - town.resources.money, 3);
    assert.equal(independent.resources.energy - town.resources.energy, -2);
    assert.equal(independent.resources.pressure - town.resources.pressure, 1);
    assert.equal(independent.resources.health, town.resources.health);
    assert.equal(town.skills.empathy - independent.skills.empathy, 1);
    assert.equal(town.town.bridge - independent.town.bridge, 1);
    assert.equal(town.town.school - independent.town.school, 1);
    app.engine.replaceState(snapshot);
    app.send({ type: "LIFE_ACTION", id: "night-shift" });
    const night = app.getLife();
    assert.equal(independent.resources.money - night.resources.money, 1);
    assert.equal(independent.resources.energy - night.resources.energy, -1);
    assert.equal(independent.resources.health - night.resources.health, 2);
    assert.equal(independent.resources.pressure, night.resources.pressure);
    assert.equal(night.relationships.family - independent.relationships.family, 1);
  }
});

test("fresh runtime reload, route changes and command replay never settle or pay a project twice", () => {
  let app = game();
  app.youth(); app.accept();
  app.send({ type: "SKIP_OPPORTUNITY" }); app.send({ type: "LIFE_ACTION", id: "shop-shift" });
  const paid = app.engine.getState();
  app = game(); app.engine.replaceState(JSON.parse(JSON.stringify(paid)));
  assert.deepEqual(clone(app.getLife()), clone(paid.currentLife));
  for (const routeId of ["study", "community", "craft"]) {
    app.send({ type: "SET_ROUTE", routeId });
    assert.deepEqual(clone(app.getLife().projects), clone(paid.currentLife.projects));
    assert.deepEqual(clone(app.getLife().ledger), clone(paid.currentLife.ledger));
    assert.deepEqual(clone(app.getLife().resources), clone(paid.currentLife.resources));
  }
  assert.equal(app.engine.dispatch({ type: "LIFE_ACTION", id: "shop-shift" }).ok, false);
  app.send({ type: "EVENT_ACTION", id: "city-library" }); app.send({ type: "ADVANCE_ROUND" });
  app.node(["routine-repair", "routine-rest"], "chain-craft-trial");
  app.node(["shop-shift"], "keep-friendship");
  app.send({ type: "SKIP_OPPORTUNITY" }); app.send({ type: "LIFE_ACTION", id: "shop-shift" });
  app.send({ type: "SET_ROUTE", routeId: "community" });
  app.send({ type: "EVENT_ACTION", id: "return-workshop" });
  assert.equal(app.getLife().projects.current.status, "completed", "tracking a different route does not cancel craft preparation");
  const settled = app.engine.getState();
  app = game(); app.engine.replaceState(JSON.parse(JSON.stringify(settled)));
  assert.deepEqual(clone(app.getLife()), clone(settled.currentLife));
  for (const command of [{ type: "EVENT_ACTION", id: "return-workshop" }, { type: "ACCEPT_PROJECT", id: app.project.ID }, { type: "WITHDRAW_PROJECT", id: app.project.ID }]) {
    assert.equal(app.engine.dispatch(command).ok, false);
    assert.deepEqual(clone(app.engine.getState()), clone(settled));
  }
  for (const routeId of ["craft", "study", "community"]) {
    app.send({ type: "SET_ROUTE", routeId });
    const after = app.getLife();
    assert.deepEqual(clone(after.projects), clone(settled.currentLife.projects));
    assert.deepEqual(clone(after.ledger), clone(settled.currentLife.ledger));
    assert.deepEqual(clone(after.resources), clone(settled.currentLife.resources));
    assert.deepEqual(clone(after.strategy.goals), clone(settled.currentLife.strategy.goals));
    assert.deepEqual(clone(after.lastAction), clone(settled.currentLife.lastAction));
    assert.equal(app.project.settle(after).changed, false);
  }
  app.send({ type: "ADVANCE_ROUND" });
  const advanced = app.engine.getState();
  assert.equal(app.engine.dispatch({ type: "ADVANCE_ROUND" }).ok, false);
  assert.deepEqual(clone(app.engine.getState()), clone(advanced));
  app = game(); app.engine.replaceState(JSON.parse(JSON.stringify(advanced)));
  assert.deepEqual(clone(app.getLife()), clone(advanced.currentLife));
  assert.equal(app.getLife().projects.current.resultId, "craft-customers-youth-v1:completed");
  assert.equal(app.getLife().resources.money, settled.currentLife.resources.money - 5, "the next node bills exactly once");
});

test("withdrawal cannot be reopened by reload, route switching or repeated project commands", () => {
  let app = game(); app.youth(); app.accept(); app.withdraw();
  const withdrawn = app.engine.getState();
  app = game(); app.engine.replaceState(JSON.parse(JSON.stringify(withdrawn)));
  for (const routeId of ["study", "community", "craft"]) app.send({ type: "SET_ROUTE", routeId });
  const beforeReplay = app.engine.getState();
  for (const type of ["WITHDRAW_PROJECT", "ACCEPT_PROJECT", "WITHDRAW_PROJECT"]) {
    assert.equal(app.engine.dispatch({ type, id: app.project.ID }).ok, false);
    assert.deepEqual(clone(app.engine.getState()), clone(beforeReplay));
  }
  assert.deepEqual(clone(app.getLife().resources), clone(withdrawn.currentLife.resources));
  assert.deepEqual(clone(app.getLife().ledger), clone(withdrawn.currentLife.ledger));
  assert.deepEqual(clone(app.getLife().projects), clone(withdrawn.currentLife.projects));
  assert.equal(app.getLife().actionPoints, 2);
});

test("missing a required work slot immediately explains failure without auto-withdrawal or resource changes", () => {
  const app = game(); app.youth(); app.accept();
  app.send({ type: "SKIP_OPPORTUNITY" }); app.send({ type: "LIFE_ACTION", id: "routine-rest" });
  const before = app.getLife();
  assert.equal(before.actionPoints, 1, "two-AP work is already impossible within this node");
  const view = app.project.getView(before);
  assert.equal(view.status, "active");
  assert.equal(view.steps[0].status, "missed");
  assert.match(view.summary, /已错过19岁步骤.*本世无法完成/);
  assert.match(view.next, /可退出项目/);
  assert.equal(view.withdraw.available, true);
  assert.deepEqual(app.getLife(), before);
  app.send({ type: "END_LIFE_ACTIONS" }); app.send({ type: "EVENT_ACTION", id: "city-library" }); app.send({ type: "ADVANCE_ROUND" });
  const nextView = app.project.getView(app.getLife());
  assert.match(nextView.next, /已错过19岁步骤/);
  assert.equal(nextView.status, "active", "view does not force a terminal outcome");
  app.send({ type: "SKIP_OPPORTUNITY" });
  assert.equal(app.engine.previewAction({ type: "LIFE_ACTION", id: "shop-shift" }).available, true, "normal work remains available");
});

test("current-node recorded work and second-slot preparation require the AP already paid", () => {
  const app = game(); app.youth(); app.accept();
  app.send({ type: "SKIP_OPPORTUNITY" }); app.send({ type: "LIFE_ACTION", id: "shop-shift" });
  const worked = app.getLife();
  assert.doesNotThrow(() => app.project.normalize(worked.projects, worked));
  for (const unpaidAP of [1, 2]) {
    const bad = clone(worked); bad.actionPoints = unpaidAP;
    assert.throws(() => app.project.normalize(bad.projects, bad), /行动点尚未实际扣除/);
  }
  app.send({ type: "EVENT_ACTION", id: "city-library" }); app.send({ type: "ADVANCE_ROUND" });
  app.send({ type: "SKIP_OPPORTUNITY" }); app.send({ type: "LIFE_ACTION", id: "routine-rest" }); app.send({ type: "BUY_ITEM", id: "toolkit" });
  const prepared = app.getLife();
  assert.equal(prepared.projects.current.steps.preparation.slot, 2);
  assert.equal(prepared.actionPoints, 0);
  assert.doesNotThrow(() => app.project.normalize(prepared.projects, prepared));
  const bad = clone(prepared); bad.actionPoints = 1;
  assert.throws(() => app.project.normalize(bad.projects, bad), /行动点尚未实际扣除/);
});

function finishCraftLife(app, options = {}) {
  assert.equal(app.getLife().age, 28);
  assert.ok(app.getLife().lastAction);
  app.send({ type: "ADVANCE_ROUND" });
  const middleEvents = ["ask-family-share", "chain-craft-workshop", "talk-through", "tell-regret", "steady-middle-flood", "keep-wet-pages"];
  const defaultJobs = app.project.isUnlocked(app.getLife())
    ? [app.project.JOB_ID, app.project.JOB_ID, app.project.JOB_ID, "town-job", "town-job", app.project.JOB_ID]
    : Array(6).fill("shop-shift");
  const schedules = options.schedules || defaultJobs.map(id => [id]);
  assert.equal(schedules.length, middleEvents.length);
  for (let index = 0; index < middleEvents.length; index += 1) {
    const feedback = app.node(schedules[index], middleEvents[index], false);
    if (options.onMiddleFeedback) options.onMiddleFeedback(feedback);
    app.send({ type: "ADVANCE_ROUND" });
  }
  const lateEvents = ["teach-youth", "archive-postcard", "steady-later-town", "train-successor", "steady-later-farewell", "handoff-craft"];
  for (const event of lateEvents) app.node(["routine-rest", "routine-social"], event);
  const life = app.getLife();
  assert.equal(life.status, "complete");
  assert.equal(life.age, 75);
  assert.equal(life.actions.length, 23);
  assert.deepEqual(clone(life.actions.slice(11, 17).map(action => action.actionId)), middleEvents, "cash comparisons keep every original middle-life event");
  assert.equal(life.cashflow.debt, 0);
  for (const stage of ["childhood", "adolescence", "youth", "middle", "later"]) assert.equal(life.strategy.goals["craft:" + stage].status, "achieved", stage);
  assert.equal(life.outcome.routeId, "craft");
  assert.equal(life.strategy.consequences.filter(entry => entry.id === "craft-orders-delivered" && entry.success).length, 1);
  const expectedBillRounds = app.content.rounds.flatMap((round, index) => index && app.engine.getLivingCost(round.age).cost ? [index] : []);
  assert.deepEqual(clone(life.ledger.entries.filter(entry => entry.kind === "bill").map(entry => entry.round)), clone(expectedBillRounds), "each payable life node was billed exactly once");
  return life;
}

function roundTripSaved(app) {
  const values = new Map();
  const storage = { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const original = app.engine.getState();
  const persisted = app.save.persist(original, { storage });
  assert.equal(persisted.ok, true, JSON.stringify(persisted));
  const loaded = app.save.load({ storage });
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  assert.equal(loaded.needsCommit, false);
  const text = app.save.serialize(loaded.state);
  assert.ok(Buffer.byteLength(text, "utf8") < 512 * 1024);
  assert.equal(text, JSON.stringify(JSON.parse(text)), "export is compact");
  const restored = game();
  const candidate = restored.save.prepareImport(text);
  assert.equal(candidate.ok, true, JSON.stringify(candidate));
  const committed = restored.save.commitImport(candidate, restored.engine.getState(), { storage });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  restored.engine.replaceState(committed.state);
  assert.deepEqual(clone(restored.engine.getState()), clone(original));
  return { app: restored, bytes: Buffer.byteLength(text, "utf8"), text };
}

test("natural successful project lives finish at 75, preserve history through save/import, and hand a real legacy to the next life", () => {
  for (const mode of ["practice", "tool"]) {
    let app = runPath(mode);
    const life = finishCraftLife(app);
    const before = app.engine.getState();
    const summary = before.world.history[0].projects;
    assert.deepEqual(clone(summary), { id: app.project.ID, status: "completed", resultId: app.project.ID + ":completed", settledRound: 10, stepsDone: 3, preparationActionId: mode === "tool" ? "toolkit" : "routine-repair", finalCraft: life.projects.current.finalCraft });
    assert.equal(before.world.completedLives, 1);
    assert.equal(before.world.history.length, 1);
    assert.equal(app.engine.dispatch({ type: "ADVANCE_ROUND" }).ok, false);
    assert.deepEqual(clone(app.engine.getState()), clone(before), "a repeated finish never adds a second history row");
    const roundTrip = roundTripSaved(app);
    app = roundTrip.app;
    assert.ok(app.getLife().legacyCandidates.includes("small-tool"));
    app.send({ type: "TOGGLE_LEGACY", id: "small-tool" });
    app = roundTripSaved(app).app;
    assert.deepEqual(clone(app.getLife().selectedLegacies), ["small-tool"]);
    app.send({ type: "CONFIRM_LEGACIES" });
    assert.equal(app.getLife(), null);
    assert.deepEqual(clone(app.engine.getState().world.history[0].projects), clone(summary));
    assert.deepEqual(clone(app.engine.getState().world.history[0].legacyIds), ["small-tool"]);
    const handedOff = app.engine.getState();
    assert.equal(app.engine.dispatch({ type: "CONFIRM_LEGACIES" }).ok, false);
    assert.deepEqual(clone(app.engine.getState()), clone(handedOff));
    app = roundTripSaved(app).app;
    const newLife = app.send({ type: "START_LIFE" });
    assert.equal(newLife.generation, 2);
    assert.deepEqual(clone(newLife.inheritedLegacyIds), ["small-tool"]);
    assert.ok(newLife.inventory.includes("toolkit"));
    assert.deepEqual(clone(newLife.projects), { version: 1, eligibleFromRound: 7, current: null }, "project success itself does not carry into another life");
    assert.equal(app.project.isUnlocked(newLife), false);
    assert.deepEqual(clone(app.engine.getState().world.history[0].projects), clone(summary));
    app.node(["routine-rest"], "fix-radio");
    app.send({ type: "SKIP_OPPORTUNITY" }); app.send({ type: "END_LIFE_ACTIONS" });
    assert.equal(app.engine.previewAction({ type: "EVENT_ACTION", id: "legacy-tool-practice" }).available, true);
    app.send({ type: "EVENT_ACTION", id: "legacy-tool-practice" });
    assert.ok(app.getLife().strategy.evidence.some(entry => entry.id === "legacy-tool-practice" && entry.success));
    console.log(JSON.stringify({ witness: "project-full-life-and-legacy", preparation: mode, age: life.age, money: life.resources.money, debt: life.cashflow.debt, stageGoals: 5, project: summary.status, bytes: roundTrip.bytes, nextGeneration: app.getLife().generation, inheritedChoice: "legacy-tool-practice" }));
  }
});

test("natural incomplete and withdrawn projects preserve their distinct ending summaries without blocking a full craft life", () => {
  for (const mode of ["missed", "withdrawn"]) {
    const app = runPath(mode);
    const life = finishCraftLife(app);
    const expectedStatus = mode === "missed" ? "incomplete" : "withdrawn";
    const history = app.engine.getState().world.history[0];
    assert.equal(life.projects.current.status, expectedStatus);
    assert.equal(history.projects.status, expectedStatus);
    assert.equal(history.projects.resultId, app.project.ID + ":" + expectedStatus);
    assert.equal(history.projects.stepsDone, 2);
    assert.equal(history.projects.preparationActionId, mode === "missed" ? null : "routine-repair");
    assert.equal(history.projects.settledRound, mode === "missed" ? 10 : 9);
    assert.equal(Object.hasOwn(history.projects, "finalCraft"), mode === "missed");
    assert.equal(app.project.isUnlocked(life), false);
    const restored = roundTripSaved(app).app;
    assert.deepEqual(clone(restored.engine.getState().world.history[0].projects), clone(history.projects));
    assert.equal(restored.getLife().projects.current.status, expectedStatus);
    console.log(JSON.stringify({ witness: "project-terminal-history", status: expectedStatus, age: life.age, cash: life.resources.money, debt: life.cashflow.debt, originalCraftGoals: 5 }));
  }
});

test("four independent jobs preserve every original event and all five goals while trading cash against town growth and night health", () => {
  const projectJob = "project-craft-shift";
  const scenarios = [
    { name: "practice-mixed", mode: "practice", at49: [85, 0, 10], at75: [61, 10], publicGrowth: 2 },
    { name: "tool-mixed", mode: "tool", at49: [73, 1, 10], at75: [49, 10], publicGrowth: 2 },
    { name: "no-preparation-town", mode: "stable", jobs: ["town-job", "town-job", "shop-shift", "town-job", "town-job", "town-job"], at49: [76, 6, 10], at75: [52, 10], publicGrowth: 5 },
    { name: "no-preparation-nights", mode: "stable", jobs: ["night-shift", "night-shift", "shop-shift", "night-shift", "town-job", "night-shift"], at49: [84, 2, 2], at75: [60, 8], publicGrowth: 1 },
    { name: "practice-rest-at-44", mode: "practice", schedules: [[projectJob], [projectJob], [projectJob], ["routine-rest", "routine-rest"], [projectJob], [projectJob]], at49: [77, 3, 10], at75: [53, 10], publicGrowth: 0 },
  ];
  const results = [];
  for (const scenario of scenarios) {
    const app = runPath(scenario.mode);
    const middle = [];
    const life = finishCraftLife(app, {
      schedules: scenario.schedules || scenario.jobs?.map(id => [id]),
      onMiddleFeedback: feedback => middle.push(clone(feedback)),
    });
    const age49 = middle.at(-1);
    assert.equal(age49.age, 49);
    assert.deepEqual([age49.resources.money, age49.resources.energy, age49.resources.health], scenario.at49, scenario.name);
    assert.deepEqual([life.resources.money, life.resources.health], scenario.at75, scenario.name);
    assert.equal(age49.town.bridge, scenario.publicGrowth, scenario.name);
    assert.equal(age49.town.school, scenario.publicGrowth, scenario.name);
    if (scenario.name === "practice-mixed") {
      assert.deepEqual(middle.map(item => item.resources.energy), [6, 4, 1, 1, 2, 0]);
      assert.equal(life.ledger.entries.filter(entry => entry.kind === "work" && entry.id === projectJob).length, 4);
    }
    results.push({ strategy: scenario.name, age49: scenario.at49, age75: scenario.at75, originalCraftGoals: 5, publicGrowth: scenario.publicGrowth });
  }
  assert.equal(results[0].age75[0] - results[2].age75[0], 9, "preparation is charged before comparing the same five-goal routes");
  assert.equal(results[1].age75[0] - results[2].age75[0], -3, "buying the tool does not guarantee cash payback against town work");
  console.log(JSON.stringify({ witness: "independent-town-night-real-budget", results }));
});

test("player checkpoints are compact valid v9 saves from ordinary commands", () => {
  const entry = game(); entry.youth();
  const completed = runPath("practice");
  const feedbackState = completed.engine.getState();
  completed.send({ type: "ADVANCE_ROUND" }); completed.send({ type: "SKIP_OPPORTUNITY" });
  const checkpoints = [
    { name: "youth-19-offer.json", state: entry.engine.getState(), age: 19, phase: "opportunity", status: null },
    { name: "youth-28-feedback.json", state: feedbackState, age: 28, phase: "feedback", status: "completed" },
    { name: "middle-32-independent-work.json", state: completed.engine.getState(), age: 32, phase: "management", status: "completed" },
  ];
  for (const item of checkpoints) {
    const restored = game();
    const text = restored.save.serialize(item.state);
    const candidate = restored.save.prepareImport(text);
    assert.equal(candidate.ok, true, JSON.stringify(candidate));
    restored.engine.replaceState(candidate.state);
    assert.equal(restored.getLife().age, item.age);
    assert.equal(restored.engine.getLifePhase(), item.phase);
    assert.equal(restored.getLife().projects.current?.status || null, item.status);
    assert.equal(restored.getLife().actions.length, item.age === 19 ? 7 : 11);
    if (item.age === 19) assert.equal(restored.project.getView(restored.getLife()).offer.available, true);
    if (item.age === 32) assert.equal(restored.engine.previewAction({ type: "LIFE_ACTION", id: restored.project.JOB_ID }).available, true);
    assert.equal(text, JSON.stringify(JSON.parse(text)));
    if (process.argv.includes("--write-fixtures")) {
      const destination = path.join(ROOT, "output/implementation-proposals/desktop-v9-gameplay/fixtures");
      fs.mkdirSync(destination, { recursive: true });
      fs.writeFileSync(path.join(destination, item.name), text, "utf8");
      console.log(JSON.stringify({ fixture: item.name, age: item.age, bytes: Buffer.byteLength(text, "utf8"), phase: item.phase, cash: item.state.currentLife.resources.money, energy: item.state.currentLife.resources.energy }));
    }
  }
});
