"use strict";
const assert=require("node:assert/strict"), fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),test=require("node:test");
let ROOT=__dirname;while(!fs.existsSync(path.join(ROOT,"development/game/engine.js")))ROOT=path.dirname(ROOT);
class Storage{
 constructor(){this.data=new Map();this.fail=null;this.onWrite=null;}
 get length(){return this.data.size;}key(n){return [...this.data.keys()][n]??null;}
 getItem(k){return this.data.get(k)??null;}removeItem(k){this.data.delete(k);}
 setItem(k,v){if(this.fail?.(k,v))throw new Error("quota");this.data.set(k,String(v));this.onWrite?.(k,v);}
}
function dom(){
 const elements=new Map(),listeners=new Map(),downloads=[];let document;
 class Element{
  constructor(id){this.id=id;this.dataset={};this.textContent="";this.innerHTML="";this.value="";this.disabled=false;this.hidden=false;this.listeners={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}
  addEventListener(t,f){this.listeners[t]=f;}setAttribute(k,v){(this.attributes??={})[k]=String(v);}getAttribute(k){return this.attributes?.[k]??null;}removeAttribute(k){if(this.attributes)delete this.attributes[k];}focus(){document.activeElement=this;}scrollIntoView(){}getBoundingClientRect(){return{top:0,bottom:100};}getClientRects(){return[{}];}
  closest(selector){return selector==="[data-action]"?this:null;}querySelector(){return null;}querySelectorAll(){return[];}click(){if(this.download)downloads.push(this);}
  insertAdjacentHTML(position,html){this.innerHTML+=html;}
 }
 const element=s=>{if(!elements.has(s))elements.set(s,new Element(s));return elements.get(s);};
 document={body:element("body"),activeElement:null,querySelector:s=>s.includes("[open]")?null:element(s),querySelectorAll:()=>[],createElement:t=>new Element(t),addEventListener:(t,f)=>listeners.set(t,[...(listeners.get(t)||[]),f])};
 return{document,elements,listeners,downloads,element,click(action,data={}){const e=new Element("button");e.dataset={action,...data};for(const f of listeners.get("click")||[])f({target:e});}};
}
function runtime(storage=new Storage(),ui=false){
 const d=dom(),events=new Map(),readers=[],blobs=[],posts=[];let reloaded=0;
 class Reader{constructor(){readers.push(this);}readAsText(file){this.file=file;}finish(text){this.result=text;this.onload();}}
 const registration={waiting:{postMessage:v=>posts.push(v)},addEventListener(){}};
 const box={console,TextEncoder,Blob,Date,localStorage:storage,document:d.document,FileReader:Reader,URL:{createObjectURL(blob){blobs.push(blob);return"blob:test";},revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){},innerHeight:844,matchMedia:()=>({matches:false}),scrollTo(){},confirm:()=>true,CustomEvent:class{constructor(type){this.type=type;}},location:{protocol:"http:",reload(){reloaded++;}},navigator:{serviceWorker:{controller:{},register:()=>Promise.resolve(registration),addEventListener:(t,f)=>events.set("sw:"+t,f)}},addEventListener:(t,f)=>events.set(t,f),dispatchEvent:e=>events.get(e.type)?.(e)};
 box.window=box;vm.createContext(box);
 for(const name of ["content","strategy","projects","journey","save","engine","modes",...(ui?["audio","ui","game"]:[])]){
  const file=path.join(ROOT,"development/game/"+name+".js");vm.runInContext(fs.readFileSync(file,"utf8"),box,{filename:file});
 }
 return{box,e:box.EchoTownEngine,s:box.EchoTownSave,m:box.EchoTownModes,u:box.EchoTownUI,storage,d,readers,blobs,posts,events,reloaded:()=>reloaded};
}
const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r;};
function start(g){ok(g.m.boot());ok(g.e.dispatch({type:"START_LIFE"}));ok(g.m.persist());}
function index(g){return g.storage.getItem(g.s.MODE_CONTRACT.pointerKey);}
function corruptChallenge(g,missing=false){const pointer=JSON.parse(index(g)),key=pointer.refs["craft-start-v1"];if(missing)g.storage.removeItem(key);else g.storage.setItem(key,"broken challenge payload");return{key,raw:g.storage.getItem(key)};}

