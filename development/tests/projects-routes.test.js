"use strict";

// These tests load the integrated runtime verbatim. Strategies are input
// commands, never source replacements or invented project/evidence records.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development/game/content.js"))) {
  const parent = path.dirname(ROOT);
  if (parent === ROOT) throw new Error("Cannot locate repository");
  ROOT = parent;
}
const { ROUTES } = require(path.join(ROOT, "development/tests/natural-routes.test.js"));
const clone = item => JSON.parse(JSON.stringify(item));
const IDS = { craft: "craft-customers-youth-v1", study: "study-practice-youth-v1", community: "community-network-youth-v1" };
function game() {
  const scope = { console, Date, TextEncoder, Blob, setTimeout, clearTimeout };
  scope.window = scope;
  vm.createContext(scope);
  for (const name of ["content", "projects", "strategy", "save", "engine"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "development/game", name + ".js"), "utf8"), scope);
  const engine = scope.EchoTownEngine, projects = scope.EchoTownProjects, save = scope.EchoTownSave, content = scope.EchoTownContent;
  function life() { return engine.getState().currentLife; }
  function send(command) {
    const before = life();
    const result = engine.dispatch(command);
    assert.equal(result.ok, true, JSON.stringify({ command, age: before?.age, error: result.error, resources: before?.resources, skills: before?.skills }));
    return life();
  }
  function node(schedule, event, advance = true) {
    send({ type: "SKIP_OPPORTUNITY" });
    for (const action of schedule) send(typeof action === "string" ? { type: "LIFE_ACTION", id: action } : action);
    if (life().actionPoints) send({ type: "END_LIFE_ACTIONS" });
    const feedback = send({ type: "EVENT_ACTION", id: event });
    if (feedback.lastAction.test) assert.equal(feedback.lastAction.test.success, true, event);
    if (advance) send({ type: "ADVANCE_ROUND" });
    return feedback;
  }
  function schedule(routeId, round) {
    const route = ROUTES[routeId];
    return route.schedule[round] || (round >= 17 ? ["routine-rest", routeId === "study" ? "routine-record" : "routine-social"] : [route.job]);
  }
  function entry(routeId) {
    send({ type: "SET_PRESET", routeId }); send({ type: "START_LIFE" });
    for (let round = 0; round < 7; round += 1) node(schedule(routeId, round), ROUTES[routeId].events[round]);
    assert.equal(life().age, 19);
    assert.equal(life().inheritedLegacyIds.length, 0);
    return life();
  }
  return { engine, projects, save, content, life, send, node, schedule, entry };
}
function youth(routeId, preparation = "practice") {
  const app = game(); app.entry(routeId);
  app.send({ type: "ACCEPT_PROJECT", id: IDS[routeId] });
  for (let round = 7; round <= 10; round += 1) {
    let schedule = app.schedule(routeId, round);
    if (routeId === "study" && round === 8) schedule = [preparation === "book" ? { type: "BUY_ITEM", id: "study-notebook" } : "routine-study", "routine-rest"];
    if (routeId === "community" && round === 7) schedule = ["routine-care", "routine-social"];
    if (routeId === "community" && round === 8) schedule = ["routine-record", "routine-rest"];
    app.node(schedule, ROUTES[routeId].events[round], round !== 10);
  }
  assert.equal(app.life().projects.current.status, "completed");
  return app;
}
function fullLife(routeId, mode) {
  const prepared = mode === "professional" || mode === "book" || mode === "network";
  const app = prepared ? youth(routeId, mode === "book" ? "book" : "practice") : game();
  if (!prepared) {
    app.entry(routeId);
    for (let round = 7; round <= 10; round += 1) app.node(app.schedule(routeId, round), ROUTES[routeId].events[round], round !== 10);
  }
  const at28 = app.life();
  app.send({ type: "ADVANCE_ROUND" });
  const middle = [];
  for (let round = 11; round < 23; round += 1) {
    let schedule = app.schedule(routeId, round);
    if (routeId === "study" && prepared && round <= 16) schedule = round === 16 ? ["project-study-consult", "routine-rest"] : ["project-study-consult", "project-study-consult"];
    if (routeId === "study" && mode === "town" && round <= 16) schedule = ["town-job"];
    if (routeId === "community" && round === 15 && mode !== "town") schedule = [prepared ? "project-community-care" : "routine-care", "routine-social"];
    const feedback = app.node(schedule, ROUTES[routeId].events[round]);
    if (round <= 16) middle.push({ age: feedback.age, schedule, resources: clone(feedback.resources), town: clone(feedback.town), relationships: clone(feedback.relationships) });
  }
  const life = app.life();
  assert.equal(life.status, "complete");
  assert.equal(life.age, 75);
  assert.equal(life.actions.length, 23);
  assert.deepEqual(clone(life.actions.map(action => action.actionId)), ROUTES[routeId].events, "all original events are retained");
  assert.equal(life.cashflow.debt, 0);
  assert.ok(life.resources.health > 0);
  assert.equal(life.outcome.routeId, routeId);
  for (const stage of ["childhood", "adolescence", "youth", "middle", "later"]) assert.equal(life.strategy.goals[routeId + ":" + stage].status, "achieved", routeId + ":" + stage);
  assert.equal(life.strategy.consequences.filter(item => item.id === ROUTES[routeId].consequenceId && item.success).length, 1);
  const billRounds = app.content.rounds.flatMap((round, index) => index && app.engine.getLivingCost(round.age).cost ? [index] : []);
  assert.deepEqual(clone(life.ledger.entries.filter(entry => entry.kind === "bill").map(entry => entry.round)), clone(billRounds));
  console.log(JSON.stringify({ witness: "route-project-full-life", routeId, mode, age28: { cash: at28.resources.money, energy: at28.resources.energy }, middle: middle.map(item => ({ age: item.age, cash: item.resources.money, energy: item.resources.energy, pressure: item.resources.pressure, child: item.relationships.child })), final: life.resources, goals: 5, debt: life.cashflow.debt }));
  return { app, life, middle, at28 };
}
function roundTrip(app) {
  const values = new Map();
  const storage = { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const before = app.engine.getState();
  assert.equal(app.save.persist(before, { storage }).ok, true);
  const loaded = app.save.load({ storage });
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  const text = app.save.serialize(loaded.state);
  assert.ok(Buffer.byteLength(text) < 512 * 1024);
  assert.equal(text, JSON.stringify(JSON.parse(text)));
  const restored = game();
  const candidate = restored.save.prepareImport(text);
  assert.equal(candidate.ok, true, JSON.stringify(candidate));
  const committed = restored.save.commitImport(candidate, restored.engine.getState(), { storage });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  restored.engine.replaceState(committed.state);
  assert.deepEqual(clone(restored.engine.getState()), clone(before));
  return restored;
}

test("study has stable tutoring, flexible professional work and real town alternatives through all 23 nodes", () => {
  const stable = fullLife("study", "stable");
  const professional = fullLife("study", "professional");
  const book = fullLife("study", "book");
  const town = fullLife("study", "town");
  for (const result of [professional, book]) {
    assert.equal(result.life.projects.current.status, "completed");
    const wages = result.life.ledger.entries.filter(entry => entry.kind === "work" && entry.id === "project-study-consult");
    assert.equal(wages.length, 11);
    assert.equal(wages.reduce((sum, entry) => sum + entry.money, 0), 66);
    assert.equal(result.life.strategy.evidence.filter(entry => entry.kind === "job" && entry.id === "project-study-consult").length, 6, "two same-node jobs never pretend to be two nodes");
  }
  assert.equal(stable.life.projects.current, null);
  assert.equal(town.life.projects.current, null);
  assert.equal(professional.at28.resources.money, stable.at28.resources.money - 8, "practice replaces one actual tutoring wage");
  assert.equal(book.at28.resources.money, professional.at28.resources.money - 10, "notebook purchase is charged");
  assert.ok(stable.life.relationships.child > professional.life.relationships.child, "stable tutoring retains real growth");
  assert.ok(town.life.town.bridge > professional.life.town.bridge);
});

test("community compares personal care with paid coordination without changing any original event or bill", () => {
  const direct = fullLife("community", "direct");
  const network = fullLife("community", "network");
  const town = fullLife("community", "town");
  assert.equal(network.life.projects.current.status, "completed");
  assert.equal(network.at28.resources.money, direct.at28.resources.money - 6, "roster preparation replaces the actual market wage");
  assert.equal(network.life.resources.money, direct.life.resources.money - 9, "six wage opportunity cost plus three real care spending");
  assert.equal(network.middle[4].resources.energy - direct.middle[4].resources.energy, 3, "coordination's energy benefit is actually received at 47");
  assert.equal(network.life.ledger.entries.filter(entry => entry.kind === "life" && entry.id === "project-community-care" && entry.money === -3).length, 1);
  assert.equal(network.life.ledger.entries.filter(entry => entry.kind === "work" && entry.id === "project-community-care").length, 0);
  assert.equal(network.life.jobHistory.includes("project-community-care"), false);
  assert.equal(network.life.strategy.evidence.filter(entry => entry.id === "project-community-care" && entry.kind === "life").length, 1);
  assert.equal(town.life.resources.money - direct.life.resources.money, 11, "personal care also gives up a real work opportunity");
});

test("new project results survive full ending, import and route-specific legacy handoff", () => {
  for (const [routeId, mode, legacyId, legacyAction, legacyRound] of [["study", "professional", "study-notebook", "legacy-notebook-method", 4], ["community", "network", "friend-letter", "legacy-letter-share", 11]]) {
    let { app, life } = fullLife(routeId, mode);
    const summary = clone(app.engine.getState().world.history[0].projects);
    assert.deepEqual(summary, clone(app.projects.summarize(life.projects.current)));
    assert.equal(summary.stepsDone, 3);
    app = roundTrip(app);
    assert.ok(app.life().legacyCandidates.includes(legacyId));
    app.send({ type: "TOGGLE_LEGACY", id: legacyId });
    app = roundTrip(app);
    app.send({ type: "CONFIRM_LEGACIES" });
    assert.equal(app.life(), null);
    app = roundTrip(app);
    app.send({ type: "START_LIFE" });
    assert.equal(app.life().generation, 2);
    assert.deepEqual(clone(app.life().inheritedLegacyIds), [legacyId]);
    assert.equal(app.life().projects.current, null);
    assert.equal(app.projects.isUnlocked(app.life(), IDS[routeId]), false);
    assert.deepEqual(clone(app.engine.getState().world.history[0].projects), summary);
    for (let round = 0; round < legacyRound; round += 1) app.node(app.schedule(routeId, round), ROUTES[routeId].events[round]);
    app.send({ type: "SKIP_OPPORTUNITY" }); app.send({ type: "END_LIFE_ACTIONS" });
    assert.equal(app.engine.previewAction({ type: "EVENT_ACTION", id: legacyAction }).available, true);
    app.send({ type: "EVENT_ACTION", id: legacyAction });
    assert.ok(app.life().strategy.evidence.some(entry => entry.id === legacyAction && entry.success));
  }
});

test("a life can accept only one project, route switching and repeated commands never duplicate receipts or settlement", () => {
  for (const routeId of ["study", "community"]) {
    let app = game(); app.entry(routeId);
    const offers = app.projects.getOffers(app.life());
    assert.equal(offers.length, 3);
    assert.equal(new Set(offers.map(view => view.id)).size, 3);
    const before = app.life();
    app.send({ type: "ACCEPT_PROJECT", id: IDS[routeId] });
    assert.deepEqual(clone(app.life().resources), clone(before.resources));
    assert.equal(app.life().actionPoints, 2);
    for (const id of Object.values(IDS)) assert.equal(app.engine.dispatch({ type: "ACCEPT_PROJECT", id }).ok, false);
    for (const route of ["craft", "study", "community"]) app.send({ type: "SET_ROUTE", routeId: route });
    assert.equal(app.projects.getView(app.life()).id, IDS[routeId]);
    app = roundTrip(app);
    assert.equal(app.projects.getOffers(app.life()).length, 0);
    app.send({ type: "WITHDRAW_PROJECT", id: IDS[routeId] });
    const withdrawn = app.engine.getState();
    assert.equal(app.engine.dispatch({ type: "WITHDRAW_PROJECT", id: IDS[routeId] }).ok, false);
    assert.equal(app.engine.dispatch({ type: "ACCEPT_PROJECT", id: IDS.craft }).ok, false);
    assert.deepEqual(clone(app.engine.getState()), clone(withdrawn));
    const done = youth(routeId);
    const completed = done.engine.getState();
    assert.equal(done.projects.settle(done.life()).changed, false);
    assert.equal(done.engine.dispatch({ type: "EVENT_ACTION", id: ROUTES[routeId].events[10] }).ok, false);
    for (const route of ["craft", "study", "community"]) done.send({ type: "SET_ROUTE", routeId: route });
    assert.deepEqual(clone(done.life().projects), clone(completed.currentLife.projects));
    assert.deepEqual(clone(done.life().ledger), clone(completed.currentLife.ledger));
    assert.deepEqual(clone(done.life().resources), clone(completed.currentLife.resources));
    const restored = roundTrip(done);
    assert.equal(restored.projects.isUnlocked(restored.life(), IDS[routeId]), true);
    for (const id of Object.values(IDS).filter(id => id !== IDS[routeId])) assert.equal(restored.projects.isUnlocked(restored.life(), id), false);
  }
});

test("cross-route forged fields, wrong steps and missing purchase proof are rejected before import", () => {
  for (const [routeId, prep] of [["study", "practice"], ["study", "book"], ["community", "practice"]]) {
    const app = youth(routeId, prep);
    const valid = app.engine.getState();
    const field = routeId === "study" ? "finalStudy" : "finalEmpathy";
    const mutations = [
      life => { life.projects.current.finalCraft = 10; },
      life => { life.projects.current[field] = 4; },
      life => { life.projects.current.steps.firstWork.actionId = "shop-shift"; },
      life => { life.projects.current.steps.preparation.moneySpent += 1; },
      life => { life.projects.current.resultId = IDS.craft + ":completed"; },
      life => { life.strategy.evidence = life.strategy.evidence.filter(entry => entry.id !== life.projects.current.steps.returnWork.actionId || entry.round !== 9); },
      life => { life.lastAction = null; },
    ];
    if (prep === "book") mutations.push(life => { life.ledger.entries = life.ledger.entries.filter(entry => entry.kind !== "purchase"); });
    for (const mutate of mutations) {
      const bad = clone(valid); mutate(bad.currentLife);
      assert.throws(() => app.projects.normalize(bad.currentLife.projects, bad.currentLife), /项目记录无效/);
      const candidate = app.save.prepareImport(JSON.stringify(bad));
      assert.equal(candidate.ok, false);
      assert.deepEqual(clone(app.engine.getState()), clone(valid));
    }
  }
});

test("same-node consultation earns two actual wages, a third is rejected, and the ledger survives import", () => {
  let app = youth("study");
  app.send({ type: "ADVANCE_ROUND" }); app.send({ type: "SKIP_OPPORTUNITY" });
  const before = app.life();
  app.send({ type: "LIFE_ACTION", id: "project-study-consult" });
  assert.equal(app.life().actionPoints, 1);
  app.send({ type: "LIFE_ACTION", id: "project-study-consult" });
  const after = app.engine.getState();
  assert.equal(app.life().actionPoints, 0);
  assert.equal(app.life().resources.money - before.resources.money, 12);
  assert.equal(app.life().resources.energy - before.resources.energy, -4);
  assert.equal(app.life().jobShifts - before.jobShifts, 2);
  assert.equal(app.life().strategy.evidence.filter(entry => entry.round === 11 && entry.id === "project-study-consult").length, 1);
  assert.equal(app.life().ledger.entries.filter(entry => entry.round === 11 && entry.id === "project-study-consult").length, 2);
  assert.equal(app.engine.dispatch({ type: "LIFE_ACTION", id: "project-study-consult" }).ok, false);
  assert.deepEqual(clone(app.engine.getState()), clone(after));
  app = roundTrip(app);
  assert.deepEqual(clone(app.engine.getState()), clone(after));
});

test("one consultation leaves real time for personal care instead of making the two-AP tutoring tradeoff disappear", () => {
  const app = youth("study");
  app.send({ type: "ADVANCE_ROUND" }); app.send({ type: "SKIP_OPPORTUNITY" });
  const snapshot = app.engine.getState();
  const before = app.life();
  app.send({ type: "LIFE_ACTION", id: "tutor-shift" });
  const tutoring = app.life();
  assert.equal(app.engine.previewAction({ type: "LIFE_ACTION", id: "routine-care" }).available, false);
  app.engine.replaceState(snapshot);
  app.send({ type: "LIFE_ACTION", id: "project-study-consult" });
  assert.equal(app.life().actionPoints, 1);
  assert.equal(app.engine.previewAction({ type: "LIFE_ACTION", id: "routine-care" }).available, true);
  app.send({ type: "LIFE_ACTION", id: "routine-care" });
  const coordinated = app.life();
  assert.equal(coordinated.actionPoints, 0);
  assert.equal(coordinated.resources.money - before.resources.money, 6);
  assert.equal(tutoring.resources.money - before.resources.money, 8);
  assert.equal(coordinated.relationships.family - tutoring.relationships.family, 1);
  assert.equal(tutoring.relationships.child - coordinated.relationships.child, 1);
  assert.equal(coordinated.resources.energy - tutoring.resources.energy, -1);
  assert.equal(coordinated.skills.empathy - tutoring.skills.empathy, 1);
});

test("paid coordination adds actual younger-family contact compared with free rest at 47 and 65, and caps remain visible in preview", () => {
  for (const targetRound of [15, 20]) {
    const app = youth("community"); app.send({ type: "ADVANCE_ROUND" });
    for (let round = 11; round < targetRound; round += 1) app.node(app.schedule("community", round), ROUTES.community.events[round]);
    app.send({ type: "SKIP_OPPORTUNITY" });
    const snapshot = app.engine.getState();
    const before = app.life();
    assert.equal(before.age, targetRound === 15 ? 47 : 65);
    assert.ok(before.relationships.child < 10);
    app.send({ type: "LIFE_ACTION", id: "routine-rest" });
    const rested = app.life();
    app.engine.replaceState(snapshot);
    const preview = app.engine.previewAction({ type: "LIFE_ACTION", id: "project-community-care" });
    app.send({ type: "LIFE_ACTION", id: "project-community-care" });
    const shared = app.life();
    assert.equal(shared.relationships.child, rested.relationships.child + 1);
    assert.equal(shared.resources.money, rested.resources.money - 3);
    assert.equal(shared.resources.energy, rested.resources.energy);
    assert.equal(shared.resources.pressure, rested.resources.pressure);
    assert.equal(preview.remaining.energy, shared.resources.energy);
    assert.equal(preview.remaining.money, shared.resources.money);
    assert.ok(preview.changes.some(change => change.includes("晚辈")));
    console.log(JSON.stringify({ witness: "coordination-versus-rest", age: before.age, before: { cash: before.resources.money, energy: before.resources.energy, child: before.relationships.child }, shared: { cash: shared.resources.money, energy: shared.resources.energy, child: shared.relationships.child }, rest: { cash: rested.resources.money, energy: rested.resources.energy, child: rested.relationships.child } }));
  }
  const app = youth("community"); app.send({ type: "ADVANCE_ROUND" });
  for (let round = 11; round < 18; round += 1) app.node(round >= 15 ? ["project-community-care", "project-community-care"] : app.schedule("community", round), ROUTES.community.events[round]);
  app.send({ type: "SKIP_OPPORTUNITY" });
  app.send({ type: "LIFE_ACTION", id: "project-community-care" });
  assert.equal(app.life().age, 56);
  assert.equal(app.life().relationships.child, 10, "cap reached through paid ordinary commands");
  const capped = app.engine.previewAction({ type: "LIFE_ACTION", id: "project-community-care" });
  assert.equal(capped.changes.some(change => change.includes("晚辈")), false, "actual preview does not advertise capped growth");
  const before = app.life();
  app.send({ type: "LIFE_ACTION", id: "project-community-care" });
  assert.equal(app.life().relationships.child, 10);
  assert.equal(app.life().resources.money, before.resources.money - 3);
});

test("craft v1 fixture receipts and result remain unchanged by the registry extension", () => {
  const app = game();
  for (const file of ["youth-19-offer.json", "youth-28-feedback.json", "middle-32-independent-work.json"]) {
    const text = fs.readFileSync(path.join(ROOT, "output/implementation-proposals/desktop-v9-gameplay/fixtures", file), "utf8");
    const original = JSON.parse(text);
    const candidate = app.save.prepareImport(text);
    assert.equal(candidate.ok, true, JSON.stringify(candidate));
    app.engine.replaceState(candidate.state);
    assert.deepEqual(clone(app.life().projects), clone(original.currentLife.projects));
  }
  const job = app.projects.getJobDefinition();
  assert.equal(job.id, "project-craft-shift");
  assert.deepEqual(clone(job.effect.resources), { money: 14, energy: -4, pressure: 2 });
});

test("paid care cannot spend missing cash, preserves AP on rejection, and personal care still advances", () => {
  const app = youth("community");
  app.send({ type: "ADVANCE_ROUND" }); app.send({ type: "SKIP_OPPORTUNITY" });
  app.send({ type: "BUY_ITEM", id: "old-phone" });
  assert.equal(app.life().resources.money, 2, "ordinary purchase leaves the actual shortage");
  assert.equal(app.life().actionPoints, 1);
  const before = app.engine.getState();
  assert.equal(app.engine.previewAction({ type: "LIFE_ACTION", id: "project-community-care" }).available, false);
  assert.equal(app.engine.dispatch({ type: "LIFE_ACTION", id: "project-community-care" }).ok, false);
  assert.deepEqual(clone(app.engine.getState()), clone(before));
  app.send({ type: "LIFE_ACTION", id: "routine-care" });
  app.send({ type: "EVENT_ACTION", id: "chain-community-roster" });
  app.send({ type: "ADVANCE_ROUND" });
  assert.equal(app.life().age, 36);
  assert.equal(app.life().projects.current.status, "completed");
});

test("missing new-route preparation ends incomplete without penalties or later retroactive success", () => {
  for (const routeId of ["study", "community"]) {
    const app = game(), stable = game();
    app.entry(routeId); stable.entry(routeId);
    app.send({ type: "ACCEPT_PROJECT", id: IDS[routeId] });
    for (let round = 7; round <= 10; round += 1) {
      app.node(app.schedule(routeId, round), ROUTES[routeId].events[round], round !== 10);
      stable.node(stable.schedule(routeId, round), ROUTES[routeId].events[round], round !== 10);
    }
    assert.equal(app.life().projects.current.status, "incomplete");
    assert.deepEqual(clone(app.life().resources), clone(stable.life().resources));
    assert.deepEqual(clone(app.life().ledger), clone(stable.life().ledger));
    assert.equal(app.projects.isUnlocked(app.life(), IDS[routeId]), false);
    const restored = roundTrip(app);
    restored.send({ type: "ADVANCE_ROUND" });
    restored.node(["routine-study", "routine-care"], routeId === "study" ? "pay-medical-bill" : "chain-community-roster");
    assert.equal(restored.life().projects.current.status, "incomplete");
    assert.equal(restored.projects.settle(restored.life()).changed, false);
  }
});
