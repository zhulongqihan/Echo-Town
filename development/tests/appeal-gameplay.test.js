"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development/game/content.js"))) ROOT = path.dirname(ROOT);
const { ROUTES } = require(path.join(ROOT, "development/tests/natural-routes.test.js"));

function runtime(routeId = "craft") {
  const box = { console, Date, TextEncoder, Blob }; box.window = box; vm.createContext(box);
  for (const file of ["content.js", "strategy.js", "projects.js", "journey.js", "save.js", "engine.js"]) {
    const filePath = path.join(ROOT, "development/game", file);
    vm.runInContext(fs.readFileSync(filePath, "utf8"), box, { filename: file });
  }
  const e = box.EchoTownEngine;
  const send = (type, extra = {}) => {
    const result = e.dispatch({ type, ...extra });
    assert.equal(result.ok, true, JSON.stringify({ age: e.getState().currentLife?.age, type, extra, error: result.error }));
    return e.getState().currentLife;
  };
  send("SET_PRESET", { routeId }); send("START_LIFE");
  const life = () => e.getState().currentLife;
  const node = (schedule, id, advance = true) => {
    send("SKIP_OPPORTUNITY");
    for (const actionId of schedule) send("LIFE_ACTION", { id: actionId });
    if (life().actionPoints) send("END_LIFE_ACTIONS");
    send("EVENT_ACTION", { id });
    if (advance) send("ADVANCE_ROUND");
  };
  return { e, send, life, node, strategy: box.EchoTownStrategy, content: box.EchoTownContent, save: box.EchoTownSave };
}

test("content polish keeps the challenge rules label compatible with existing challenge exports", () => {
  const { e, save } = runtime();
  const definition = e.getChallengeDefinitions()[0];
  assert.equal(definition.rulesVersion, "6.2.0");
  const payload = save.serializeSlot(definition.id, e.createChallengeState(definition.id));
  assert.equal(JSON.parse(payload).rulesVersion, definition.rulesVersion);
  assert.equal(save.prepareSlotImport(definition.id, payload).ok, true);
});

test("future pursuit uses the already determined smaller recovery after a real failed trial", () => {
  const { e, save } = runtime();
  const raw = fs.readFileSync(path.join(ROOT, "development/tests/fixtures/appeal-variant-failure-v9.json"), "utf8");
  const prepared = save.prepareImport(raw);
  assert.equal(prepared.ok, true);
  const state = JSON.parse(raw);
  const before = JSON.stringify(state);
  const pursuit = e.getNextPursuit(state.currentLife);
  assert.equal(pursuit.age, 36);
  assert.equal(pursuit.actionId, "chain-craft-workshop");
  assert.equal(pursuit.label, "先用小单补完旧维修单");
  assert.equal(pursuit.reserveEnergy, 2);
  assert.ok(pursuit.checks.some(item => item.label.includes("小单返修检定") && item.label.includes("/ 6")));
  assert.equal(JSON.stringify(state), before, "Future projection cannot rewrite the real failed trial or any saved result");
});

test("natural craft: the early cap leads to useful choices and fresh 8/10/11/13-year pursuits", () => {
  const { e, send, life } = runtime();
  send("OPPORTUNITY", { id: "repair-bench" });
  send("LIFE_ACTION", { id: "routine-study" }); send("LIFE_ACTION", { id: "routine-rest" });
  send("EVENT_ACTION", { id: "fix-radio" });
  assert.equal(e.getStageGoals(life()).goals.find(item => item.routeId === "craft").status, "ready");
  assert.equal(e.getNextPursuit().actionId, "share-notes");
  send("ADVANCE_ROUND"); send("SKIP_OPPORTUNITY"); send("LIFE_ACTION", { id: "routine-study" });
  assert.equal(life().skills.craft, 4); assert.equal(life().skills.study, 4);
  const recs = e.getLifeRecommendations();
  assert.ok(recs.length > 0);
  assert.ok(recs.every(item => !["routine-study", "routine-repair"].includes(item.id)));
  assert.ok(recs.some(item => item.id === "routine-care"));
  const oldEmpathy = life().skills.empathy;
  send("LIFE_ACTION", { id: "routine-care" });
  assert.equal(life().skills.empathy, oldEmpathy + 1);
  send("EVENT_ACTION", { id: "share-notes" });
  assert.equal(e.getNextPursuit().actionId, "rest-at-home");
  send("ADVANCE_ROUND"); send("SKIP_OPPORTUNITY"); send("END_LIFE_ACTIONS"); send("EVENT_ACTION", { id: "rest-at-home" });
  assert.equal(e.getNextPursuit().actionId, "repair-lantern");
  send("ADVANCE_ROUND"); send("SKIP_OPPORTUNITY"); send("END_LIFE_ACTIONS");
  const neighbor = life().relationships.neighbor;
  send("EVENT_ACTION", { id: "repair-lantern" });
  assert.equal(life().relationships.neighbor, neighbor + 1, "The next pursuit has an actual world/relationship consequence even at the craft cap");
  assert.equal(e.getNextPursuit().actionId, "chain-craft-promise");
  assert.equal(e.getAllStageGoals(life()).length, 15);
});

