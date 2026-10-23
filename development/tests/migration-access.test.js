"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

function game() {
  let writes = 0;
  const window = { console, Date, TextEncoder, Blob, setTimeout, clearTimeout,
    localStorage: { getItem() { return null; }, setItem() { writes += 1; }, removeItem() { writes += 1; } } };
  window.window = window;
  vm.createContext(window);

  for (const name of ["content.js", "strategy.js", "projects.js", "save.js", "engine.js"]) {
    let source = fs.readFileSync(path.join(ROOT, "development/game", name), "utf8");

    if (name === "engine.js") source = source.replace("  global.EchoTownEngine =", "  global.__migrationProof = proveMigrationGoals;\n  global.EchoTownEngine =");
    vm.runInContext(source, window, { filename: name });
  }
  return { engine: window.EchoTownEngine, strategy: window.EchoTownStrategy, save: window.EchoTownSave, content: window.EchoTownContent, prove: window.__migrationProof, writes: () => writes };
}

function dispatch(runtime, command) {
  const result = runtime.engine.dispatch(command);
  assert.equal(result.ok, true, JSON.stringify({ command, error: result.error }));
  return result.state;
}

function fixture(runtime, round, ap, options = {}) {
  dispatch(runtime, { type: "SET_PRESET", routeId: options.routeId || "study" });
  dispatch(runtime, { type: "START_LIFE" });
  const source = runtime.engine.getState();
  const life = source.currentLife;
  life.round = round;
  life.age = runtime.content.rounds[round].age;
  life.actionPoints = ap;
  life.resources.energy = options.energy ?? 8;
  life.resources.money = 80;
  if (options.skills) Object.assign(life.skills, options.skills);
  life.opportunity = options.unselected
    ? { drawnIds: ["borrowed-book", "red-envelope"], selectedId: null, skipped: false, history: [] }
    : { drawnIds: [], selectedId: null, skipped: true, history: [] };
  if (options.flags) life.flags.push(...options.flags);
  runtime.engine.replaceState(source);
  if (options.feedback) {
    if (ap > 0) dispatch(runtime, { type: "END_LIFE_ACTIONS" });
    dispatch(runtime, { type: "EVENT_ACTION", id: "steady-" + runtime.content.rounds[round].id });
  }
  const old = runtime.engine.getState();
  old.version = 7;
  delete old.currentLife.strategy;
  delete old.currentLife.ledger;
  delete old.currentLife.projects;
  delete old.currentLife.migration;
  return old;
}

function preserveOperation(before, after) {
  const keep = ["round", "age", "resources", "skills", "relationships", "actionPoints", "opportunity", "lastAction", "selectedLegacies", "outcome", "seed", "cashflow", "actions", "lifeLog", "flags"];
  for (const key of keep) assert.equal(JSON.stringify(after.currentLife[key]), JSON.stringify(before.currentLife[key]), "Migration preserves " + key);
  assert.equal(JSON.stringify(after.world), JSON.stringify(before.world), "Migration does not rewrite history or totals");
}

test("early v7 migration connects provably achievable goals without making any move", () => {
  for (const routeId of ["craft", "study", "community"]) {
    const runtime = game();
    const old = fixture(runtime, 0, 2, { routeId, unselected: true });
    const migrated = runtime.engine.replaceState(old);
    preserveOperation(old, migrated);
    assert.ok(migrated.currentLife.migration.activeGoalIds.includes(routeId + ":childhood"));
    assert.equal(migrated.currentLife.strategy.evidence.length, 0, "Only future real play may create evidence");
    assert.equal(migrated.currentLife.strategy.goals[routeId + ":childhood"], undefined);
    assert.equal(runtime.writes(), 0, "Projection has no persistence side effect");
  }
});

