"use strict";
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
const clone = value => JSON.parse(JSON.stringify(value));
const specs = {
  craft: { start: 4, source: 8, target: 12, startId: "chain-craft-promise", sourceId: "chain-craft-trial", targetId: "chain-craft-workshop", variant: "journey-craft-repair-v1", skill: "craft", practice: "routine-repair", energy: 2, falseClaim: /修理铺和集市获得新的基础/ },
  study: { start: 4, source: 8, target: 16, startId: "chain-study-plan", sourceId: "chain-study-trial", targetId: "chain-study-report", variant: "journey-study-recheck-v1", skill: "study", practice: "routine-study", energy: 3, falseClaim: /两页可以复查的证据/ },
  community: { start: 5, source: 11, target: 15, startId: "chain-community-promise", sourceId: "chain-community-roster", targetId: "chain-community-flood", variant: "journey-community-replan-v1", skill: "empathy", practice: "routine-care", energy: 3, falseClaim: /邻里、河桥与集市得到实际帮助/ },
};
function load() {
  const scope = { console, Date, TextEncoder, Blob, setTimeout, clearTimeout }; scope.window = scope;
  vm.createContext(scope);
  for (const name of ["content", "strategy", "projects", "journey", "save", "engine"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "development/game", name + ".js"), "utf8"), scope);
  const engine = scope.EchoTownEngine, strategy = scope.EchoTownStrategy, journey = scope.EchoTownJourney, content = scope.EchoTownContent;
  const life = () => engine.getState().currentLife;
  function send(command) {
    const before = life(), result = engine.dispatch(command);
    assert.equal(result.ok, true, JSON.stringify({ command, age: before?.age, error: result.error, resources: before?.resources, skills: before?.skills }));
    return life();
  }
  function node(schedule, event, advance = true) {
    send({ type: "SKIP_OPPORTUNITY" });
    for (const id of schedule) send({ type: "LIFE_ACTION", id });
    if (life().actionPoints) send({ type: "END_LIFE_ACTIONS" });
    send({ type: "EVENT_ACTION", id: event });
    return advance ? send({ type: "ADVANCE_ROUND" }) : life();
  }
  return { engine, strategy, journey, content, life, send, node };
}
function failedThenRecovered(routeId) {
  const app = load(), spec = specs[routeId];
  app.send({ type: "UPDATE_SETUP", patch: { profileId: "newcomer", routeId, talentIds: ["strong-back", "good-family", "restless-feet"], attributes: { appearance: 0, intelligence: 0, physique: 10, family: 10 } } });
  app.send({ type: "START_LIFE" });
  for (let index = 0; index < spec.target; index += 1) {
    const event = index === spec.start ? spec.startId : index === spec.source ? spec.sourceId : "steady-" + app.content.rounds[index].id;
    const schedule = index > spec.source && app.life().skills[spec.skill] < 6 ? [spec.practice, spec.practice] : index >= 7 && index % 2 ? ["courier-shift"] : ["routine-rest"];
    app.node(schedule, event, index !== spec.source);
    if (index === spec.source) {
      assert.equal(app.life().lastAction.test.success, false, "failure comes from ordinary low-skill commands");
      app.send({ type: "ADVANCE_ROUND" });
    }
  }
  app.send({ type: "SKIP_OPPORTUNITY" });
  if (app.life().skills[spec.skill] < 6) app.send({ type: "LIFE_ACTION", id: spec.practice });
  app.send({ type: "LIFE_ACTION", id: "routine-rest" });
  if (app.life().actionPoints) app.send({ type: "END_LIFE_ACTIONS" });
  const before = app.life();
  const preview = app.engine.previewAction({ type: "EVENT_ACTION", id: spec.targetId });
  assert.equal(preview.available, true);
  app.send({ type: "EVENT_ACTION", id: spec.targetId });
  const after = app.life();
  assert.equal(after.lastAction.test.success, true);
  assert.equal(after.lastAction.journeyVariant, spec.variant);
  assert.equal(after.resources.energy, preview.remaining.energy);
  assert.ok(after.strategy.evidence.some(entry => entry.id === spec.sourceId && entry.success === false));
  return { ...app, spec, before, after };
}

