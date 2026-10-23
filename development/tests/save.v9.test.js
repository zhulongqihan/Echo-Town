"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const SAVE_PATH = fs.existsSync(path.join(__dirname, "save.js")) ? path.join(__dirname, "save.js") : path.join(__dirname, "../game/save.js");
let ROOT = __dirname;
while (!fs.existsSync(path.join(ROOT, "development/game/content.js"))) {
  const parent = path.dirname(ROOT);
  if (parent === ROOT) throw new Error("Cannot find the EchoTown workspace");
  ROOT = parent;
}
const PROJECTS_PATH = fs.existsSync(path.join(__dirname, "../desktop-v9-gameplay/projects.js"))
  ? path.join(__dirname, "../desktop-v9-gameplay/projects.js") : path.join(ROOT, "development/game/projects.js");
const AGES = [6, 8, 10, 11, 13, 15, 17, 19, 21, 24, 28, 32, 36, 40, 44, 47, 49, 52, 56, 60, 65, 70, 75];
const copy = value => JSON.parse(JSON.stringify(value));
const map = (keys, amount = 0) => Object.fromEntries(keys.split(" ").map(key => [key, amount]));

class MemoryStorage {
  constructor(initial = {}) { this.data = new Map(Object.entries(initial)); this.writes = []; this.failKey = null; }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) {
    if (this.failKey === key || typeof this.failKey === "function" && this.failKey(key)) throw new Error("quota");
    this.writes.push(key); this.data.set(key, String(value));
  }
}

function loadSave(extra = {}) {
  const sandbox = { TextEncoder, Blob, console, ...extra };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SAVE_PATH, "utf8"), sandbox, { filename: SAVE_PATH });
  return sandbox.EchoTownSave;
}

function loadGameplaySave() {
  const sandbox = { TextEncoder, Blob, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of [path.join(ROOT,"development/game/content.js"),path.join(ROOT,"development/game/strategy.js"),PROJECTS_PATH,SAVE_PATH]) {
    vm.runInContext(fs.readFileSync(file,"utf8"),sandbox,{filename:file});
  }
  return sandbox.EchoTownSave;
}

function historyEntry(generation, textLength = 24) {
  return {
    generation, age: 75, profileId: "scholar", talentId: "good-memory", goalId: "learn",
    outcomeTitle: "以前已经生成的结局", outcomeCopy: "保留原叙事，不重新结算", bestSkill: "study", goalProgress: 8, goalTarget: 8,
    talentIds: ["good-memory", "warm-heart", "slow-and-steady"], attributes: map("appearance intelligence physique family", 5), interests: { reading: 8 }, characters: { linlaoshi: 7 }, routeTags: ["study-route"],
    cashflow: { income: 203, expenses: 40, debt: 3 }, inventory: ["study-notebook"], legacyIds: ["study-notebook"], achievementIds: ["first-page"], secretIds: [], momentIds: ["first-study"], jobHistory: ["tutor-shift"],
    actions: AGES.map((age, index) => ({ round: index + 1, age, actionId: "record-life", label: "原来的实际选择", result: "人".repeat(textLength), success: index % 2 === 0 })),
    lifeLog: AGES.slice(0, 12).map(age => ({ age, label: "原来的生活安排", result: "原来的结算文字", kind: "生活" })),
    opportunityHistory: AGES.map(age => ({ age, id: "borrowed-book", label: "保留的机会" })),
    strategy: { routeId: "study", goals: { "study:childhood": { status: "achieved", round: 3, checks: [true,true] } }, consequences: [{ id: "study-report-verified", round: 16, success: true }] },
    ledger: { opening: { money: 20, debt: 0, income: 0, expenses: 0 }, totals: { income: 203, expenses: 40, borrowed: 3, repaid: 0, unpaid: 0 } },
  };
}