test("stale challenge window cannot overwrite main after a second window changes active mode",()=>{
 const a=runtime();start(a);const main=JSON.stringify(a.e.getState());ok(a.m.switchTo("craft-start-v1"));
 const b=runtime(a.storage);ok(b.m.boot());ok(b.m.switchTo("main"));const before=index(a),memory=JSON.stringify(a.e.getState());
 const result=a.m.switchTo("main");assert.equal(result.ok,false,"stale local mode must reject before interpreting its challenge memory as main");
 assert.equal(index(a),before);assert.equal(JSON.stringify(a.e.getState()),memory);assert.equal(JSON.stringify(ok(b.s.load()).state),main);
});

test("valid challenge backup restores corrupt or missing current reference without replacing last valid backup",()=>{
 for(const missing of [false,true]){
  const g=runtime();start(g);const main=JSON.stringify(g.e.getState());ok(g.m.switchTo("craft-start-v1"));const exported=g.m.serialize();
  g.storage.setItem(g.s.MODE_CONTRACT.challengeBackupKey,exported);const old=corruptChallenge(g,missing),pointer=index(g);
  const reboot=runtime(g.storage);assert.equal(reboot.m.boot().ok,false);assert.equal(reboot.e.getState().currentLife,null);
  ok(reboot.m.commitImport(ok(reboot.m.prepareImport(exported))));
  assert.equal(reboot.m.getSlotId(),"craft-start-v1");assert.equal(reboot.e.getState().currentLife.seed,277191004);
  assert.equal(g.storage.getItem(g.s.MODE_CONTRACT.challengeBackupKey),exported);assert.equal(g.storage.getItem(old.key),old.raw);
  const rawBackups=[...g.storage.data.entries()].filter(([key])=>key.startsWith(g.s.MODE_CONTRACT.recoveryBackupPrefixes["craft-start-v1"]));
  assert.equal(rawBackups.length,1);const saved=JSON.parse(rawBackups[0][1]);assert.equal(saved.sourceKey,old.key);assert.equal(saved.rawSource,old.raw);
  assert.notEqual(index(g),pointer);assert.equal(JSON.stringify(ok(g.s.load()).state),main);
  ok(reboot.m.persist());assert.equal(g.storage.getItem(old.key),old.raw,"later autosave cleanup must preserve recovery source");
 }
});

test("actual UI dispatch/export/clear and PWA update use challenge slot while preserving main",async()=>{
 const g=runtime(undefined,true);await Promise.resolve();ok(g.u.dispatch({type:"START_LIFE"}));
 const main=JSON.stringify(g.e.getState()),raw=g.storage.getItem(g.s.CONTRACT.storageKey);
 g.d.click("switch-mode",{slotId:"craft-start-v1"});assert.equal(g.m.getSlotId(),"craft-start-v1");
 ok(g.u.dispatch({type:"SKIP_OPPORTUNITY"}));ok(g.u.dispatch({type:"LIFE_ACTION",id:"routine-rest"}));
 assert.equal(JSON.stringify(ok(g.s.load()).state),main);assert.equal(g.storage.getItem(g.s.CONTRACT.storageKey),raw);
 g.d.click("export-save");assert.equal(JSON.parse(await g.blobs[0].text()).format,"echo-town-challenge");assert.match(g.d.downloads[0].download,/craft-start-v1/);
 const before=index(g);g.storage.fail=k=>k===g.s.MODE_CONTRACT.pointerKey;g.events.get("echo-town-apply-update")();assert.equal(g.posts.length,0);assert.equal(index(g),before);
 g.storage.fail=null;g.events.get("echo-town-apply-update")();assert.equal(g.posts.length,1);assert.equal(JSON.parse(index(g)).activeSlotId,"craft-start-v1");
 g.events.get("sw:controllerchange")();assert.equal(g.reloaded(),1);
 g.d.click("erase-save");assert.equal(g.m.getSlotId(),"craft-start-v1");assert.equal(g.e.getState().currentLife.age,6);assert.equal(JSON.stringify(ok(g.s.load()).state),main);
});