for (const routeId of Object.keys(specs)) test(routeId + ": smaller recovery outcome and its immediate and later narrative report the same actual result", () => {
  const app = failedThenRecovered(routeId), { spec, before, after } = app;
  if (routeId === "craft") {
    assert.equal(after.town.market, before.town.market);
    assert.equal(after.town.shop - before.town.shop, 1);
    assert.equal(after.resources.money - before.resources.money, -3);
  } else if (routeId === "study") assert.equal(after.town.archive - before.town.archive, 1);
  else {
    assert.equal(after.town.market, before.town.market);
    assert.equal(after.town.bridge - before.town.bridge, 1);
    assert.equal(after.relationships.neighbor - before.relationships.neighbor, 2);
  }
  const consequence = app.strategy.getConsequences(after).find(entry => entry.sourceActionId === spec.targetId);
  console.log(JSON.stringify({ witness: "actual-recovery-narrative", routeId, variant: spec.variant, future: after.lastAction.future, consequence: consequence.copy }));
  assert.doesNotMatch(after.lastAction.future, spec.falseClaim, "feedback must not promise the larger original reward");
  assert.doesNotMatch(consequence.copy, spec.falseClaim, "later consequence view must retain the actual reduced scope");
  // An explicit old-shape projection fixture checks compatibility only. It is
  // never dispatched, imported, or described as a naturally generated old save.
  const oldShape = clone(after);
  delete oldShape.actions.find(entry => entry.actionId === spec.targetId).journeyVariant;
  delete oldShape.lastAction.journeyVariant;
  const oldFeedback = JSON.stringify(oldShape.lastAction);
  assert.match(app.strategy.getConsequences(oldShape).find(entry => entry.sourceActionId === spec.targetId).copy, spec.falseClaim, "unmarked settled records retain the original definition even when an earlier failure exists");
  app.journey.getReview(oldShape);
  assert.equal(JSON.stringify(oldShape.lastAction), oldFeedback, "read models cannot rewrite stored feedback");
  const snapshot = app.engine.getState();
  assert.equal(app.engine.dispatch({ type: "EVENT_ACTION", id: spec.targetId }).ok, false);
  assert.deepEqual(clone(app.engine.getState()), clone(snapshot));
  if (routeId === "study") assert.equal(after.strategy.goals["study:middle"].status, "achieved", "a successful limited investigation is still a real investigation");
  if (routeId === "community") {
    app.send({ type: "ADVANCE_ROUND" });
    app.node(["routine-rest"], "steady-middle-ledger", false);
    assert.equal(app.life().strategy.goals["community:middle"].status, "achieved", "a successful smaller evacuation remains actual public cooperation");
  }
});

test("one repaired small order ends its chain but cannot impersonate opening a workshop in the middle-life goal", () => {
  const app = failedThenRecovered("craft");
  app.send({ type: "ADVANCE_ROUND" });
  for (let round = 13; round <= 16; round += 1) app.node(["shop-shift"], "steady-" + app.content.rounds[round].id, round !== 16);
  const life = app.life();
  const goal = app.strategy.getGoals(life).goals.find(item => item.id === "craft:middle");
  assert.ok(life.skills.craft >= 7);
  assert.ok(life.resources.money >= app.engine.getLivingCost(52).cost);
  assert.ok(life.strategy.evidence.some(entry => entry.id === "shop-shift" && entry.round > 12));
  assert.equal(life.strategy.consequences.filter(entry => entry.id === "craft-orders-delivered" && entry.success).length, 1);
  console.log(JSON.stringify({ witness: "small-repair-is-not-a-workshop", age: life.age, craft: life.skills.craft, cash: life.resources.money, goal, action: life.actions.find(entry => entry.actionId === "chain-craft-workshop") }));
  assert.equal(goal.status, "missed");
  assert.deepEqual(clone(life.strategy.goals["craft:middle"].checks), [true, false, true]);
});

