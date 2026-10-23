"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ROUTES, loadGame, runRoute } = require("./natural-routes.test.js");

function send(game, command) {
  const result = game.engine.dispatch(command);
  assert.equal(result.ok, true, JSON.stringify({ age: game.engine.getState().currentLife?.age, command, error: result.error }));
  return game.engine.getState().currentLife;
}

function start(game, routeId = "study") {
  send(game, { type: "SET_PRESET", routeId });
  return send(game, { type: "START_LIFE" });
}

function eventPhase(game) {
  const life = game.engine.getState().currentLife;
  if (!life.opportunity.selectedId && !life.opportunity.skipped) send(game, { type: "SKIP_OPPORTUNITY" });
  if (game.engine.getState().currentLife.actionPoints > 0) send(game, { type: "END_LIFE_ACTIONS" });
}

function conservativeRound(game) {
  const life = game.engine.getState().currentLife;
  eventPhase(game);
  send(game, { type: "EVENT_ACTION", id: "steady-" + game.content.rounds[life.round].id });
  return send(game, { type: "ADVANCE_ROUND" });
}

// Only the six outcome-branch tests use controlled fixtures. They exercise the
// real command, affordability, deterministic test, evidence and consequence
// pipeline. Natural playthroughs and all other scenarios use ordinary commands.
function controlledPosition(game, round, testSkill, success) {
  const state = game.engine.getState();
  const life = state.currentLife;
  life.round = round;
  life.age = game.content.rounds[round].age;
  life.actionPoints = 2;
  life.lastAction = null;
  Object.assign(life.resources, { money: 100, energy: 10, health: 10, pressure: 2 });
  life.opportunity = { drawnIds: [], selectedId: null, skipped: true, history: [] };
  if (testSkill) life.skills[testSkill] = success ? 10 : testSkill === "craft" && life.age === 36 ? 4 : 0;
  game.engine.replaceState(state);
}

for (const routeId of ["craft", "study", "community"]) {
  for (const success of [true, false]) {
    test("actual chain outcome " + routeId + " / " + (success ? "success" : "failure"), () => {
      const game = loadGame();
      start(game, routeId);
      const chain = game.content.strategy.chains.find(item => item.routeId === routeId);
      for (const id of chain.actionIds) {
        const round = game.content.rounds.findIndex(item => item.actions.some(action => action.id === id));
        const action = game.content.rounds[round].actions.find(item => item.id === id);
        controlledPosition(game, round, action.test?.skill, success);
        eventPhase(game);
        const life = send(game, { type: "EVENT_ACTION", id });
        if (action.test) assert.equal(life.lastAction.test.success, success);
      }
      const life = game.engine.getState().currentLife;
      assert.equal(life.strategy.evidence.filter(item => chain.actionIds.includes(item.id)).length, 3);
      assert.equal(life.strategy.consequences.length, 1);
      assert.equal(life.strategy.consequences[0].success, success);
      const visible = game.strategy.getConsequences(life);
      assert.equal(visible[0].routeId, routeId);
      assert.ok(visible[0].copy.length > 10);

      const before = JSON.stringify(life);
      const duplicate = game.strategy.record(life, { id: chain.actionIds[2], kind: "event", round: life.round, success: !success });
      assert.equal(duplicate.recorded, false, "A replay cannot change the recorded outcome");
      assert.equal(JSON.stringify(life), before);
      assert.equal(game.strategy.requirementMet(life, { type: "evidence", ids: [chain.actionIds[2]], kind: "event" }), success);
      assert.equal(game.strategy.requirementMet(life, { type: "evidence", ids: [chain.actionIds[1]], kind: "event", success: null }), true, "Failed middle attempts remain valid continuation evidence");
    });
  }
}

test("stage completion survives duplicate settlement, route switching and reload", () => {
  const game = loadGame();
  start(game, "craft");
  for (let round = 0; round < 4; round += 1) {
    send(game, { type: "SKIP_OPPORTUNITY" });
    for (const id of ROUTES.craft.schedule[round]) send(game, { type: "LIFE_ACTION", id });
    eventPhase(game);
    send(game, { type: "EVENT_ACTION", id: ROUTES.craft.events[round] });
    if (round < 3) send(game, { type: "ADVANCE_ROUND" });
  }
  const state = game.engine.getState();
  const life = state.currentLife;
  assert.equal(life.strategy.goals["craft:childhood"].status, "achieved");
  assert.equal(Object.keys(life.strategy.goals).length, 3);
  const snapshot = JSON.stringify(life);
  assert.equal(game.strategy.settleStage(life).length, 0);
  assert.equal(game.strategy.settleStage(life).length, 0);
  assert.equal(JSON.stringify(life), snapshot);
  assert.equal(game.engine.dispatch({ type: "EVENT_ACTION", id: ROUTES.craft.events[3] }).ok, false);
  assert.equal(JSON.stringify(game.engine.getState()), JSON.stringify(state));

  send(game, { type: "SET_ROUTE", routeId: "study" });
  const before = game.engine.getState();
  game.engine.replaceState(JSON.parse(JSON.stringify(before)));
  const restored = game.engine.getState();
  assert.deepEqual(restored.currentLife.strategy.goals, before.currentLife.strategy.goals);
  assert.deepEqual(restored.currentLife.resources, before.currentLife.resources);
  send(game, { type: "ADVANCE_ROUND" });
  const next = game.engine.getState();
  assert.equal(game.engine.dispatch({ type: "ADVANCE_ROUND" }).ok, false);
  assert.equal(JSON.stringify(game.engine.getState()), JSON.stringify(next));
});