test("stage end AP 0/1/2 and zero energy have different actual remaining possibilities", () => {
  for (const [ap, energy, craft] of [[0, 0, false], [1, 0, true], [2, 0, true], [0, 2, true]]) {
    const runtime = game();
    const old = fixture(runtime, 3, ap, { routeId: "craft", energy, skills: { craft: 1, study: 9 }, flags: ["front-seat", "radio"] });
    const migrated = runtime.engine.replaceState(old);
    const ids = migrated.currentLife.migration.activeGoalIds;
    assert.equal(ids.includes("craft:childhood"), craft, JSON.stringify({ ap, energy, ids }));
    assert.equal(ids.includes("study:childhood"), false, "Old front-seat flag and skill alone cannot supply missing proof");
    assert.equal(migrated.currentLife.strategy.goals["study:childhood"].status, "legacy-settled");
    preserveOperation(old, migrated);
  }
});

test("a current-stage feedback is never replayed; only genuinely remaining nodes count", () => {
  for (const round of [1, 2, 3]) {
    const runtime = game();
    const old = fixture(runtime, round, 0, { feedback: true, skills: { study: 5 } });
    const migrated = runtime.engine.replaceState(old);
    assert.equal(migrated.currentLife.migration.activeGoalIds.includes("study:childhood"), round === 1);
    preserveOperation(old, migrated);
    assert.equal(migrated.currentLife.strategy.evidence.length, 0);
  }
});

test("mid-stage and later-stage migration freezes past results and uses only future jobs", () => {
  for (const [round, ap, expected] of [[4, 2, true], [5, 2, true], [6, 2, true], [6, 1, false], [10, 2, false]]) {
    const runtime = game();
    const old = fixture(runtime, round, ap, { routeId: "craft", skills: { craft: 7 } });
    const migrated = runtime.engine.replaceState(old);
    const stage = runtime.content.rounds[round].stage;
    assert.equal(migrated.currentLife.migration.activeGoalIds.includes("craft:" + stage), expected);
    for (const route of ["craft", "study", "community"]) assert.equal(migrated.currentLife.strategy.goals[route + ":childhood"].status, "legacy-settled");
    preserveOperation(old, migrated);
  }
});

test("every accepted goal has a replayable ordinary-command witness, independent of roll", () => {
  for (const round of [0, 2, 6, 7, 11, 16, 17, 22]) {
    const runtime = game();
    const old = fixture(runtime, round, 2, { skills: { craft: 7, study: 7, empathy: 6, expression: 5 } });
    const prepared = runtime.save.prepareImport(JSON.stringify(old));
    assert.equal(prepared.ok, true);
    const before = JSON.stringify(runtime.engine.getState());
    const proof = runtime.prove(prepared.state);
    assert.equal(JSON.stringify(runtime.engine.getState()), before, "Even a proof query restores the current live state exactly");
    for (const id of proof.activeGoalIds) {
      runtime.engine.replaceState(old);
      for (const command of proof.witnesses[id]) {
        if (command.type === "EVENT_ACTION") {
          const current = runtime.engine.getState().currentLife;
          const source = runtime.content.rounds[current.round].actions.find(action => action.id === command.id);
          if (source.test) {
            const preview = runtime.engine.previewAction(command);
            assert.ok(preview.test.minimum >= preview.test.difficulty, "Any future test has a guaranteed result before its base effects");
          }
        }
        dispatch(runtime, command);
      }
      assert.equal(runtime.engine.getState().currentLife.strategy.goals[id].status, "achieved", id);
    }
    assert.equal(runtime.writes(), 0);
  }
});