function v8State(round = 0, phase = "opportunity", ap = 2) {
  const age = AGES[round];
  const opportunityId = age < 18 ? "borrowed-book" : age < 50 ? "side-project" : "last-letter";
  const state = {
    version: 8, introSeen: true, screen: "game", settings: { fontScale: true, sound: false, volume: 0.37 }, notice: "原始提示",
    setup: { profileId: "scholar", talentId: "good-memory", talentIds: ["good-memory", "warm-heart", "slow-and-steady"], routeId: "study", goalId: "learn", attributes: map("appearance intelligence physique family", 5) },
    world: { completedLives: 0, town: map("shop bridge school market archive", 1), history: [], legacyBank: ["small-tool"], collectedLegacyIds: ["small-tool"], achievements: [], secrets: [], moments: [], totals: { choices: 4, tests: 1, testWins: 0, workShifts: 2, moneyEarned: 203, moneySpent: 40 } },
    currentLife: {
      status: "active", generation: 1, age, round, seed: 246813579,
      profileId: "scholar", talentId: "good-memory", goalId: "learn", jobId: "tutor-shift",
      resources: { money: 183, energy: 0, health: 6, happiness: 7, pressure: 9, expectation: 2 }, maxResources: { energy: 13 },
      skills: { study: 12, craft: 4, empathy: 3, expression: 2, courage: 1 }, relationships: map("family mentor friend partner child neighbor", 3), town: map("shop bridge school market archive", 1), characters: { mother: 4, qishu: 2, linlaoshi: 5 },
      build: { attributes: map("appearance intelligence physique family", 5), talentIds: ["good-memory", "warm-heart", "slow-and-steady"], interests: { reading: 8, machinery: 3 }, routeTags: ["study-route"] },
      actionPoints: 2, sideActionsUsed: 0, inventory: ["toolkit", "study-notebook"], jobShifts: 2, jobHistory: ["tutor-shift"], cashflow: { income: 203, expenses: 40, debt: 3 },
      lifeLog: [{ age, label: "已有记录", result: "不能重放的结果", kind: "生活" }], lifeFeedback: { title: "此前工资到账", copy: "原始结算", changes: ["钱+8"] }, sceneVisits: [], sceneFeedback: null, opportunityFeedback: null,
      flags: ["first-wage"], secrets: [], progress: map("learn home connection town record free", 2), inheritedLegacyIds: ["small-tool"], actions: [], lastAction: null, carryForward: null, outcome: null,
      legacyCandidates: [], selectedLegacies: [], newAchievements: [], newSecrets: [], moments: [], newMoments: [],
      opportunity: { drawnIds: [opportunityId], selectedId: null, skipped: false, history: [] },
      strategy: { version: 1, routeId: "study", goals: {}, evidence: [], consequences: [], migratedThroughStage: null },
      ledger: { opening: { money: 20, debt: 0, income: 0, expenses: 0 }, totals: { income: 203, expenses: 40, borrowed: 0, repaid: 0, unpaid: 3 }, entries: [{ round: 0, id: "tutor-shift", kind: "work", money: 203, debt: 0, balance: 223 }, { round: 0, id: "bill-0", kind: "bill", money: -40, debt: 3, balance: 183 }] },
    },
  };
  const life = state.currentLife;
  if (phase === "home") { state.screen = "start"; state.currentLife = null; return state; }
  if (phase === "opportunity") return state;
  life.opportunity.selectedId = opportunityId;
  life.opportunity.history = [{ age, id: opportunityId, label: "旧版选择过的机会" }];
  life.opportunityFeedback = { title: "已经选择", copy: "无需重抽", changes: ["学识+1"] };
  life.actionPoints = ap;
  life.sideActionsUsed = 2 - ap;
  if (phase === "management" || phase === "event") return state;
  life.actions = [{ round: round + 1, age, actionId: "original-action", label: "此前已做出的选择", result: "检定失败已经写下", success: false }];
  life.lastAction = { actionId: "original-action", title: "旧选择", result: "已经发生的失败", future: "旧承诺", changes: ["压力+1"], newLevels: [], newSecrets: [], tags: [], test: { label: "旧检定", score: 3, difficulty: 5, roll: 1, success: false, text: "原失败文案" }, stageBreak: null, newMoments: [], milestones: [] };
  life.carryForward = { title: "旧结果", copy: "不可重算", age };
  if (phase === "ending" || phase === "legacy-selected") {
    life.status = "complete";
    life.outcome = { title: "原来的结局", copy: "一字不改", tone: "仍在摸索", score: 53 };
    life.legacyCandidates = ["small-tool", "study-notebook"];
    life.selectedLegacies = phase === "legacy-selected" ? ["study-notebook"] : [];
    state.world.completedLives = 1;
    state.world.history = [historyEntry(1)];
    state.screen = "ending";
  }
  return state;
}

function v7State(round = 0, phase = "opportunity", ap = 2) {
  const state = v8State(round, phase, ap);
  state.version = 7;
  delete state.settings.volume;
  if (state.currentLife) { delete state.currentLife.strategy; delete state.currentLife.ledger; }
  state.world.history.forEach(entry => { delete entry.strategy; delete entry.ledger; });
  return state;
}

function assertOldFactsIntact(original, migrated) {
  const prior = copy(original), next = copy(migrated);
  assert.equal(next.version, 9);
  for (const [key, value] of Object.entries(prior)) {
    if (key === "version" || key === "currentLife") continue;
    assert.deepEqual(next[key], value, key);
  }
  if (!prior.currentLife) { assert.equal(next.currentLife, null); return; }
  for (const [key, value] of Object.entries(prior.currentLife)) assert.deepEqual(next.currentLife[key], value, "currentLife." + key);
}

test("v9 contract keeps three accepted versions and separate source/raw backup namespaces", () => {
  const { CONTRACT: c } = loadSave();
  assert.equal(c.version, 9); assert.deepEqual(copy(c.acceptedVersions), [7,8,9]);
  assert.equal(c.storageKey, "echo-town-generation-save-v9");
  assert.equal(c.previousStorageKey, "echo-town-generation-save-v8");
  assert.equal(c.v7StorageKey, "echo-town-generation-save");
  assert.notEqual(c.v8BackupPrefix, c.v7BackupPrefix);
  assert.equal(c.maxInputBytes, 2*1024*1024); assert.equal(c.maxBytes, 512*1024);
});

