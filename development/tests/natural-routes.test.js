"use strict";

// Run from the repository root:
// node --test output/implementation-proposals/strategy/natural-routes.test.js
// Uses only public gameplay commands. No replaceState, direct state writes,
// artificial skill/resource fixtures, opportunity rerolls, or inherited items.
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
const ROUTES = {
  craft: {
    events: ["fix-radio", "share-notes", "rest-at-home", "repair-lantern", "chain-craft-promise", "join-repair", "stay-for-family", "city-library", "chain-craft-trial", "keep-friendship", "return-workshop", "ask-family-share", "chain-craft-workshop", "talk-through", "tell-regret", "steady-middle-flood", "keep-wet-pages", "teach-youth", "archive-postcard", "steady-later-town", "train-successor", "steady-later-farewell", "handoff-craft"],
    schedule: { 0: ["routine-rest"], 1: ["routine-repair", "routine-rest"], 2: ["routine-rest"], 3: ["routine-rest"], 4: ["routine-repair", "routine-repair"] },
    job: "shop-shift", consequenceId: "craft-orders-delivered",
  },
  study: {
    events: ["read-comic", "front-seat", "rest-at-home", "tell-story", "chain-study-plan", "join-literature", "ask-scholarship", "city-library", "chain-study-trial", "confess-love", "take-promotion", "pay-medical-bill", "change-career", "steady-middle-partner", "tell-regret", "steady-middle-flood", "chain-study-report", "return-school", "write-letter", "save-school", "record-life", "steady-later-farewell", "handoff-study"],
    schedule: { 0: ["routine-rest"], 1: ["routine-rest"], 2: ["routine-rest"], 3: ["routine-rest"], 4: ["routine-rest"] },
    job: "tutor-shift", consequenceId: "study-report-verified",
  },
  community: {
    events: ["yard-play", "share-notes", "ask-for-help", "invite-shy-child", "comfort-friend", "chain-community-promise", "stay-for-family", "city-library", "mentor-newcomer", "keep-friendship", "community-speech", "chain-community-roster", "change-career", "talk-through", "support-choice", "chain-community-flood", "publish-ledger", "teach-youth", "write-letter", "invite-town-alumni", "give-away-tools", "call-family", "handoff-community"],
    schedule: { 0: ["routine-rest"], 1: ["routine-rest"], 2: ["routine-rest"], 3: ["routine-rest"], 4: ["routine-record", "routine-record"], 5: ["market-shift"], 6: ["market-shift"], 7: ["routine-social", "routine-rest"], 8: ["market-shift"], 9: ["routine-social", "routine-rest"], 10: ["market-shift"] },
    job: "town-job", consequenceId: "community-roster-worked",
  },
};

function loadGame() {
  const sandbox = { console, Date, TextEncoder, Blob, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["content.js", "strategy.js", "projects.js", "save.js", "engine.js"]) {
    const absolute = path.join(ROOT, "development/game", file);
    vm.runInContext(fs.readFileSync(absolute, "utf8"), sandbox, { filename: absolute });
  }
  return { engine: sandbox.EchoTownEngine, strategy: sandbox.EchoTownStrategy, content: sandbox.EchoTownContent };
}

function runRoute(routeId) {
  const { engine, strategy, content } = loadGame();
  const route = ROUTES[routeId];
  const transcript = [];
  let executed = 0;

  function dispatch(command) {
    const before = engine.getState().currentLife;
    const result = engine.dispatch(command);
    assert.equal(result.ok, true, JSON.stringify({ routeId, age: before && before.age, command, error: result.error, resources: before && before.resources, skills: before && before.skills }));
    executed += 1;
    return engine.getState().currentLife;
  }

  dispatch({ type: "SET_PRESET", routeId });
  const initial = dispatch({ type: "START_LIFE" });
  assert.equal(initial.inheritedLegacyIds.length, 0);
  assert.ok(Object.values(initial.skills).every(value => value < 8), "A real new character starts below mastery");
  assert.equal(initial.strategy.routeId, routeId);

  for (let round = 0; round < content.rounds.length; round += 1) {
    dispatch({ type: "SKIP_OPPORTUNITY" });
    // Savings earned earlier fund the last six nodes. Recovery and social or
    // writing time make the route a sustainable life, not an endless work loop.
    const schedule = route.schedule[round] || (round >= 17 ? ["routine-rest", routeId === "study" ? "routine-record" : "routine-social"] : [route.job]);
    for (const id of schedule) dispatch({ type: "LIFE_ACTION", id });
    if (engine.getState().currentLife.actionPoints > 0) dispatch({ type: "END_LIFE_ACTIONS" });
    const life = dispatch({ type: "EVENT_ACTION", id: route.events[round] });
    transcript.push({ age: life.age, work: schedule, event: route.events[round], energy: life.resources.energy, money: life.resources.money, debt: life.cashflow.debt, skills: life.skills });
    if (life.lastAction.test) assert.equal(life.lastAction.test.success, true, "The planned skill preparation passes the route test");

    const next = content.rounds[round + 1];
    if (!next || next.stage !== content.rounds[round].stage) {
      const goalId = routeId + ":" + content.rounds[round].stage;
      const item = life.strategy.goals[goalId];
      assert.equal(item && item.status, "achieved", JSON.stringify({ routeId, age: life.age, goal: strategy.getGoals(life).goals.find(goal => goal.id === goalId), transcript }));
    }
    dispatch({ type: "ADVANCE_ROUND" });
  }

  const life = engine.getState().currentLife;
  assert.equal(life.status, "complete");
  assert.equal(life.age, 75);
  assert.equal(life.actions.length, 23);
  assert.equal(life.strategy.consequences.filter(item => item.id === route.consequenceId && item.success).length, 1);
  const achieved = strategy.getAllGoals(life).filter(item => item.routeId === routeId && item.completed);
  assert.equal(achieved.length, 5);
  assert.equal(life.outcome.routeId, routeId);
  assert.equal(life.outcome.achievedGoalIds.length, 5);
  assert.equal(life.cashflow.debt, 0, "The route also pays its ordinary living costs");
  assert.ok(life.resources.health > 0, "The route preserves health");
  assert.ok(life.resources.pressure < 8, "Later-life recovery also contains pressure");
  assert.equal(new Set(life.strategy.evidence.map(item => item.round + ":" + item.kind + ":" + item.id)).size, life.strategy.evidence.length);
  return { routeId, executed, initial: { profileId: initial.profileId, talents: initial.build.talentIds, attributes: initial.build.attributes }, goals: achieved.map(item => item.id), consequenceId: route.consequenceId, ending: life.outcome, finalResources: life.resources, cashflow: life.cashflow, transcript, game: { engine, strategy, content } };
}

if (require.main === module) for (const routeId of Object.keys(ROUTES)) {
  test("natural full-life " + routeId + ": all five stage goals and route chain", () => {
    const result = runRoute(routeId);
    console.log(JSON.stringify({ routeId, executed: result.executed, goalCount: result.goals.length, consequence: result.consequenceId, money: result.finalResources.money, debt: result.cashflow.debt, health: result.finalResources.health, energy: result.finalResources.energy, pressure: result.finalResources.pressure, score: result.ending.score }));
  });
}

module.exports = { ROUTES, runRoute, loadGame };
