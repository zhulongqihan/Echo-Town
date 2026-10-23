"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
let root = __dirname;
while (!fs.existsSync(path.join(root, "development/game/engine.js"))) root = path.dirname(root);
function runtime() {
  const box = { console, TextEncoder, Blob, Date }; box.window = box; vm.createContext(box);
  for (const file of ["content", "strategy", "projects", "save", "engine"]) vm.runInContext(fs.readFileSync(path.join(root, "development/game/" + file + ".js"), "utf8"), box, { filename: file });
  const e = box.EchoTownEngine;
  assert.equal(e.dispatch({ type: "SET_PRESET", routeId: "craft" }).ok, true);
  assert.equal(e.dispatch({ type: "START_LIFE" }).ok, true);
  return { e, c: box.EchoTownContent, s: box.EchoTownSave };
}
function fixture(e, c, round, change = () => {}) {
  const state = e.getState(), life = state.currentLife;
  life.round = round; life.age = c.rounds[round].age;
  life.opportunity = { drawnIds: [], selectedId: null, skipped: true, history: [] };
  life.lastAction = null; life.actionPoints = 2;
  life.resources.money = 50; life.resources.energy = 10;
  change(life); delete life.ledger;
  e.replaceState(state);
}
function cmd(e, type, id) { const result = e.dispatch({ type, id }); assert.equal(result.ok, true, result.error && result.error.message); }

test("event execution balance is either exact or explicitly branches with the test outcome", () => {
  const { e, c } = runtime();
  fixture(e, c, 12, (life) => { life.skills.craft = 8; });
  cmd(e, "END_LIFE_ACTIONS");
  const preview = e.previewAction({ type: "EVENT_ACTION", id: "open-workshop" });
  assert.equal(preview.available, true);
  assert.ok(preview.test.minimum >= preview.test.difficulty, "Success is certain for this state");
  cmd(e, "EVENT_ACTION", "open-workshop");
  const life = e.getState().currentLife;
  assert.equal(life.lastAction.test.success, true);
  assert.equal(preview.outcomes.success.money, life.resources.money);
  assert.equal(preview.outcomes.failure.money, 40);
  assert.equal(preview.outcomes.success.energy, life.resources.energy);
});


function conserved(life) {
  const { opening: o, totals: t, entries } = life.ledger;
  assert.equal(life.resources.money, o.money + t.income - t.expenses + t.borrowed - t.repaid);
  assert.equal(life.cashflow.debt, o.debt + t.borrowed + t.unpaid - t.repaid);
  assert.equal(life.cashflow.income, o.income + t.income);
  assert.equal(life.cashflow.expenses, o.expenses + t.expenses);
  assert.equal(entries.reduce((v, e) => v + e.money, o.money), life.resources.money);
}

test("forty command-only lives with longer authored histories remain saveable", () => {
  const { e, c, s } = runtime();
  let largest = 0;
  for (let generation = 0; generation < 40; generation++) {
    if (generation) cmd(e, "START_LIFE");
    for (let round = 0; round < c.rounds.length; round++) {
      let life = e.getState().currentLife;
      const opportunities = c.opportunities.filter(x => life.opportunity.drawnIds.includes(x.id) && e.previewAction({type:"OPPORTUNITY",id:x.id}).available).sort((a,b)=>b.detail.length-a.detail.length);
      if (opportunities.length) cmd(e,"OPPORTUNITY",opportunities[0].id); else cmd(e,"SKIP_OPPORTUNITY");
      while (e.getLifePhase() === "management") {
        life = e.getState().currentLife;
        const jobs = c.jobs.filter(x=>e.previewAction({type:"LIFE_ACTION",id:x.id}).available).sort((a,b)=>b.effect.resources.money-a.effect.resources.money);
        const action = jobs[0] || c.lifeActions.find(x=>x.id==="routine-rest");
        cmd(e,"LIFE_ACTION",action.id);
      }
      const event = c.rounds[round].actions.filter(x=>e.previewAction({type:"EVENT_ACTION",id:x.id}).available).sort((a,b)=>(b.result+(b.test?.successText||"")).length-(a.result+(a.test?.successText||"")).length)[0];
      cmd(e,"EVENT_ACTION",event.id); conserved(e.getState().currentLife);
      cmd(e,"ADVANCE_ROUND"); conserved(e.getState().currentLife);
    }
    const life = e.getState().currentLife;
    cmd(e,"TOGGLE_LEGACY",life.legacyCandidates[0]);
    cmd(e,"CONFIRM_LEGACIES");
    const saved = s.serialize(e.getState()); largest = Math.max(largest, Buffer.byteLength(saved));
    const parsed = s.prepareImport(saved); assert.equal(parsed.ok,true,JSON.stringify(parsed));
    e.replaceState(parsed.state);
  }
  console.log("long-history-40-bytes",largest);
  assert.equal(e.getState().world.history.length,40);
});