test("v8 migration preserves all phase facts, feedback, original outcomes and failed rolls", () => {
  const save = loadSave();
  const phases = [[0,"home",2],[0,"opportunity",2],[6,"feedback",0],[7,"opportunity",2],[7,"management",2],[7,"management",1],[7,"event",0],[8,"opportunity",2],[8,"management",1],[10,"feedback",0],[22,"opportunity",2],[22,"event",0],[22,"feedback",0],[22,"ending",0],[22,"legacy-selected",0]];
  for (const [round, phase, ap] of phases) {
    const original = v8State(round, phase, ap), snapshot = copy(original);
    const prepared = save.prepareImport(JSON.stringify(original, null, 2));
    assert.equal(prepared.ok, true, JSON.stringify({round,phase,error:prepared}));
    assert.equal(prepared.sourceVersion, 8); assert.equal(prepared.migrated, true);
    assertOldFactsIntact(original, prepared.state);
    assert.deepEqual(original, snapshot, "migration cannot mutate input");
    assert.deepEqual(copy(save.migrateToCurrent(prepared.state)), copy(prepared.state), "idempotent current version");
    assert.equal(save.prepareImport(prepared.payload).migrated, false);
  }
});

test("v7 compatibility helper still returns v8; chained migration preserves its earlier admission", () => {
  const save = loadSave();
  const original = v7State(6, "feedback", 0);
  const intermediate = save.migrateV7ToV8(original);
  assert.equal(intermediate.version, 8);
  assert.equal(intermediate.currentLife.migration.fromVersion, 7);
  intermediate.currentLife.migration.goalAccessVersion = 1;
  intermediate.currentLife.migration.activeGoalIds = ["study:adolescence"];
  intermediate.currentLife.migration.deferGoals = false;
  const admitted = copy(intermediate.currentLife.migration);
  const candidate = save.migrateV8ToV9(intermediate);
  assert.deepEqual(copy(candidate.currentLife.migration), admitted);
  assertOldFactsIntact(intermediate, candidate);
  const direct = save.prepareImport(JSON.stringify(original));
  assert.equal(direct.ok, true); assert.equal(direct.state.version, 9);
  assert.deepEqual(copy(direct.state.currentLife.lastAction), original.currentLife.lastAction);
  assert.equal(direct.state.currentLife.migration.goalAccessVersion, undefined, "save must not run strategy admission");
});

test("load selects the newest present source and startup commit leaves v8 and v7 exact originals", () => {
  const save = loadSave(), c = save.CONTRACT;
  const old7 = JSON.stringify(v7State(22,"legacy-selected",0),null,2), old8 = JSON.stringify(v8State(8,"management",1),null,2);
  const storage = new MemoryStorage({ [c.v7StorageKey]:old7, [c.previousStorageKey]:old8 });
  const loaded = save.load({storage});
  assert.equal(loaded.sourceVersion, 8); assert.equal(loaded.sourceKey,c.previousStorageKey); assert.equal(loaded.needsCommit,true); assert.equal(storage.writes.length,0);
  const committed=save.commitImport(loaded,null,{storage,startupMigration:true});
  assert.equal(committed.ok,true); assert.deepEqual(storage.writes,[c.storageKey]);
  assert.equal(storage.getItem(c.previousStorageKey),old8); assert.equal(storage.getItem(c.v7StorageKey),old7);
  const reloaded=save.load({storage});
  assert.equal(reloaded.sourceVersion,9); assert.equal(reloaded.needsCommit,false); assertOldFactsIntact(JSON.parse(old8),reloaded.state);
});

test("v7-only startup migrates directly to v9 without creating or altering v8", () => {
  const save=loadSave(),c=save.CONTRACT,raw=JSON.stringify(v7State(22,"feedback",0),null,2);
  const storage=new MemoryStorage({[c.v7StorageKey]:raw});
  const candidate=save.load({storage});assert.equal(candidate.sourceVersion,7);
  assert.equal(save.commitImport(candidate,null,{storage,startupMigration:true}).ok,true);
  assert.equal(storage.getItem(c.previousStorageKey),null);assert.equal(storage.getItem(c.v7StorageKey),raw);assert.deepEqual(storage.writes,[c.storageKey]);
});

test("a corrupt newer source blocks fallback and ordinary persistence to the v9 key", () => {
  const save=loadSave(),c=save.CONTRACT,current=save.migrateToCurrent(v8State(0,"home"));
  for(const badKey of [c.storageKey,c.previousStorageKey,c.v7StorageKey]){
    const storage=new MemoryStorage({[c.v7StorageKey]:JSON.stringify(v7State()),...(badKey!==c.v7StorageKey?{[c.previousStorageKey]:JSON.stringify(v8State())}:{}),[badKey]:'broken-json'});
    const loaded=save.load({storage,defaultState:current});
    assert.equal(loaded.ok,false);assert.equal(loaded.recoveryRequired,true);assert.equal(loaded.sourceKey,badKey);assert.equal(loaded.state,undefined);
    assert.equal(save.persist(current,{storage}).code,"RECOVERY_REQUIRED");assert.equal(storage.writes.length,0);
  }
});

test("a valid save stored under another version's key is protected rather than silently moved", () => {
  const save=loadSave(),c=save.CONTRACT;
  for(const [key,wrong] of [[c.storageKey,v8State()],[c.previousStorageKey,v7State()],[c.v7StorageKey,v8State()]]){
    const raw=JSON.stringify(wrong),storage=new MemoryStorage({[key]:raw});
    const result=save.load({storage});assert.equal(result.code,"WRONG_STORAGE_VERSION");assert.equal(result.recoveryRequired,true);assert.equal(storage.writes.length,0);assert.equal(storage.getItem(key),raw);
  }
});