test("turning toward community after age 50 does not award earlier stages", () => {
  const game = loadGame();
  start(game, "study");
  while (game.engine.getState().currentLife.age < 52) conservativeRound(game);
  const previous = JSON.stringify(game.engine.getState().currentLife.strategy.goals);
  assert.equal(Object.values(game.engine.getState().currentLife.strategy.goals).filter(item => item.status === "achieved").length, 0);
  send(game, { type: "SET_ROUTE", routeId: "community" });
  assert.equal(JSON.stringify(game.engine.getState().currentLife.strategy.goals), previous);

  const events = ["steady-later-restart", "steady-later-memory", "invite-town-alumni", "give-away-tools", "call-family", "handoff-community"];
  for (let index = 0; index < events.length; index += 1) {
    send(game, { type: "SKIP_OPPORTUNITY" });
    const actions = index < 3 ? ["routine-care", "routine-social"] : ["routine-social", "routine-rest"];
    for (const id of actions) send(game, { type: "LIFE_ACTION", id });
    eventPhase(game);
    send(game, { type: "EVENT_ACTION", id: events[index] });
    send(game, { type: "ADVANCE_ROUND" });
  }
  const life = game.engine.getState().currentLife;
  assert.equal(life.status, "complete");
  assert.equal(life.strategy.goals["community:later"].status, "achieved");
  const old = Object.fromEntries(Object.entries(life.strategy.goals).filter(([id]) => !id.endsWith(":later")));
  assert.equal(JSON.stringify(old), previous);
});

test("repeating study can build a skill but cannot manufacture a career or all five goals", () => {
  const game = loadGame();
  start(game, "study");
  for (const round of game.content.rounds) {
    send(game, { type: "SKIP_OPPORTUNITY" });
    while (game.engine.getState().currentLife.actionPoints > 0) {
      const command = { type: "LIFE_ACTION", id: "routine-study" };
      if (!game.engine.previewAction(command).available) break;
      send(game, command);
    }
    eventPhase(game);
    send(game, { type: "EVENT_ACTION", id: "steady-" + round.id });
    send(game, { type: "ADVANCE_ROUND" });
  }
  const life = game.engine.getState().currentLife;
  assert.equal(life.status, "complete");
  assert.equal(life.skills.study, 10);
  assert.equal(life.strategy.goals["study:childhood"].status, "achieved");
  assert.equal(game.strategy.getAllGoals(life).filter(item => item.routeId === "study" && item.completed).length, 1);
  assert.equal(game.strategy.getWishStatus(life).completed, false, "Mere repetition is not a livelihood");
});

test("earned tools, notebook and letter open usable choices in the next life", () => {
  const first = runRoute("study");
  const game = first.game;
  const legacyIds = ["small-tool", "study-notebook", "friend-letter"];
  for (const id of legacyIds) {
    assert.ok(game.engine.getState().currentLife.legacyCandidates.includes(id), "Earned legacy is selectable: " + id);
    send(game, { type: "TOGGLE_LEGACY", id });
  }
  send(game, { type: "CONFIRM_LEGACIES" });
  const life = send(game, { type: "START_LIFE" });
  assert.equal(life.generation, 2);
  for (const id of legacyIds) assert.ok(life.inheritedLegacyIds.includes(id));

  const unlocked = [];
  while (game.engine.getState().currentLife.age <= 32) {
    const current = game.engine.getState().currentLife;
    const round = game.content.rounds[current.round];
    const action = round.actions.find(item => item.strategy?.legacyId && legacyIds.includes(item.strategy.legacyId));
    eventPhase(game);
    if (action) {
      const preview = game.engine.previewAction({ type: "EVENT_ACTION", id: action.id });
      assert.equal(preview.available, true, "Inherited option can really be chosen: " + action.id);
      const after = send(game, { type: "EVENT_ACTION", id: action.id });
      assert.ok(after.strategy.evidence.some(item => item.id === action.id && item.success));
      unlocked.push(action.strategy.legacyId);
    } else if (current.age === 21) {
      send(game, { type: "EVENT_ACTION", id: "chain-study-trial" });
      assert.ok(game.engine.getState().currentLife.strategy.evidence.some(item => item.id === "chain-study-trial" && item.success), "The inherited notebook also substitutes for the study-chain opening");
    } else send(game, { type: "EVENT_ACTION", id: "steady-" + round.id });
    if (current.age === 32) break;
    send(game, { type: "ADVANCE_ROUND" });
  }
  assert.equal(unlocked.slice().sort().join(","), legacyIds.slice().sort().join(","));
  const fresh = loadGame();
  start(fresh, "study");
  for (const id of legacyIds) assert.equal(fresh.strategy.requirementMet(fresh.engine.getState().currentLife, { type: "legacy", id }), false);
});
