const assert = require('node:assert/strict');
const test = require('node:test');
const {loadGame} = require('./natural-routes.test.js');
const command = (engine, type, rest={}) => { const r=engine.dispatch({type,...rest}); assert.equal(r.ok,true,JSON.stringify(r.error)); return r.state; };

test('talent attributes affect actual opening money and energy capacity, matching the preview', () => {
  const {engine:e} = loadGame();
  command(e,'SET_PRESET',{routeId:'craft'});
  command(e,'UPDATE_SETUP',{patch:{talentIds:['strong-back','good-family','good-memory'],attributes:{appearance:4,intelligence:5,physique:5,family:6}}});
  const setup=e.getSetup(), before=JSON.stringify(e.getState());
  const preview=e.createPreviewLife(setup.profileId,setup.talentId,setup.goalId,setup);
  assert.equal(JSON.stringify(e.getState()),before);
  const life=command(e,'START_LIFE').currentLife;
  assert.equal(life.build.attributes.physique,8);
  assert.equal(life.maxResources.energy,12);
  assert.equal(life.build.attributes.family,9);
  assert.equal(life.resources.money,e.getProfile(setup.profileId).start.money+4+9*2);
  assert.deepEqual(life.resources,preview.resources);
  assert.deepEqual(life.maxResources,preview.maxResources);
});

test('a high physique still receives the full inherited energy capacity bonus once', () => {
  const {engine:e} = loadGame();
  const initial=e.getState(); initial.world.legacyBank=['steady-habit']; e.replaceState(initial);
  command(e,'SET_PRESET',{routeId:'craft'});
  command(e,'UPDATE_SETUP',{patch:{attributes:{appearance:3,intelligence:3,physique:10,family:4},talentIds:['strong-back','good-memory','warm-heart']}});
  const life=command(e,'START_LIFE').currentLife;
  assert.equal(life.maxResources.energy,10+Math.floor(13/4)+1);
  const state=e.getState(); e.replaceState(state);
  assert.equal(e.getState().currentLife.maxResources.energy,14);
});

test('action previews expose both satisfied and missing requirements without changing state', () => {
  const {engine:e} = loadGame();
  command(e,'SET_PRESET',{routeId:'craft'}); command(e,'START_LIFE');
  const before=JSON.stringify(e.getState());
  const preview=e.previewAction({type:'LIFE_ACTION',id:'shop-shift'});
  assert.ok(preview.requirements.some(r=>r.label.includes('手艺') && r.met));
  assert.ok(preview.requirements.some(r=>r.label.includes('15') && !r.met));
  assert.equal(JSON.stringify(e.getState()),before);
});