test("v8 and v9 clear markers stop all older resurrection, including failed clear", () => {
  const save=loadSave(),c=save.CONTRACT,defaults=save.migrateToCurrent(v8State(0,"home")),old7=JSON.stringify(v7State());
  for(const [key,marker] of [[c.storageKey,'{"version":9,"cleared":true}'],[c.previousStorageKey,'{"version":8,"cleared":true}']]){
    const storage=new MemoryStorage({[c.v7StorageKey]:old7,[key]:marker});
    const loaded=save.load({storage,defaultState:defaults});assert.equal(loaded.cleared,true);assert.equal(loaded.state.currentLife,null);assert.equal(loaded.needsCommit,false);assert.equal(storage.writes.length,0);
  }
  const original=save.serialize(save.migrateToCurrent(v8State()));
  const storage=new MemoryStorage({[c.storageKey]:original,[c.previousStorageKey]:JSON.stringify(v8State()),[c.v7StorageKey]:old7});
  storage.failKey=c.storageKey;assert.equal(save.remove({storage}).ok,false);assert.equal(storage.getItem(c.storageKey),original);
  storage.failKey=null;assert.equal(save.remove({storage}).ok,true);assert.equal(save.load({storage,defaultState:defaults}).cleared,true);assert.equal(storage.getItem(c.v7StorageKey),old7);
});

test("startup migration rejects changed originals and newly appeared higher-priority sources", () => {
  const save=loadSave(),c=save.CONTRACT;
  for(const sourceVersion of [7,8]){
    const sourceKey=sourceVersion===8?c.previousStorageKey:c.v7StorageKey;
    const raw=JSON.stringify(sourceVersion===8?v8State():v7State());
    for(const changedKey of [sourceKey,c.storageKey,...(sourceVersion===7?[c.previousStorageKey]:[])]){
      const storage=new MemoryStorage({[sourceKey]:raw}),loaded=save.load({storage}),before=copy(loaded.state);
      storage.data.set(changedKey,"a newer or changed save");
      const result=save.commitImport(loaded,null,{storage,startupMigration:true});
      assert.equal(result.code,"STORAGE_CHANGED");assert.equal(storage.writes.length,0);assert.equal(storage.getItem(changedKey),"a newer or changed save");assert.deepEqual(copy(loaded.state),before);
    }
  }
});

test("failed startup commit preserves its source, candidate memory and unrelated storage", () => {
  const save=loadSave(),c=save.CONTRACT;
  for(const sourceVersion of [7,8]){
    const sourceKey=sourceVersion===8?c.previousStorageKey:c.v7StorageKey;
    const raw=JSON.stringify(sourceVersion===8?v8State(22,"legacy-selected",0):v7State(22,"legacy-selected",0));
    const storage=new MemoryStorage({[sourceKey]:raw,"other-project":"keep"}),loaded=save.load({storage}),before=copy(loaded.state);
    storage.failKey=c.storageKey;assert.equal(save.commitImport(loaded,null,{storage,startupMigration:true}).code,"STORAGE_WRITE_FAILED");
    assert.equal(storage.getItem(c.storageKey),null);assert.equal(storage.getItem(sourceKey),raw);assert.equal(storage.getItem("other-project"),"keep");assert.deepEqual(copy(loaded.state),before);
  }
});

test("explicit v7/v8 imports back up latest memory plus exact raw source into independent namespaces", () => {
  const save=loadSave(),c=save.CONTRACT;
  for(const version of [7,8]){
    const raw=JSON.stringify(version===8?v8State(8,"management",1):v7State(8,"management",1),null,2),prepared=save.prepareImport(raw);
    const current=save.migrateToCurrent(v8State(0,"home"));current.notice="newer than disk";
    const before=copy(current),storage=new MemoryStorage({[c.storageKey]:"old-disk",[c.previousStorageKey]:"keep-raw-v8",[c.v7StorageKey]:"keep-raw-v7"});
    const result=save.commitImport(prepared,current,{storage});assert.equal(result.ok,true);
    assert.deepEqual(JSON.parse(storage.getItem(c.backupKey)),copy(current));assert.deepEqual(copy(current),before);
    assert.ok(result.sourceBackupKey.startsWith(version===7?c.v7BackupPrefix:c.v8BackupPrefix));assert.equal(storage.getItem(result.sourceBackupKey),raw);
    assert.equal(storage.getItem(c.previousStorageKey),"keep-raw-v8");assert.equal(storage.getItem(c.v7StorageKey),"keep-raw-v7");
    assert.equal(storage.writes.at(-1),c.storageKey);assert.equal(storage.getItem(c.storageKey),result.payload);
  }
});

