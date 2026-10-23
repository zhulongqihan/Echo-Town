"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development/game/content.js"))) {
  const parent = path.dirname(ROOT);
  if (parent === ROOT) throw new Error("Cannot locate the Echo Town repository root");
  ROOT = parent;
}
const { loadGame } = require(path.join(ROOT, "development/tests/natural-routes.test.js"));

function command(game, request) {
  const result = game.engine.dispatch(request);
  assert.equal(result.ok, true, JSON.stringify({ request, error: result.error }));
  return result.state;
}

for (const id of ["shop-shift", "tutor-shift", "market-shift", "courier-shift", "night-shift", "town-job"]) {
  test("one " + id + " uses both action points; the second command cannot change progress or accounts", () => {
    const game = loadGame();
    command(game, { type: "SET_PRESET", routeId: "study" });
    command(game, { type: "START_LIFE" });
    const fixture = game.engine.getState();
    const life = fixture.currentLife;
    // Deliberate precondition fixture: every job is unlocked, affordable and
    // available at age 32, so a refusal can only come from the spent AP budget.
    life.round = game.content.rounds.findIndex(round => round.age === 32);
    life.age = 32;
    life.actionPoints = 2;
    life.sideActionsUsed = 0;
    life.opportunity = { drawnIds: [], selectedId: null, skipped: true, history: [] };
    Object.assign(life.resources, { energy: 10, health: 10, money: 30, pressure: 1 });
    Object.assign(life.skills, { craft: 5, study: 5, expression: 5, empathy: 5 });
    game.engine.replaceState(fixture);
    const before = game.engine.getState();
    const job = game.content.jobs.find(job => job.id === id);
    assert.equal(job.points, 2);
    assert.equal(game.engine.previewAction({ type: "LIFE_ACTION", id }).available, true);

    const first = command(game, { type: "LIFE_ACTION", id });
    assert.equal(first.currentLife.actionPoints, 0);
    assert.equal(first.currentLife.sideActionsUsed, 1);
    assert.equal(first.currentLife.jobShifts, before.currentLife.jobShifts + 1);
    assert.equal(first.currentLife.resources.money - before.currentLife.resources.money, job.effect.resources.money);
    assert.equal(first.currentLife.ledger.totals.income - before.currentLife.ledger.totals.income, job.effect.resources.money);
    assert.equal(first.currentLife.strategy.evidence.filter(entry => entry.kind === "job" && entry.id === id && entry.round === life.round).length, 1);
    const stateAfterFirst = JSON.stringify(first);
    const goalsAfterFirst = JSON.stringify(game.strategy.getAllGoals(first.currentLife));

    assert.equal(game.engine.previewAction({ type: "LIFE_ACTION", id }).available, false);
    assert.equal(game.engine.dispatch({ type: "LIFE_ACTION", id }).ok, false);
    assert.equal(JSON.stringify(game.engine.getState()), stateAfterFirst, "Rejected work leaves all resources, evidence, ledger and world totals unchanged");
    assert.equal(JSON.stringify(game.strategy.getAllGoals(game.engine.getState().currentLife)), goalsAfterFirst);

    game.engine.replaceState(JSON.parse(stateAfterFirst));
    assert.equal(game.engine.getState().currentLife.actionPoints, 0, "Reload does not restore spent action points");
    assert.equal(game.engine.dispatch({ type: "LIFE_ACTION", id }).ok, false);
    assert.equal(JSON.stringify(game.engine.getState()), stateAfterFirst, "A retry after reload still cannot collect a second wage");
  });
}