for (const routeId of ["study", "community"]) test("natural " + routeId + ": each completed childhood choice hands off to an unplayed one", () => {
  const app = runtime(routeId);
  const expected = routeId === "study" ? ["front-seat", "rest-at-home", "tell-story", "chain-study-plan"] : ["share-notes", "ask-for-help", "invite-shy-child", "comfort-friend"];
  for (let round = 0; round < 4; round++) {
    const schedule = round === 0 && routeId === "study" ? ["routine-study", "routine-rest"] : ["routine-rest"];
    app.node(schedule, ROUTES[routeId].events[round], false);
    const pursuit = app.e.getNextPursuit();
    assert.equal(pursuit.actionId, expected[round]);
    assert.ok(pursuit.round > round);
    app.send("ADVANCE_ROUND");
  }
});

test("capped study remains useful for a missing real study record, once per node, then leaves recommendations", () => {
  const app = runtime("study");
  app.send("SKIP_OPPORTUNITY"); app.send("LIFE_ACTION", { id: "routine-study" });
  assert.ok(app.life().skills.study >= 4, "The study preset may already be above the childhood cap; it is preserved");
  assert.equal(app.e.getLifeRecommendations().some(item => item.id === "routine-study"), false, "A second study in the same node is not a second evidence node");
  app.send("END_LIFE_ACTIONS"); app.send("EVENT_ACTION", { id: "read-comic" }); app.send("ADVANCE_ROUND"); app.send("SKIP_OPPORTUNITY");
  const recommendation = app.e.getLifeRecommendations().find(item => item.id === "routine-study");
  assert.ok(recommendation); assert.equal(recommendation.preview.benefits.length, 0);
  assert.match(recommendation.reason, /真实行动/);
  app.send("LIFE_ACTION", { id: "routine-study" });
  assert.equal(app.e.getStageGoals(app.life()).goals.find(item => item.routeId === "study").status, "ready");
  assert.equal(app.e.getLifeRecommendations().some(item => item.id === "routine-study"), false);
});

test("growth notices distinguish partial gains, inherited over-cap skills and the next actual growth stage", () => {
  const { e, send } = runtime(); send("SKIP_OPPORTUNITY");
  const saved = e.getState(); saved.currentLife.skills.study = 3; saved.currentLife.inventory.push("study-notebook"); e.replaceState(saved);
  let preview = e.previewAction({ type: "LIFE_ACTION", id: "routine-study" });
  assert.equal(preview.growth[0].requested, 2); assert.equal(preview.growth[0].applied, 1);
  assert.match(preview.notices[0], /本次只能增加 1/);
  const inherited = e.getState(); inherited.currentLife.skills.study = 7; e.replaceState(inherited);
  preview = e.previewAction({ type: "LIFE_ACTION", id: "routine-study" });
  assert.equal(preview.growth[0].applied, 0); assert.equal(preview.growth[0].nextAge, 19); assert.equal(preview.growth[0].nextCap, 8);
  assert.match(preview.notices[0], /现有 7 保留不变/);
  send("LIFE_ACTION", { id: "routine-study" }); assert.equal(e.getState().currentLife.skills.study, 7);
});