test("backup, raw-backup and primary write failures never replace the current memory or primary", () => {
  const save=loadSave(),c=save.CONTRACT;
  for(const failKind of ["backup","raw","primary"]){
    const current=save.migrateToCurrent(v8State(6,"feedback",0)),before=copy(current),stored=save.serialize(current),raw=JSON.stringify(v8State(8,"management",1));
    const storage=new MemoryStorage({[c.storageKey]:stored,[c.previousStorageKey]:"old-v8",[c.v7StorageKey]:"old-v7"});
    storage.failKey=failKind==="backup"?c.backupKey:failKind==="primary"?c.storageKey:key=>key.startsWith(c.v8BackupPrefix);
    const result=save.commitImport(save.prepareImport(raw),current,{storage});
    assert.equal(result.ok,false);assert.equal(result.code,failKind==="primary"?"STORAGE_WRITE_FAILED":"BACKUP_WRITE_FAILED");
    assert.equal(storage.getItem(c.storageKey),stored);assert.deepEqual(copy(current),before);assert.equal(storage.getItem(c.previousStorageKey),"old-v8");assert.equal(storage.getItem(c.v7StorageKey),"old-v7");
  }
});

test("tampered candidate and shell saves are rejected before backup or commit", () => {
  const save=loadSave(),current=save.migrateToCurrent(v8State()),storage=new MemoryStorage();
  for(const text of ['{"version":7}','{"version":8}','{"version":9}',"not-json",'{"version":6}']) assert.equal(save.prepareImport(text).ok,false);
  const prepared=save.prepareImport(JSON.stringify(v8State()));prepared.state.currentLife.ledger.totals.income="forged";
  assert.equal(save.commitImport(prepared,current,{storage}).ok,false);assert.equal(storage.writes.length,0);
});

test("forty detailed v8 histories survive pretty input, v9 export and reimport without trimming", () => {
  const save=loadSave(),state=v8State(0,"home");state.world.completedLives=40;state.world.history=Array.from({length:40},(_,i)=>historyEntry(i+1,80));
  const source=JSON.stringify(state,null,2),imported=save.prepareImport(source);assert.equal(imported.ok,true,JSON.stringify(imported));
  assert.equal(imported.state.world.history.length,40);assert.deepEqual(copy(imported.state.world.history),state.world.history);
  assert.ok(save.byteLength(imported.payload)<=save.CONTRACT.maxBytes);assert.equal(imported.payload.includes("\n"),false);
  const again=save.prepareImport(imported.payload);assert.equal(again.ok,true);assert.deepEqual(copy(again.state.world.history),state.world.history);
  const padded=" ".repeat(save.CONTRACT.maxBytes)+JSON.stringify(v8State(0,"home"));assert.ok(save.byteLength(padded)<save.CONTRACT.maxInputBytes);assert.equal(save.prepareImport(padded).ok,true);
  assert.equal(save.prepareImport(" ".repeat(save.CONTRACT.maxInputBytes+1)).code,"INPUT_TOO_LARGE");
  const tooBig=v8State(0,"home");tooBig.notice="中".repeat(200000);assert.equal(save.prepareImport(JSON.stringify(tooBig)).code,"SAVE_TOO_LARGE");
});

test("v9 persistence refuses old versions, pending old migration, and quota failure", () => {
  const save=loadSave(),c=save.CONTRACT,current=save.migrateToCurrent(v8State()),raw=save.serialize(current);
  const storage=new MemoryStorage({[c.previousStorageKey]:JSON.stringify(v8State())});
  assert.equal(save.persist(current,{storage}).code,"MIGRATION_REQUIRED");assert.equal(storage.writes.length,0);
  assert.equal(save.persist(v8State(),{storage}).code,"WRONG_VERSION");
  storage.data.set(c.storageKey,raw);storage.failKey=c.storageKey;
  assert.equal(save.persist(current,{storage}).code,"STORAGE_WRITE_FAILED");assert.equal(storage.getItem(c.storageKey),raw);
});

const PROJECT_ID = "craft-customers-youth-v1";
function projectStep(round, purchase = false, slot = 1) {
  const preparation = round === 8, type = purchase ? "BUY_ITEM" : "LIFE_ACTION";
  const actionId = purchase ? "toolkit" : preparation ? "routine-repair" : "shop-shift";
  return {round,type,actionId,slot,receiptId:[PROJECT_ID,round,slot,type,actionId].join(":"),ap:preparation?1:2,moneySpent:purchase?12:0,energySpent:purchase?0:2};
}
function projectState(status = "completed", purchase = false) {
  const state = v8State(10,"feedback",0), life = state.currentLife;
  state.version = 9;
  life.skills.craft = 6;
  life.actions[0].actionId = "return-workshop";
  life.lastAction.actionId = "return-workshop";
  life.strategy.evidence = [
    {round:7,kind:"job",id:"shop-shift",success:true},
    ...(purchase?[]:[{round:8,kind:"life",id:"routine-repair",success:true}]),
    {round:9,kind:"job",id:"shop-shift",success:true},
    {round:10,kind:"event",id:"return-workshop",success:false},
  ];
  if (purchase) {
    life.ledger.entries.push({round:8,kind:"purchase",id:"toolkit",money:-12,debt:0,balance:171});
    life.ledger.totals.expenses += 12; life.cashflow.expenses += 12; life.resources.money = 171;
  }
  const steps = {firstWork:projectStep(7),preparation:projectStep(8,purchase,2),returnWork:projectStep(9)};
  const current = {id:PROJECT_ID,status,acceptedRound:7,steps};
  if (status === "active") { life.actions=[]; life.lastAction=null; life.carryForward=null; life.strategy.evidence.pop(); }
  else {
    current.settledRound=10; current.resultId=PROJECT_ID+":"+status;
    if (status !== "withdrawn") current.finalCraft=6;
    if (status === "incomplete") delete current.steps.preparation;
  }
  life.projects={version:1,eligibleFromRound:7,current};
  return state;
}

