"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development/game/content.js"))) ROOT = path.dirname(ROOT);
const GAME = path.join(ROOT, "development/game");
const clone = value => JSON.parse(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
function load() {
  const scope = { console, EchoTownEngine: { escapeHtml: value => String(value) } };
  scope.window = scope; vm.createContext(scope);
  for (const name of ["content", "strategy", "scene"]) {
    const file = path.join(GAME, name + ".js");
    vm.runInContext(fs.readFileSync(file, "utf8"), scope, { filename: file });
  }
  return { scope, content: scope.EchoTownContent, scene: scope.EchoTownScene };
}
function lifeAt(content, index, history = []) {
  return { generation: 1, round: index, age: content.rounds[index].age, opportunity: { drawnIds: [], selectedId: null, skipped: false, history } };
}

test("all 18 existing opportunity IDs have first/revisit/result copy while the event-option count stays 107", () => {
  const { content } = load();
  assert.equal(content.opportunities.length, 18);
  assert.equal(content.rounds.reduce((sum, round) => sum + round.actions.length, 0), 107);
  for (const item of content.opportunities) {
    for (const copy of [item, item.revisit]) for (const key of ["label", "detail", "result"]) {
      assert.equal(typeof copy[key], "string", item.id + "." + key);
      assert.ok(copy[key].length > 0 && copy[key].length <= 100, item.id + "." + key);
    }
    assert.notEqual(item.label, item.revisit.label, item.id);
    assert.notEqual(item.detail, item.revisit.detail, item.id);
    assert.notEqual(item.result, item.revisit.result, item.id);
  }
});

test("seeing or skipping an opportunity is not an accepted encounter", () => {
  const { content } = load(), item = content.opportunities.find(entry => entry.id === "repair-bench");
  const life = lifeAt(content, 1);
  life.opportunity.drawnIds = [item.id];
  assert.equal(content.getOpportunityCopy(item, life).repeated, false);
  life.opportunity.skipped = true;
  assert.equal(content.getOpportunityCopy(item, life).repeated, false);
  assert.equal(content.getOpportunityCopy(item, life).label, "后院多了一张工作台");
});

test("accepting the first book/workbench at this node cannot change its copy during repaint or reload", () => {
  const { content } = load();
  for (const id of ["borrowed-book", "repair-bench"]) {
    const item = content.opportunities.find(entry => entry.id === id), life = lifeAt(content, 0);
    const before = clone(content.getOpportunityCopy(item, life));
    life.opportunity.selectedId = id;
    life.opportunity.history.push({ age: life.age, id, label: before.label });
    assert.deepEqual(clone(content.getOpportunityCopy(item, life)), before);
    assert.deepEqual(clone(content.getOpportunityCopy(item, clone(life))), before);
    assert.equal(before.repeated, false);
  }
});

test("each opportunity uses revisit copy only after an earlier accepted occurrence in this life", () => {
  const { content } = load();
  for (const item of content.opportunities) {
    const firstIndex = content.rounds.findIndex(round => round.age >= (item.minAge || 0));
    const life = lifeAt(content, firstIndex + 1, [{ age: content.rounds[firstIndex].age, id: item.id, label: "旧版已保存标题" }]);
    const projection = content.getOpportunityCopy(item, life);
    assert.equal(projection.repeated, true, item.id);
    assert.equal(projection.label, item.revisit.label, item.id);
    assert.equal(projection.detail, item.revisit.detail, item.id);
    assert.equal(projection.result, item.revisit.result, item.id);
  }
});

test("the current accepted occurrence does not hide an earlier encounter or alter the revisit after repaint", () => {
  const { content } = load(), item = content.opportunities.find(entry => entry.id === "repair-bench");
  const life = lifeAt(content, 1, [{ age: 6, id: item.id, label: item.label }]);
  const before = clone(content.getOpportunityCopy(item, life));
  life.opportunity.selectedId = item.id;
  life.opportunity.history.push({ age: 8, id: item.id, label: before.label });
  assert.equal(before.repeated, true);
  assert.deepEqual(clone(content.getOpportunityCopy(item, freeze(life))), before);
});

test("other IDs, current/future ages and incomplete records do not manufacture a previous acceptance", () => {
  const { content } = load(), item = content.opportunities.find(entry => entry.id === "repair-bench");
  const history = [{ age: 6, id: "borrowed-book" }, { age: 8, id: item.id }, { age: 10, id: item.id }, { age: "6", id: item.id }, { age: 0, id: item.id }, { id: item.id }, null];
  const life = lifeAt(content, 1, history);
  assert.equal(content.getOpportunityCopy(item, life).repeated, false);
  history.push({ age: 6, id: item.id, label: "接受过" });
  assert.equal(content.getOpportunityCopy(item, life).repeated, true);
});

test("missing old-save opportunity history and inherited flags do not claim a prior encounter", () => {
  const { content } = load(), item = content.opportunities.find(entry => entry.id === "repair-bench");
  const life = lifeAt(content, 1);
  delete life.opportunity.history;
  life.flags = ["bench-invite", "legacy-tool", "legacy-shop-key"];
  life.inventory = ["toolkit"];
  life.generation = 2;
  assert.equal(content.getOpportunityCopy(item, life).repeated, false);
  delete life.opportunity;
  assert.equal(content.getOpportunityCopy(item, life).repeated, false);
  assert.equal(content.getOpportunityCopy(item, null).repeated, false);
  assert.equal(content.getOpportunityCopy(null, life), null);
});

test("old saved labels, result text and feedback remain byte-for-byte unchanged by the read-only projection", () => {
  const { content, scope } = load(), item = content.opportunities.find(entry => entry.id === "repair-bench");
  const life = lifeAt(content, 1, [{ age: 6, id: item.id, label: "旧工作台标题" }, { age: 8, id: item.id, label: "本节点旧标题" }]);
  life.opportunity.selectedId = item.id;
  life.opportunityFeedback = { title: "机会已接住：本节点旧标题", copy: "旧版实际反馈原文", changes: ["手艺 +1"] };
  life.lifeLog = [{ age: 6, label: "旧工作台标题", result: "旧版保存的经历", kind: "机会" }];
  life.seed = 277191004;
  const before = JSON.stringify(life), itemBefore = JSON.stringify(item);
  freeze(life); freeze(item);
  vm.runInContext("Math.random = () => { throw new Error('Projection must not consume randomness'); };", scope);
  const expected = clone(content.getOpportunityCopy(item, life));
  for (let index = 0; index < 20; index++) assert.deepEqual(clone(content.getOpportunityCopy(item, life)), expected);
  assert.equal(JSON.stringify(life), before);
  assert.equal(JSON.stringify(item), itemBefore);
});

test("a new life starts its own opportunity encounters even when the previous life accepted the same card", () => {
  const { content } = load(), item = content.opportunities.find(entry => entry.id === "repair-bench");
  const previous = lifeAt(content, 2, [{ age: 6, id: item.id, label: item.label }]);
  const next = lifeAt(content, 0);
  next.generation = 2; next.flags = ["legacy-tool"]; next.inventory = ["toolkit"];
  assert.equal(content.getOpportunityCopy(item, previous).repeated, true);
  assert.equal(content.getOpportunityCopy(item, next).repeated, false);
});

test("scene location matches each event illustration instead of the broader life stage", () => {
  const { content, scene } = load();
  const expected = {
    "childhood-school": ["scene-school.webp", "临河学校"],
    "childhood-festival": ["scene-festival.webp", "河岸灯会"],
    "youth-departure": ["scene-station.webp", "长河车站"],
    "middle-flood": ["scene-flood.webp", "暴雨中的河桥"],
    "later-farewell": ["scene-cinema.webp", "旧电影院"],
  };
  for (const [id, [image, place]] of Object.entries(expected)) {
    const round = content.rounds.find(entry => entry.id === id);
    assert.ok(content.media.eventArt[id].src.endsWith(image));
    assert.equal(scene.getScenePlace(freeze(round)), place);
  }
  const school = content.rounds.find(round => round.id === "childhood-school");
  assert.equal(school.stage, "childhood");
  assert.notEqual(scene.getScenePlace(school), "临河的老院子");
});

test("ordinary nodes retain stage places and unknown nodes have a safe town fallback", () => {
  const { content, scene } = load();
  for (const [stage, art] of Object.entries(content.media.stageArt)) {
    const round = content.rounds.find(entry => entry.stage === stage && !content.media.eventArt[entry.id]);
    assert.equal(scene.getScenePlace(round), art.place);
  }
  assert.equal(scene.getScenePlace({ id: "unknown", stage: "unknown" }), "回声镇");
  assert.equal(scene.getScenePlace(null), "回声镇");
});

function loadEngine() {
  const scope = { console, Date, TextEncoder, Blob, setTimeout, clearTimeout };
  scope.window = scope; vm.createContext(scope);
  for (const name of ["content", "strategy", "projects", "journey", "save", "engine"]) {
    const file = path.join(GAME, name + ".js");
    vm.runInContext(fs.readFileSync(file, "utf8"), scope, { filename: file });
  }
  const engine = scope.EchoTownEngine, content = scope.EchoTownContent, save = scope.EchoTownSave;
  const life = () => engine.getState().currentLife;
  const send = command => {
    const result = engine.dispatch(command);
    assert.equal(result.ok, true, JSON.stringify({ command, error: result.error }));
    return life();
  };
  const reload = () => {
    const prepared = save.prepareImport(save.serialize(engine.getState()));
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    engine.replaceState(prepared.state);
    return life();
  };
  send({ type: "SET_PRESET", routeId: "craft" });
  send({ type: "START_LIFE" });
  return { engine, content, save, life, send, reload };
}

test("real engine first acceptance and revisit persist the selected copy and survive serialization/reload", () => {
  const app = loadEngine(), item = app.content.opportunities.find(entry => entry.id === "repair-bench");
  assert.ok(app.life().opportunity.drawnIds.includes(item.id));
  const first = clone(app.content.getOpportunityCopy(item, app.life()));
  const seedBefore = app.life().seed;
  app.send({ type: "OPPORTUNITY", id: item.id });
  const accepted = clone(app.life());
  assert.equal(accepted.seed, seedBefore, "accepting descriptive opportunity text does not consume deterministic randomness");
  assert.equal(accepted.opportunity.history.at(-1).label, first.label);
  assert.equal(accepted.opportunityFeedback.title, "机会已接住：" + first.label);
  assert.equal(accepted.opportunityFeedback.copy, first.result);
  assert.equal(accepted.lifeLog.at(-1).label, first.label);
  assert.equal(accepted.lifeLog.at(-1).result, first.result);
  assert.deepEqual(clone(app.content.getOpportunityCopy(item, accepted)), first);
  const firstReload = clone(app.reload());
  assert.deepEqual(firstReload.opportunity, accepted.opportunity);
  assert.deepEqual(firstReload.opportunityFeedback, accepted.opportunityFeedback);
  assert.deepEqual(firstReload.lifeLog, accepted.lifeLog);
  app.send({ type: "END_LIFE_ACTIONS" });
  app.send({ type: "EVENT_ACTION", id: "steady-" + app.content.rounds[app.life().round].id });
  app.send({ type: "ADVANCE_ROUND" });
  assert.equal(app.life().age, 8);
  assert.ok(app.life().opportunity.drawnIds.includes(item.id));
  const repeat = clone(app.content.getOpportunityCopy(item, app.life()));
  assert.equal(repeat.repeated, true);
  const earlierHistory = clone(app.life().opportunity.history);
  const earlierLog = clone(app.life().lifeLog);
  app.send({ type: "OPPORTUNITY", id: item.id });
  const revisited = clone(app.life());
  assert.equal(revisited.opportunity.history.at(-1).label, repeat.label);
  assert.equal(revisited.opportunityFeedback.copy, repeat.result);
  assert.equal(revisited.lifeLog.at(-1).result, repeat.result);
  assert.deepEqual(revisited.opportunity.history.slice(0, -1), earlierHistory);
  assert.deepEqual(revisited.lifeLog.slice(0, -1), earlierLog);
  assert.deepEqual(clone(app.content.getOpportunityCopy(item, revisited)), repeat);
  const revisitReload = clone(app.reload());
  assert.deepEqual(revisitReload.opportunity, revisited.opportunity);
  assert.deepEqual(revisitReload.opportunityFeedback, revisited.opportunityFeedback);
  assert.deepEqual(revisitReload.lifeLog, revisited.lifeLog);
});

test("normalizing and resuming an already accepted older save preserves its labels, results and feedback verbatim", () => {
  const app = loadEngine(), item = app.content.opportunities.find(entry => entry.id === "repair-bench");
  app.send({ type: "OPPORTUNITY", id: item.id });
  const older = app.engine.getState();
  older.currentLife.opportunity.history[0].label = "旧版本留下的机会标题";
  older.currentLife.opportunityFeedback.title = "旧版本已经写下的反馈标题";
  older.currentLife.opportunityFeedback.copy = "旧版本实际保存的结果，不能改成今天的文案。";
  older.currentLife.lifeLog.at(-1).label = "旧版本留下的机会标题";
  older.currentLife.lifeLog.at(-1).result = "旧版本的经历原文";
  const preserved = clone(older.currentLife);
  const prepared = app.save.prepareImport(app.save.serialize(older));
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  app.engine.replaceState(prepared.state);
  app.content.getOpportunityCopy(item, app.life());
  app.engine.previewAction({ type: "OPPORTUNITY", id: item.id });
  const resumed = clone(app.reload());
  assert.deepEqual(resumed.opportunity, preserved.opportunity);
  assert.deepEqual(resumed.opportunityFeedback, preserved.opportunityFeedback);
  assert.deepEqual(resumed.lifeLog, preserved.lifeLog);
});