for (const routeId of ["craft", "study"]) test("natural " + routeId + " project: capped preparation is recommended for its real receipt, then stops", () => {
  const app = runtime(routeId);
  for (let round = 0; round < 7; round++) {
    if (routeId === "craft" && round === 1) {
      app.send("SKIP_OPPORTUNITY"); app.send("BUY_ITEM", { id: "toolkit" }); app.send("LIFE_ACTION", { id: "routine-rest" });
      app.send("EVENT_ACTION", { id: ROUTES[routeId].events[round] }); app.send("ADVANCE_ROUND");
    } else app.node(ROUTES[routeId].schedule[round] || [ROUTES[routeId].job], ROUTES[routeId].events[round]);
  }
  app.send("ACCEPT_PROJECT", { id: routeId === "craft" ? "craft-customers-youth-v1" : "study-practice-youth-v1" });
  app.node([ROUTES[routeId].job], "city-library"); app.send("SKIP_OPPORTUNITY");
  assert.equal(app.life().skills[routeId], 8, "The normal route and owned equipment reach the youth cap without fixtures");
  const id = routeId === "craft" ? "routine-repair" : "routine-study";
  const recommendation = app.e.getLifeRecommendations().find(item => item.id === id);
  assert.ok(recommendation); assert.equal(recommendation.preview.benefits.length, 0); assert.match(recommendation.reason, /完成项目这一步/);
  const before = app.life().resources.energy;
  app.send("LIFE_ACTION", { id });
  assert.equal(app.life().resources.energy, before - 2);
  assert.equal(app.life().projects.current.steps.preparation.actionId, id);
  assert.equal(app.e.getLifeRecommendations().some(item => item.id === id), false);
});

test("recommendations keep relationship benefits when the action's skill is capped", () => {
  const app = runtime("community");
  app.node(["routine-rest"], "yard-play"); app.send("SKIP_OPPORTUNITY"); app.send("LIFE_ACTION", { id: "routine-care" });
  const preview = app.e.previewAction({ type: "LIFE_ACTION", id: "routine-care" });
  assert.equal(preview.growth[0].applied, 0);
  assert.ok(preview.benefits.some(item => item.path === "relationships.family"));
  assert.ok(app.e.getLifeRecommendations().some(item => item.id === "routine-care"));
});

test("recommendation previews and execution share actual deltas; reads never mutate resources, goals, evidence or setup", () => {
  const app = runtime(); app.send("SKIP_OPPORTUNITY");
  const saved = app.e.getState(), before = JSON.stringify(saved), setup = JSON.stringify(app.e.getSetup());
  for (let index = 0; index < 4; index++) { app.e.getNextPursuit(); app.e.getLifeRecommendations(); }
  assert.equal(JSON.stringify(app.e.getState()), before); assert.equal(JSON.stringify(app.e.getSetup()), setup);
  for (const item of app.e.getLifeRecommendations()) {
    const old = app.life(); app.send(item.command.type, { id: item.command.id }); const current = app.life();
    for (const benefit of item.preview.benefits) {
      const [group, key] = benefit.path.split("."); assert.equal(current[group][key] - old[group][key], benefit.delta, item.id + ":" + benefit.path);
    }
    assert.equal(current.resources.energy, item.preview.remaining.energy); assert.equal(current.actionPoints, item.preview.remaining.actionPoints);
    app.e.replaceState(saved);
  }
});

test("no useful benefits and no missing proof means no promoted training; ending life returns no next pursuit", () => {
  const app = runtime("craft"); app.send("SKIP_OPPORTUNITY");
  const state = app.e.getState(); const life = state.currentLife;
  Object.keys(life.skills).forEach(key => { life.skills[key] = 10; });
  Object.keys(life.relationships).forEach(key => { life.relationships[key] = 10; });
  life.resources.energy = life.maxResources.energy; life.resources.health = 10; life.resources.happiness = 10; life.resources.pressure = 0; life.resources.expectation = 0;
  app.e.replaceState(state);
  assert.equal(app.e.getLifeRecommendations().length, 0);
  assert.equal(app.e.getNextPursuit({ ...app.life(), status: "complete" }), null);
});

test("legacy-settled records and old flags are never turned into new evidence by guidance", () => {
  const app = runtime("craft"); app.send("SKIP_OPPORTUNITY");
  const state = app.e.getState(); state.currentLife.strategy.goals["craft:childhood"] = { status: "legacy-settled", round: 0, checks: [] }; state.currentLife.flags.push("radio", "festival-lantern");
  app.e.replaceState(state); const before = JSON.stringify(app.e.getState());
  assert.equal(app.e.getNextPursuit().actionId, "fix-radio", "Old flags do not assert that an actual event was selected");
  app.e.getLifeRecommendations();
  assert.equal(JSON.stringify(app.e.getState()), before);
  assert.equal(app.life().strategy.goals["craft:childhood"].status, "legacy-settled");
  assert.equal(app.life().strategy.evidence.length, 0);
});