test("original successful craft workshop remains eligible and carries its original actual expansion narrative", () => {
  const app = load(), route = ROUTES.craft;
  app.send({ type: "SET_PRESET", routeId: "craft" }); app.send({ type: "START_LIFE" });
  for (let round = 0; round <= 16; round += 1) app.node(route.schedule[round] || [route.job], route.events[round], round !== 16);
  const life = app.life();
  assert.equal(life.strategy.goals["craft:middle"].status, "achieved");
  assert.equal(life.actions.find(entry => entry.actionId === "chain-craft-workshop").journeyVariant, undefined);
  assert.match(app.strategy.getConsequences(life).find(entry => entry.sourceActionId === "chain-craft-workshop").copy, /修理铺和集市获得新的基础/);
});

test("formal three-route lives ground each core NPC arc and three-choice review in actual event and ledger records", () => {
  const covered = new Set(), witnesses = [];
  for (const routeId of Object.keys(ROUTES)) {
    const app = load(), route = ROUTES[routeId];
    app.send({ type: "SET_PRESET", routeId }); app.send({ type: "START_LIFE" });
    for (let round = 0; round < app.content.rounds.length; round += 1) {
      const schedule = route.schedule[round] || (round >= 17 ? ["routine-rest", routeId === "study" ? "routine-record" : "routine-social"] : [route.job]);
      app.node(schedule, route.events[round]);
    }
    const life = app.life(), beforeRead = JSON.stringify(life), review = app.journey.getReview(life);
    assert.equal(life.status, "complete");
    assert.equal(life.actions.length, 23);
    assert.equal(review.stages.filter(stage => stage.decision).length, 5);
    assert.equal(review.choices.length, 3);
    assert.equal(new Set(review.choices.map(choice => choice.id)).size, 3);
    for (const choice of review.choices) {
      assert.ok(life.actions.some(entry => entry.actionId === choice.id && entry.round === choice.round + 1 && entry.label === choice.label));
      for (const entry of choice.costs.ledgerEntries) {
        const { index, ...actual } = entry;
        assert.deepEqual(clone(actual), clone(life.ledger.entries[index]));
      }
    }
    const npcs = routeId === "craft" ? ["qishu"] : routeId === "study" ? ["linlaoshi"] : ["chenshen", "ahe"];
    for (const id of npcs) {
      const timeline = app.journey.getNpcTimeline(life, id);
      assert.ok(timeline.entries.length >= 3, `${id} needs three actual connected encounters`);
      for (let index = 0; index < timeline.entries.length; index += 1) {
        const entry = timeline.entries[index];
        assert.ok(entry.sourceIds.every(source => life.actions.some(action => action.actionId === source)));
        if (index) {
          const previous = timeline.entries[index - 1];
          assert.ok(entry.age >= previous.age);
          assert.equal(entry.previousId, previous.id);
          assert.ok(entry.text.includes(previous.recalledChoice));
        }
      }
      covered.add(id);
      witnesses.push({ routeId, npcId: id, ages: timeline.entries.map(entry => entry.age) });
    }
    if (routeId === "community") {
      const publication = app.journey.getNpcTimeline(life, "linlaoshi").entries.find(entry => entry.sourceIds.includes("publish-ledger"));
      assert.ok(publication);
      assert.match(publication.text, /公开了材料，还需要继续核对/);
      assert.doesNotMatch(publication.text, /这次查实的部分/);
      assert.ok(!app.journey.getWorldView(life).markers.some(marker => marker.id === "checked-pages"), "publication without an investigation is not verified evidence");
    }
    assert.equal(JSON.stringify(life), beforeRead);
  }
  assert.deepEqual([...covered].sort(), ["ahe", "chenshen", "linlaoshi", "qishu"]);
  console.log(JSON.stringify({ witness: "core-npc-actual-chronology", paths: witnesses }));
});