test("v8 adds only empty projects with eligibility based on remaining actions, never old job history", () => {
  const save=loadSave();
  const cases=[[0,"opportunity",2,7],[6,"feedback",0,7],[7,"opportunity",2,7],[7,"management",2,7],[7,"management",1,null],[7,"event",0,null],[7,"feedback",2,null],[8,"opportunity",2,null],[10,"feedback",0,null],[22,"ending",0,null],[22,"legacy-selected",0,null]];
  for (const [round,phase,ap,eligible] of cases) {
    const original=v8State(round,phase,ap);
    original.currentLife.jobHistory=["shop-shift"];
    const prepared=save.prepareImport(JSON.stringify(original));assert.equal(prepared.ok,true);
    assert.deepEqual(copy(prepared.state.currentLife.projects),{version:1,eligibleFromRound:eligible,current:null},`${round}/${phase}/${ap}`);
    assertOldFactsIntact(original,prepared.state);
  }
  const skipped=v8State(7,"management",2);skipped.currentLife.opportunity.selectedId=null;skipped.currentLife.opportunity.skipped=true;
  assert.equal(save.prepareImport(JSON.stringify(skipped)).state.currentLife.projects.eligibleFromRound,7);
  const used=v8State(7,"management",2);used.currentLife.sideActionsUsed=1;
  assert.equal(save.prepareImport(JSON.stringify(used)).state.currentLife.projects.eligibleFromRound,null);
  const v9=v8State(7,"management",2);v9.version=9;
  assert.equal(save.prepareImport(JSON.stringify(v9)).state.currentLife.projects,undefined,"v9 missing data stays missing for engine initialization");
  v9.currentLife.projects={version:1,eligibleFromRound:null,current:null};
  assert.equal(save.prepareImport(JSON.stringify(v9)).state.currentLife.projects.eligibleFromRound,null,"deferred eligibility cannot be promoted on refresh");
});

test("valid current projects survive standalone and real gameplay validation without replay", () => {
  for (const save of [loadSave(),loadGameplaySave()]) {
    for (const status of ["active","completed","incomplete","withdrawn"]) for (const purchase of [false,true]) {
      const original=projectState(status,purchase),before=copy(original);
      const prepared=save.prepareImport(JSON.stringify(original));assert.equal(prepared.ok,true,JSON.stringify({status,purchase,error:prepared}));
      assert.deepEqual(copy(prepared.state),original);assert.deepEqual(original,before);
      assert.deepEqual(copy(save.prepareImport(prepared.payload).state),original);
    }
  }
});

test("forged or inconsistent project progress is rejected before any backup or main write", () => {
  const mutations = [
    ["explicit-null",s=>s.currentLife.projects=null],
    ["unknown-top-field",s=>s.currentLife.projects.rewardClaimed=true],
    ["missing-current",s=>delete s.currentLife.projects.current],
    ["deferred-but-started",s=>s.currentLife.projects.eligibleFromRound=null],
    ["wrong-project",s=>s.currentLife.projects.current.id="invented"],
    ["wrong-accept",s=>s.currentLife.projects.current.acceptedRound=8],
    ["wrong-first-round",s=>s.currentLife.projects.current.steps.firstWork.round=8],
    ["missing-step",s=>delete s.currentLife.projects.current.steps.preparation],
    ["extra-step",s=>s.currentLife.projects.current.steps.fourth=projectStep(9)],
    ["fake-job",s=>s.currentLife.projects.current.steps.firstWork.actionId="project-craft-shift"],
    ["wrong-receipt",s=>s.currentLife.projects.current.steps.firstWork.receiptId="forged"],
    ["wrong-ap",s=>s.currentLife.projects.current.steps.firstWork.ap=1],
    ["free-work",s=>s.currentLife.projects.current.steps.firstWork.energySpent=0],
    ["wrong-slot",s=>{const r=s.currentLife.projects.current.steps.firstWork;r.slot=2;r.receiptId=[PROJECT_ID,7,2,r.type,r.actionId].join(":");}],
    ["missing-real-work",s=>s.currentLife.strategy.evidence.shift()],
    ["failed-work",s=>s.currentLife.strategy.evidence[0].success=false],
    ["wrong-evidence-kind",s=>s.currentLife.strategy.evidence[0].kind="life"],
    ["missing-event-evidence",s=>s.currentLife.strategy.evidence.pop()],
    ["missing-deadline-action",s=>s.currentLife.actions=[]],
    ["event-not-committed",s=>s.currentLife.lastAction=null],
    ["wrong-deadline",s=>s.currentLife.projects.current.settledRound=9],
    ["wrong-result",s=>s.currentLife.projects.current.resultId=PROJECT_ID+":incomplete"],
    ["low-final-craft",s=>s.currentLife.projects.current.finalCraft=4],
    ["fractional-final-craft",s=>s.currentLife.projects.current.finalCraft=5.5],
    ["active-with-result",s=>s.currentLife.projects.current.status="active"],
    ["withdrawn-with-final-craft",s=>{s.currentLife.projects.current.status="withdrawn";s.currentLife.projects.current.resultId=PROJECT_ID+":withdrawn";}],
    ["incomplete-with-all-requirements",s=>{s.currentLife.projects.current.status="incomplete";s.currentLife.projects.current.resultId=PROJECT_ID+":incomplete";}],
  ];
  for (const save of [loadSave(),loadGameplaySave()]) for (const [label,change] of mutations) {
    const candidate=projectState(), current=save.migrateToCurrent(v8State(0,"home")),raw=save.serialize(current);
    const storage=new MemoryStorage({[save.CONTRACT.storageKey]:raw});change(candidate);
    assert.equal(save.prepareImport(JSON.stringify(candidate)).ok,false,label);
    assert.equal(save.commitImport({ok:true,state:candidate,sourceVersion:9},current,{storage}).ok,false,label);
    assert.equal(storage.writes.length,0,label);assert.equal(storage.getItem(save.CONTRACT.storageKey),raw,label);
  }
});