test("actual FileReader callback rejects mode change, failed import leaves memory/ref and success backs up latest memory",()=>{
 const g=runtime(undefined,true);ok(g.u.dispatch({type:"START_LIFE"}));const main=g.m.serialize();
 const input=g.d.element("#import-input");input.listeners.change({target:{files:[{size:Buffer.byteLength(main)}],value:""}});
 g.d.click("switch-mode",{slotId:"craft-start-v1"});const before=index(g),memory=JSON.stringify(g.e.getState());g.readers[0].finish(main);
 assert.equal(index(g),before);assert.equal(JSON.stringify(g.e.getState()),memory);assert.match(g.d.element("#toast").textContent,/切换模式/);
 const challenge=g.m.serialize();ok(g.u.dispatch({type:"SKIP_OPPORTUNITY"}));const progressed=JSON.stringify(g.e.getState()),pointer=index(g);
 input.listeners.change({target:{files:[{size:Buffer.byteLength(challenge)}],value:""}});g.storage.fail=k=>k===g.s.MODE_CONTRACT.pointerKey;g.readers[1].finish(challenge);
 assert.equal(index(g),pointer);assert.equal(JSON.stringify(g.e.getState()),progressed);assert.match(g.d.element("#toast").textContent,/导入失败/);
 g.storage.fail=null;input.listeners.change({target:{files:[{size:Buffer.byteLength(challenge)}],value:""}});g.readers[2].finish(challenge);
 assert.equal(g.e.getState().currentLife.opportunity.skipped,false);assert.equal(JSON.stringify(JSON.parse(g.storage.getItem(g.s.MODE_CONTRACT.challengeBackupKey)).state),progressed);
});

test("corrupt target, changed referenced source and invalid normalized target cannot commit mode switch",()=>{
 const g=runtime();start(g);ok(g.m.switchTo("craft-start-v1"));ok(g.m.switchTo("main"));const main=JSON.stringify(g.e.getState()),pointer=index(g);
 corruptChallenge(g);assert.equal(g.m.switchTo("craft-start-v1").ok,false);assert.equal(index(g),pointer);assert.equal(JSON.stringify(g.e.getState()),main);
 const fresh=runtime();start(fresh);let calls=0;
 const result=fresh.s.switchSlot("craft-start-v1",fresh.e.getState(),{expectedSourceSlotId:"main",defaultState:fresh.e.getState(),createTarget:id=>fresh.e.createChallengeState(id),normalize(state){calls++;if(calls===2)state.currentLife.seed=1;return fresh.e.normalizeState(state);}});
 assert.equal(result.ok,false);assert.equal(index(fresh),null);
});

module.exports={runtime,Storage};

test("recovery raw-backup/snapshot/pointer failure leaves original reference, bad source, valid backup and memory unchanged",()=>{
 for(const stage of ["raw","snapshot","pointer"]){
  const g=runtime();start(g);ok(g.m.switchTo("craft-start-v1"));const backup=g.m.serialize();g.storage.setItem(g.s.MODE_CONTRACT.challengeBackupKey,backup);
  const old=corruptChallenge(g),pointer=index(g),reboot=runtime(g.storage);assert.equal(reboot.m.boot().ok,false);const memory=JSON.stringify(reboot.e.getState());
  g.storage.fail=key=>stage==="raw"?key.startsWith(g.s.MODE_CONTRACT.recoveryBackupPrefixes["craft-start-v1"]):stage==="snapshot"?key.startsWith(g.s.MODE_CONTRACT.snapshotPrefix):key===g.s.MODE_CONTRACT.pointerKey;
  const result=reboot.m.commitImport(ok(reboot.m.prepareImport(backup)));assert.equal(result.ok,false);assert.equal(index(g),pointer);assert.equal(g.storage.getItem(old.key),old.raw);assert.equal(g.storage.getItem(g.s.MODE_CONTRACT.challengeBackupKey),backup);assert.equal(JSON.stringify(reboot.e.getState()),memory);
 }
});

