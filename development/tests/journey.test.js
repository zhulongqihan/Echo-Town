"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development/game/content.js"))) ROOT = path.dirname(ROOT);
const clone = value => JSON.parse(JSON.stringify(value));
const { ROUTES } = require(path.join(ROOT, "development/tests/natural-routes.test.js"));
function load() {
  const scope = { console, Date, TextEncoder, Blob, setTimeout, clearTimeout };
  scope.window = scope; vm.createContext(scope);
  for (const name of ["content", "strategy", "projects", "journey", "save", "engine"]) {
    const file = path.join(ROOT, "development/game", name + ".js");
    vm.runInContext(fs.readFileSync(file, "utf8"), scope, { filename: file });
  }
  const engine = scope.EchoTownEngine, content = scope.EchoTownContent, journey = scope.EchoTownJourney;
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
  return { scope, engine, content, journey, life, send, node };
}
function natural(routeId) {
  const app = load(), route = ROUTES[routeId];
  app.send({ type: "SET_PRESET", routeId }); app.send({ type: "START_LIFE" });
  for (let round = 0; round < app.content.rounds.length; round++) {
    const schedule = route.schedule[round] || (round >= 17 ? ["routine-rest", routeId === "study" ? "routine-record" : "routine-social"] : [route.job]);
    app.node(schedule, route.events[round]);
  }
  return app;
}
const failures = {
  craft: { start: 4, source: 8, target: 12, startId: "chain-craft-promise", sourceId: "chain-craft-trial", targetId: "chain-craft-workshop", variant: "journey-craft-repair-v1", skill: "craft", practice: "routine-repair", energy: 2 },
  study: { start: 4, source: 8, target: 16, startId: "chain-study-plan", sourceId: "chain-study-trial", targetId: "chain-study-report", variant: "journey-study-recheck-v1", skill: "study", practice: "routine-study", energy: 3 },
  community: { start: 5, source: 11, target: 15, startId: "chain-community-promise", sourceId: "chain-community-roster", targetId: "chain-community-flood", variant: "journey-community-replan-v1", skill: "empathy", practice: "routine-care", energy: 3 },
};
function failurePath(routeId) {
  const app = load(), spec = failures[routeId];
  app.send({ type: "UPDATE_SETUP", patch: { profileId: "newcomer", routeId, talentIds: ["strong-back", "good-family", "restless-feet"], attributes: { appearance: 0, intelligence: 0, physique: 10, family: 10 } } });
  app.send({ type: "START_LIFE" });
  let failed;
  for (let index = 0; index < spec.target; index++) {
    const event = index === spec.start ? spec.startId : index === spec.source ? spec.sourceId : "steady-" + app.content.rounds[index].id;
    const schedule = index > spec.source && app.life().skills[spec.skill] < 6 ? [spec.practice, spec.practice] : index >= 7 && index % 2 ? ["courier-shift"] : ["routine-rest"];
    app.node(schedule, event, index !== spec.source);
    if (index === spec.source) {
      failed = clone(app.life());
      assert.equal(failed.lastAction.test.success, false, "The failure must be caused by the actual engine, not an edited fixture");
      app.send({ type: "ADVANCE_ROUND" });
    }
  }
  app.send({ type: "SKIP_OPPORTUNITY" });
  if (app.life().skills[spec.skill] < 6) app.send({ type: "LIFE_ACTION", id: spec.practice });
  app.send({ type: "LIFE_ACTION", id: "routine-rest" });
  if (app.life().actionPoints) app.send({ type: "END_LIFE_ACTIONS" });
  return { ...app, spec, failed };
}
function freeze(value) { if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

for (const routeId of Object.keys(failures)) test(routeId + ": actual failed predecessor changes preview, affordability, execution and stored result with the same ID", () => {
  const app = failurePath(routeId), { spec } = app;
  const before = app.life(), action = app.engine.getAvailableEventActions(before).find(action => action.id === spec.targetId);
  assert.equal(action.journeyVariant, spec.variant, "the original engine must load the pure Journey resolver");
  const base = app.content.rounds[spec.target].actions.find(action => action.id === spec.targetId);
  assert.deepEqual(action.requires, base.requires);
  const preview = app.engine.previewAction({ type: "EVENT_ACTION", id: spec.targetId });
  assert.equal(preview.available, true); assert.equal(preview.test.difficulty, 6);
  assert.equal(preview.remaining.energy, before.resources.energy - spec.energy);
  const sameAgain = app.engine.previewAction({ type: "EVENT_ACTION", id: spec.targetId });
  assert.deepEqual(sameAgain, preview);
  const after = app.send({ type: "EVENT_ACTION", id: spec.targetId });
  assert.equal(after.lastAction.actionId, spec.targetId); assert.equal(after.lastAction.journeyVariant, spec.variant);
  assert.equal(after.lastAction.test.success, true); assert.equal(after.lastAction.test.difficulty, 6);
  assert.equal(after.resources.energy, preview.remaining.energy);
  assert.ok(after.strategy.evidence.some(entry => entry.id === spec.sourceId && entry.success === false));
  assert.equal(app.engine.dispatch({ type: "EVENT_ACTION", id: spec.targetId }).ok, false);
  assert.deepEqual(app.life(), after, "repeating an event does not settle or award twice");
  const read = app.journey.getStageDecisions(after).find(stage => stage.stageId === "middle").decision;
  assert.equal(read.variantId, spec.variant);
  if (routeId === "craft") { assert.equal(read.costs.cashPaid, 6); assert.equal(read.costs.cashReceived, 3); assert.equal(after.resources.money - before.resources.money, -3); }
  const older = clone(after); delete older.actions[older.actions.length - 1].journeyVariant;
  assert.equal(app.journey.getStageDecisions(older).find(stage => stage.stageId === "middle").decision.variantId, null, "older settled feedback is not relabelled as a new version");
  const output = JSON.stringify(after); app.journey.getReview(freeze(after)); app.journey.getNpcTimeline(after, routeId === "craft" ? "qishu" : routeId === "study" ? "linlaoshi" : "chenshen");
  assert.equal(JSON.stringify(after), output);
  console.log(JSON.stringify({ routeId, source: { age: app.failed.age, score: app.failed.lastAction.test.score, success: false }, target: { age: after.age, variant: spec.variant, difficulty: 6, score: after.lastAction.test.score, cashPaid: read.costs.cashPaid, cashReceived: read.costs.cashReceived, energySpent: spec.energy } }));
});

test("no failure evidence means no variant; flags, route, success and unknown old outcomes cannot impersonate failure", () => {
  const app = load();
  for (const spec of Object.values(failures)) {
    const base = app.content.rounds[spec.target].actions.find(action => action.id === spec.targetId);
    for (const result of [undefined, true]) {
      const life = freeze({ round: spec.target, strategy: { routeId: "craft", evidence: result === undefined ? [] : [{ id: spec.sourceId, round: spec.source, kind: "event", success: result }] }, flags: [spec.sourceId], actions: [{ actionId: spec.sourceId, round: spec.source + 1, success: false }] });
      assert.deepEqual(app.journey.resolveEventAction(life, freeze(clone(base))), base);
    }
    const wrongRound = { round: spec.target, strategy: { evidence: [{ id: spec.sourceId, round: spec.source - 1, kind: "event", success: false }] } };
    assert.deepEqual(app.journey.resolveEventAction(wrongRound, base), base);
  }
});

test("three natural full lives produce five stage decisions, distinct reviews and at least three chronological replies for all four NPCs", () => {
  const lives = Object.fromEntries(["craft", "study", "community"].map(route => [route, natural(route)]));
  const titles = new Set();
  for (const [route, app] of Object.entries(lives)) {
    const life = freeze(app.life()), original = JSON.stringify(life), review = app.journey.getReview(life);
    assert.equal(review.stages.length, 5); assert.ok(review.stages.every(stage => stage.decision));
    assert.equal(review.choices.length, 3); assert.equal(new Set(review.choices.map(choice => choice.id)).size, 3);
    for (const choice of review.choices) {
      assert.ok(life.actions.some(entry => entry.actionId === choice.id && entry.label === choice.label));
      for (const entry of choice.costs.ledgerEntries) assert.deepEqual({ ...entry, index: undefined }, { ...life.ledger.entries[entry.index], index: undefined });
    }
    titles.add(JSON.stringify(review.choices.map(choice => choice.id)));
    assert.equal(JSON.stringify(life), original);
    const npc = route === "craft" ? "qishu" : route === "study" ? "linlaoshi" : "chenshen";
    for (const id of route === "community" ? [npc, "ahe"] : [npc]) {
      const timeline = app.journey.getNpcTimeline(life, id);
      assert.ok(timeline.entries.length >= 3, `${id} needs three actual recorded responses`);
      for (let i = 1; i < timeline.entries.length; i++) {
        assert.ok(timeline.entries[i].age >= timeline.entries[i - 1].age);
        assert.equal(timeline.entries[i].previousId, timeline.entries[i - 1].id);
        assert.ok(timeline.entries[i].text.includes(timeline.entries[i - 1].recalledChoice));
      }
    }
    const old = clone(life); old.strategy.evidence = []; old.ledger.entries = [];
    assert.equal(app.journey.getWorldView(old).markers.length, 0);
    assert.ok(app.journey.getReview(old).choices.every(choice => choice.success === null && choice.costs.measured === false));
  }
  assert.equal(titles.size, 3, "different lives choose different recorded turning points");
});

test("three representative inheritance paths point to existing gated choices without granting or selecting anything", () => {
  const app = natural("community"), before = app.life();
  const paths = app.journey.getLegacyPaths(before, ["small-tool", "study-notebook", "friend-letter"]);
  assert.equal(paths.length, 3); assert.equal(new Set(paths.map(path => path.routeId)).size, 3);
  for (const item of paths) {
    const definition = app.content.rounds.find(round => round.age === item.age).actions.find(action => action.id === item.actionId);
    assert.ok(definition); assert.ok(item.selected); assert.ok(definition.requires.length > 0);
  }
  assert.deepEqual(app.life(), before);
});

function withProject(routeId, mode = "completed") {
  const app = load(), route = ROUTES[routeId];
  const id = { craft: "craft-customers-youth-v1", study: "study-practice-youth-v1", community: "community-network-youth-v1" }[routeId];
  app.send({ type: "SET_PRESET", routeId }); app.send({ type: "START_LIFE" });
  for (let round = 0; round < 7; round++) app.node(route.schedule[round] || [route.job], route.events[round]);
  app.send({ type: "ACCEPT_PROJECT", id });
  const steps = routeId === "craft" ? [["shop-shift"], ["routine-repair", "routine-rest"], ["shop-shift"]] : routeId === "study" ? [["tutor-shift"], ["routine-study", "routine-rest"], ["tutor-shift"]] : [["routine-care", "routine-rest"], ["routine-record", "routine-rest"], ["routine-social", "routine-rest"]];
  for (let round = 7; round < 10; round++) {
    if (mode === "withdrawn" && round === 9) app.send({ type: "WITHDRAW_PROJECT" });
    const schedule = mode === "incomplete" && round === 8 ? ["routine-rest", "routine-rest"] : steps[round - 7];
    app.node(schedule, route.events[round]);
  }
  app.node(route.schedule[10] || [route.job], route.events[10], false);
  return app;
}

test("three real project histories drive NPC identity, actual receipts and visual markers regardless of route tracking", () => {
  for (const routeId of ["craft", "study", "community"]) {
    const app = withProject(routeId), expected = { craft: "qishu", study: "linlaoshi", community: "chenshen" }[routeId];
    const before = app.life();
    assert.equal(before.projects.current.status, "completed");
    app.send({ type: "SET_ROUTE", routeId: routeId === "craft" ? "study" : "craft" });
    const life = freeze(app.life());
    const review = app.journey.getReview(life);
    assert.equal(review.project.routeId, routeId); assert.equal(review.project.npcId, expected);
    const receipts = Object.values(life.projects.current.steps);
    assert.equal(review.project.costs.actionPoints, receipts.reduce((total, step) => total + step.ap, 0));
    assert.equal(review.project.costs.energySpent, receipts.reduce((total, step) => total + step.energySpent, 0));
    assert.ok(app.journey.getWorldView(life).markers.some(item => item.id === "project:" + life.projects.current.id));
    assert.equal(app.journey.getNpcTimeline(life, expected).current.age, 28);
    app.send({ type: "ADVANCE_ROUND" });
    for (let round = 11; round <= 20; round++) app.node(round >= 17 ? ["routine-rest", "routine-social"] : [ROUTES[routeId].job], ROUTES[routeId].events[round], round !== 20);
    const timeline = app.journey.getNpcTimeline(app.life(), expected);
    assert.ok(timeline.current.age > 28, "a settled youth project must not replace a later real response");
    assert.ok(timeline.entries.some(item => item.proof.kind === "project"));
  }
});

test("incomplete and withdrawn projects retain actual paid steps without a completed visual marker", () => {
  for (const status of ["incomplete", "withdrawn"]) {
    const app = withProject("craft", status), life = freeze(app.life());
    assert.equal(life.projects.current.status, status);
    const review = app.journey.getReview(life);
    assert.equal(review.project.status, status); assert.equal(review.project.completedSteps, 2);
    assert.ok(review.project.costs.actionPoints > 0);
    assert.ok(!app.journey.getWorldView(life).markers.some(marker => marker.id.startsWith("project:")));
    assert.equal(app.journey.getNpcTimeline(life, "qishu").entries.find(entry => entry.proof.kind === "project").status, status);
  }
});

test("challenge review and explicit no-inheritance context do not suggest another generation", () => {
  const app = natural("community"), life = app.life();
  for (const options of [{ mode: "challenge" }, { allowInheritance: false }]) {
    const review = app.journey.getReview(life, options);
    assert.equal(review.allowInheritance, false); assert.equal(review.nextStrategies.length, 0);
    assert.ok(!review.title.includes("下一世")); assert.equal(review.choices.length, 3);
  }
});

module.exports = { load, natural, failurePath, withProject };