test("tool preparation needs matching purchase ledger and retained tool, not a fabricated strategy purchase", () => {
  for (const save of [loadSave(),loadGameplaySave()]) for (const mutation of [
    s=>s.currentLife.ledger.entries.pop(),
    s=>s.currentLife.ledger.entries.at(-1).money=-11,
    s=>s.currentLife.ledger.entries.at(-1).round=7,
    s=>s.currentLife.ledger.entries.at(-1).kind="work",
    s=>s.currentLife.inventory=s.currentLife.inventory.filter(id=>id!=="toolkit"),
    s=>s.currentLife.projects.current.steps.preparation.moneySpent=0,
  ]) {
    const state=projectState("completed",true);mutation(state);
    assert.equal(save.prepareImport(JSON.stringify(state)).ok,false);
  }
});

test("current receipt cannot claim a future action or a side-action slot not yet executed", () => {
  for(const save of [loadSave(),loadGameplaySave()]) {
    const active=projectState("active");active.currentLife.round=9;active.currentLife.age=24;
    active.currentLife.sideActionsUsed=1;
    assert.equal(save.prepareImport(JSON.stringify(active)).ok,true);
    active.currentLife.sideActionsUsed=0;
    assert.equal(save.prepareImport(JSON.stringify(active)).ok,false);
    active.currentLife.round=8;active.currentLife.age=21;
    assert.equal(save.prepareImport(JSON.stringify(active)).ok,false);
  }
});

test("current-node project receipts require their action points to have actually been spent", () => {
  for(const save of [loadSave(),loadGameplaySave()]) {
    const active=projectState("active");active.currentLife.round=9;active.currentLife.age=24;
    active.currentLife.sideActionsUsed=1;active.currentLife.actionPoints=0;
    assert.equal(save.prepareImport(JSON.stringify(active)).ok,true,"a paid two-point work step remains valid");
    for(const ap of [1,2]) {
      active.currentLife.actionPoints=ap;
      assert.equal(save.prepareImport(JSON.stringify(active)).ok,false,"recorded work cannot retain its spent AP");
    }
    const prep=projectState("active");prep.currentLife.round=8;prep.currentLife.age=21;
    delete prep.currentLife.projects.current.steps.returnWork;
    prep.currentLife.projects.current.steps.preparation=projectStep(8,false,1);
    prep.currentLife.strategy.evidence=prep.currentLife.strategy.evidence.filter(entry=>entry.round<=8);
    prep.currentLife.sideActionsUsed=1;
    for(const ap of [0,1]) {prep.currentLife.actionPoints=ap;assert.equal(save.prepareImport(JSON.stringify(prep)).ok,true,"other spending or abandoning spare AP remains valid");}
    prep.currentLife.actionPoints=2;assert.equal(save.prepareImport(JSON.stringify(prep)).ok,false);
    prep.currentLife.projects.current.steps.preparation=projectStep(8,false,2);prep.currentLife.sideActionsUsed=2;
    prep.currentLife.actionPoints=0;assert.equal(save.prepareImport(JSON.stringify(prep)).ok,true);
    prep.currentLife.actionPoints=1;assert.equal(save.prepareImport(JSON.stringify(prep)).ok,false,"second-slot preparation also paid for the earlier action");
  }
});

test("saved 28-year event feedback cannot leave its project active and break the following node", () => {
  for(const save of [loadSave(),loadGameplaySave()]) {
    const candidate=projectState(),item=candidate.currentLife.projects.current;
    item.status="active";delete item.settledRound;delete item.resultId;delete item.finalCraft;
    const current=save.migrateToCurrent(v8State(0,"home")),raw=save.serialize(current);
    const storage=new MemoryStorage({[save.CONTRACT.storageKey]:raw});
    assert.equal(save.prepareImport(JSON.stringify(candidate)).ok,false,"externally saved feedback must already contain the project outcome");
    assert.equal(save.commitImport({ok:true,state:candidate,sourceVersion:9},current,{storage}).ok,false);
    assert.equal(storage.writes.length,0);assert.equal(storage.getItem(save.CONTRACT.storageKey),raw);
  }
});