test("recovery refuses an externally repaired slot and a raw source changed while making its backup",()=>{
 for(const external of ["before","during"]){
  const g=runtime();start(g);ok(g.m.switchTo("craft-start-v1"));const exported=g.m.serialize(),old=corruptChallenge(g),reboot=runtime(g.storage);assert.equal(reboot.m.boot().ok,false);const pointer=index(g),memory=JSON.stringify(reboot.e.getState());
  if(external==="before")g.storage.setItem(old.key,exported);
  else g.storage.onWrite=key=>{if(key.startsWith(g.s.MODE_CONTRACT.recoveryBackupPrefixes["craft-start-v1"]))g.storage.data.set(old.key,"changed by other tab");};
  const result=reboot.m.commitImport(ok(reboot.m.prepareImport(exported)));assert.equal(result.ok,false);assert.equal(result.code,"STORAGE_CHANGED");assert.equal(index(g),pointer);assert.equal(JSON.stringify(reboot.e.getState()),memory);
 }
});

test("switchSlot requires explicit source identity before factories, normalization or writes",()=>{
 const g=runtime();start(g);let called=0;const before=[...g.storage.data.entries()];
 for(const expectedSourceSlotId of [undefined,"invented","craft-start-v1"]){
  const result=g.s.switchSlot("craft-start-v1",g.e.getState(),{expectedSourceSlotId,normalize:state=>{called++;return state;},createTarget:()=>{called++;return g.e.createChallengeState("craft-start-v1");}});
  assert.equal(result.ok,false);assert.equal(called,0);assert.deepEqual([...g.storage.data.entries()],before);
 }
});

test("switching to a legacy main target migrates only the candidate and leaves v7/v8 exact source unchanged on failure/success",()=>{
 for(const version of [7,8]){
  const g=runtime(),main=g.e.createChallengeState("craft-start-v1");main.version=version;delete main.currentLife.projects;
  if(version===7){delete main.currentLife.strategy;delete main.currentLife.ledger;delete main.settings.volume;}
  const sourceKey=version===7?g.s.CONTRACT.v7StorageKey:g.s.CONTRACT.previousStorageKey,raw=JSON.stringify(main,null,2);
  g.storage.setItem(sourceKey,raw);g.storage.setItem(g.s.MODE_CONTRACT.challengeStorageKey,g.s.serializeSlot("craft-start-v1",g.e.createChallengeState("craft-start-v1")));
  g.storage.setItem(g.s.MODE_CONTRACT.pointerKey,JSON.stringify({version:1,activeSlotId:"craft-start-v1",refs:{main:null,"craft-start-v1":null}}));
  ok(g.m.boot());const before=JSON.stringify(g.e.getState()),pointer=index(g);
  g.storage.fail=k=>k===g.s.MODE_CONTRACT.pointerKey;assert.equal(g.m.switchTo("main").ok,false);assert.equal(index(g),pointer);assert.equal(JSON.stringify(g.e.getState()),before);assert.equal(g.storage.getItem(sourceKey),raw);
  g.storage.fail=null;ok(g.m.switchTo("main"));assert.equal(g.e.getState().version,9);assert.equal(g.storage.getItem(sourceKey),raw);assert.equal(g.e.getState().currentLife.seed,main.currentLife.seed);assert.equal(g.e.getState().currentLife.projects.current,null);
 }
});

test("main quick start preserves a valid chosen next-life preset and uses craft only for an untouched first visit",()=>{
 const first=runtime(undefined,true);first.d.click("quick-start");assert.equal(first.e.getState().currentLife.strategy.routeId,"craft");
 for(const routeId of ["study","community"]){
  const g=runtime(undefined,true);ok(g.u.dispatch({type:"SET_PRESET",routeId}));const chosen=g.e.getSetup();
  g.d.click("quick-start");const life=g.e.getState().currentLife;
  assert.equal(life.strategy.routeId,routeId);assert.equal(life.profileId,chosen.profileId);assert.equal(life.goalId,chosen.goalId);assert.deepEqual(g.e.getSetup(),chosen);
 }
});