test("a well-prepared middle-age craft migration proves workshop, later work and living-cost reserve", () => {
  for (const seed of [0, 1, 9, 2147483647]) {
    const runtime = game();
    const old = fixture(runtime, 11, 2, { routeId: "craft", skills: { craft: 10 } });
    old.currentLife.seed = seed;
    const proof = runtime.prove(runtime.save.prepareImport(JSON.stringify(old)).state);
    assert.ok(proof.activeGoalIds.includes("craft:middle"), "Admission does not depend on the seed");
    const migrated = runtime.engine.replaceState(old);
    preserveOperation(old, migrated);
    let openingRound = -1;
    let laterWork = false;
    for (const command of proof.witnesses["craft:middle"]) {
      const life = runtime.engine.getState().currentLife;
      if (command.id === "open-workshop") {
        const preview = runtime.engine.previewAction(command);
        assert.ok(preview.test.minimum >= preview.test.difficulty);
        openingRound = life.round;
      }
      if (command.id === "shop-shift" && openingRound >= 0 && life.round > openingRound) laterWork = true;
      dispatch(runtime, command);
    }
    assert.equal(openingRound, 12);
    assert.equal(laterWork, true);
    const final = runtime.engine.getState().currentLife;
    assert.equal(final.strategy.goals["craft:middle"].status, "achieved");
    assert.ok(runtime.strategy.getGoals(final).goals.find(goal => goal.id === "craft:middle").conditions.every(item => item.met));
    assert.equal(runtime.writes(), 0);
  }
});

test("every preferred migration event ID exists in its actual node", () => {
  const helper = fs.readFileSync(path.join(ROOT, "development/game/engine.js"), "utf8").replace(/\r\n?/g, "\n");
  const start = helper.indexOf("    const preferred = ") + "    const preferred = ".length;
  const end = helper.indexOf(";\n", start);
  const preferred = vm.runInNewContext("(" + helper.slice(start, end) + ")");
  const runtime = game();
  for (const [routeId, events] of Object.entries(preferred)) for (const [round, id] of Object.entries(events)) {
    assert.ok(runtime.content.rounds[Number(round)].actions.some(action => action.id === id), routeId + " " + round + " " + id);
  }
});

test("75-year final feedback and completed endings never receive new stage grading", () => {
  const runtime = game();
  const old = fixture(runtime, 22, 0, { feedback: true, skills: { craft: 9, study: 9, empathy: 9 } });
  const migrated = runtime.engine.replaceState(old);
  assert.equal(migrated.currentLife.migration.activeGoalIds.length, 0);
  assert.equal(Object.values(migrated.currentLife.strategy.goals).filter(goal => goal.status === "legacy-settled").length, 15);
  preserveOperation(old, migrated);
  dispatch(runtime, { type: "ADVANCE_ROUND" });
  const complete = runtime.engine.getState();
  complete.version = 7;
  delete complete.currentLife.strategy;
  delete complete.currentLife.migration;
  delete complete.currentLife.ledger;
  delete complete.currentLife.projects;
  delete complete.currentLife.outcome.achievedGoalIds;
  delete complete.currentLife.outcome.routeId;
  complete.currentLife.progress[complete.currentLife.goalId] = 99;
  const restored = runtime.engine.replaceState(complete);
  assert.equal(restored.currentLife.migration.activeGoalIds.length, 0);
  assert.equal(JSON.stringify(restored.currentLife.outcome), JSON.stringify(complete.currentLife.outcome));
  preserveOperation(complete, restored);
  assert.equal(runtime.engine.getWishStatus(restored.currentLife).completed, true, "An already settled old wish is not failed by the new evidence rules");
  assert.equal(runtime.engine.getWishStatus(restored.currentLife).legacy, true);
});

test("migration admission remains fixed across refresh, route switching and changed future resources", () => {
  const runtime = game();
  const old = fixture(runtime, 3, 0, { energy: 0, skills: { craft: 0 } });
  const migrated = runtime.engine.replaceState(old);
  const access = JSON.stringify(migrated.currentLife.migration);
  dispatch(runtime, { type: "SET_ROUTE", routeId: "craft" });
  const saved = runtime.engine.getState();
  saved.currentLife.resources.energy = 10;
  saved.currentLife.skills.craft = 10;
  runtime.engine.replaceState(saved);
  assert.equal(JSON.stringify(runtime.engine.getState().currentLife.migration), access);
  assert.equal(runtime.engine.getState().currentLife.strategy.goals["craft:childhood"].status, "legacy-settled");
  const invalid = runtime.engine.getState();
  invalid.currentLife.migration.activeGoalIds = ["craft:later"];
  assert.equal(runtime.save.prepareImport(JSON.stringify(invalid)).ok, false);
});