test("completed project remains valid at later nodes and ending without relying on historical summaries", () => {
  for(const save of [loadSave(),loadGameplaySave()]) for(const [round,phase] of [[11,"management"],[22,"ending"],[22,"legacy-selected"]]) {
    const valid=projectState(),later=v8State(round,phase,0);later.version=9;
    later.currentLife.projects=copy(valid.currentLife.projects);
    later.currentLife.strategy.evidence=copy(valid.currentLife.strategy.evidence);
    later.currentLife.actions.unshift(valid.currentLife.actions[0]);
    assert.equal(save.prepareImport(JSON.stringify(later)).ok,true,`${round}/${phase}`);
    later.currentLife.strategy.evidence=[];
    assert.equal(save.prepareImport(JSON.stringify(later)).ok,false,"history cannot substitute current receipts");
  }
});

test("history accepts only terminal project summaries and never creates current project achievements", () => {
  const save=loadGameplaySave(),state=v8State(7,"management",2);
  state.world.completedLives=1;state.currentLife.generation=2;
  const entry=historyEntry(1);
  entry.projects={id:PROJECT_ID,status:"completed",resultId:PROJECT_ID+":completed",settledRound:10,stepsDone:3,preparationActionId:"toolkit",finalCraft:6};
  state.world.history=[entry];
  const migrated=save.prepareImport(JSON.stringify(state));assert.equal(migrated.ok,true);
  assert.deepEqual(copy(migrated.state.world.history),state.world.history);
  assert.equal(migrated.state.currentLife.projects.current,null);
  for(const bad of [{...entry.projects,stepsDone:2},{...entry.projects,status:"active"},{...entry.projects,preparationActionId:null},{...entry.projects,finalCraft:4},{...entry.projects,unknown:true},projectState().currentLife.projects]) {
    const forged=copy(state);forged.world.history[0].projects=bad;
    assert.equal(save.prepareImport(JSON.stringify(forged)).ok,false);
  }
  for(const empty of [null,undefined]) {const valid=copy(state);valid.world.history[0].projects=empty;assert.equal(save.prepareImport(JSON.stringify(valid)).ok,true);}
  const archived=copy(migrated.state);archived.currentLife=null;archived.screen="archive";archived.world.completedLives=40;
  archived.world.history=Array.from({length:40},(_,i)=>({...historyEntry(i+1,80),projects:copy(entry.projects)}));
  const payload=save.serialize(archived),roundTrip=save.prepareImport(payload);
  assert.ok(save.byteLength(payload)<=save.CONTRACT.maxBytes);assert.equal(roundTrip.ok,true);
  assert.deepEqual(copy(roundTrip.state.world.history),archived.world.history,"all forty project summaries and earlier facts remain intact");
});

test("gameplay normalize hook is enforced but cannot mutate caller state during validation", () => {
  let called=0;
  const state=projectState(),before=copy(state);
  const save=loadSave({EchoTownProjects:{normalize(projects,life){called++;projects.current.status="incomplete";life.resources.money=0;throw new Error("rule rejection");}}});
  const result=save.validateState(state);assert.equal(result.ok,false);assert.equal(called,1);assert.deepEqual(state,before);
  const withoutThrow=loadSave({EchoTownProjects:{normalize(projects,life){projects.current.status="incomplete";life.resources.money=0;return projects;}}});
  assert.equal(withoutThrow.validateState(state).ok,true);assert.deepEqual(state,before);
});

test("actual composition root exposes migrated memory only after the v9 startup write succeeds", () => {
  for(const sourceVersion of [7,8]) for(const fail of [false,true]) {
    const save=loadSave(),c=save.CONTRACT,sourceKey=sourceVersion===8?c.previousStorageKey:c.v7StorageKey;
    const raw=JSON.stringify(sourceVersion===8?v8State(7,"management",2):v7State(7,"management",2));
    const storage=new MemoryStorage({[sourceKey]:raw});if(fail)storage.failKey=c.storageKey;
    let memory=copy(save.migrateToCurrent(v8State(0,"home"))),recovery=false,replacements=0;
    const engine={clone:copy,getState:()=>copy(memory),normalizeState:state=>copy(state),replaceState:state=>{memory=copy(state);replacements++;},setRecoveryRequired:value=>{recovery=value;},setRuntimeMode(){},getChallengeDefinitions:()=>[]};
    const sandbox={navigator:{},location:{protocol:"file:"},EchoTownEngine:engine,EchoTownSave:loadSave({localStorage:storage}),EchoTownUI:{bind(){},render(){}},console};
    sandbox.window=sandbox;vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT,"development/game/modes.js"),"utf8"),sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT,"development/game/game.js"),"utf8"),sandbox);
    assert.equal(replacements,1);assert.equal(recovery,fail);assert.equal(storage.getItem(sourceKey),raw);
    if(fail){assert.equal(memory.currentLife,null);assert.equal(storage.getItem(c.storageKey),null);}
    else {assert.equal(memory.currentLife.round,7);assert.equal(JSON.parse(storage.getItem(c.storageKey)).version,9);assert.equal(memory.currentLife.projects.current,null);}
  }
});

module.exports={loadSave,MemoryStorage,v8State,v7State,historyEntry};
