"""Check classic-script module boundaries and executable public interfaces."""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag != "script": return
        fields = dict(attrs)
        require(fields.get("type") != "module", "双击入口不能依赖 module 跨文件加载")
        require("async" not in fields, "业务脚本不能异步乱序加载")
        if "src" in fields: self.sources.append(fields["src"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    root = args.root.resolve()
    game = root / "development/game"
    names = ["content", "strategy", "projects", "journey", "save", "engine", "modes", "audio", "scene", "journey-card", "journey-ui", "ui", "game"]
    source = {name:(game / (name+".js")).read_text(encoding="utf-8-sig") for name in names}
    markers = {
        "engine":("global.EchoTownEngine", "function dispatch(command", "function normalizeState(saved)"),
        "strategy":("global.EchoTownStrategy",),
        "projects":("global.EchoTownProjects",),
        "journey":("global.EchoTownJourney", "function resolveEventAction", "function getReview"),
        "modes":("global.EchoTownModes", "function boot()", "function switchTo", "function commitImport"),
        "journey-card":("global.EchoTownJourneyCard", "function createCanvas", "async function download"),
        "journey-ui":("global.EchoTownJourneyUI",),
        "scene":("global.EchoTownScene",),
        "save":("global.EchoTownSave", "function load(options", "function persist(state", "function prepareImport(text", "function commitImport(prepared"),
        "ui":("global.EchoTownUI", "function render()", "function bind()", "document.addEventListener"),
        "game":("global.EchoTown =", "global.EchoTownUI.bind()", "global.EchoTownUI.render()"),
    }
    for name, expected in markers.items():
        for marker in expected: require(marker in source[name], f"{name}.js 缺少模块入口 {marker}")
    forbidden = (r"\bdocument\b",r"\blocalStorage\b",r"\bEchoTownAudio\b",r"Math\s*\.\s*random",r"\bfetch\s*\(",r"\bWebSocket\b",r"\bXMLHttpRequest\b")
    for name in ("engine","strategy","projects","journey","modes"):
        for pattern in forbidden: require(not re.search(pattern, source[name]), f"{name}.js 越过规则边界: {pattern}")
    for name, text in source.items():
        require(not re.search(r"Math\s*\.\s*random|\bfetch\s*\(|\b(?:WebSocket|XMLHttpRequest)\b", text), f"{name}.js 含非确定性/联网调用")
        if name != "save": require(not re.search(r"\blocalStorage\b", text), f"{name}.js 绕过存档模块访问 localStorage")
    html = Scripts()
    html.feed((game / "index.html").read_text(encoding="utf-8-sig"))
    require(html.sources == [name+".js" for name in names], "规则、存档、引擎、模式和界面脚本必须按已声明依赖顺序各加载一次")
    script = r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={TextEncoder,Blob,console};box.window=box;vm.createContext(box);
for(const name of ['content','strategy','projects','journey','save','engine','modes'])vm.runInContext(fs.readFileSync(path.join(process.argv[1],name+'.js'),'utf8'),box,{filename:name+'.js',timeout:3000});
const e=box.EchoTownEngine,s=box.EchoTownSave;
for(const key of ['dispatch','getState','getSetup','replaceState','previewAction','getLifePhase','getStageGoals','getWishStatus','getAvailableEventActions','getJobs','getLifeActions','getProjectView','getChallengeDefinitions','createChallengeState','setRuntimeMode']) assert.equal(typeof e[key],'function',key);
for(const key of ['prepareImport','commitImport','load','persist','serialize','validateState','migrateV7ToV8','migrateV8ToV9','migrateToCurrent','loadActive','commitLoad','loadSlot','persistSlot','serializeSlot','prepareSlotImport','commitSlotImport','switchSlot','removeSlot']) assert.equal(typeof s[key],'function',key);
for(const key of ['normalize','accept','withdraw','record','settle','isUnlocked','getView','getJobDefinition','getDefinitions','getJobDefinitions','getLifeActionDefinitions']) assert.equal(typeof box.EchoTownProjects[key],'function',key);
for(const key of ['getVariantDefinitions','resolveEventAction','getStageDecisions','getNpcTimeline','getWorldView','getReview']) assert.equal(typeof box.EchoTownJourney[key],'function',key);
for(const key of ['initLife','record','getGoals','settleStage','getWishStatus','getOutcome']) assert.equal(typeof box.EchoTownStrategy[key],'function',key);
const before=JSON.stringify(e.getState());const copy=e.getState();copy.world.completedLives=999;assert.equal(JSON.stringify(e.getState()),before,'getState must be isolated');
const challenge=e.createChallengeState('craft-start-v1');assert.equal(challenge.currentLife.seed,277191004);assert.equal(JSON.stringify(e.getState()),before,'detached challenge factory must preserve main memory');
const setup=JSON.stringify(e.getSetup());const draft=e.getSetup();draft.routeId='invalid';assert.equal(JSON.stringify(e.getSetup()),setup,'getSetup must be isolated');
const result=e.dispatch({type:'UNKNOWN_VALIDATION_COMMAND'});assert.equal(result.ok,false);assert.equal(typeof result.error.code,'string');assert.equal(typeof result.error.messageKey,'string');assert.equal(typeof result.state,'object');assert.ok(Array.isArray(result.events));
assert.equal(JSON.stringify(e.getState()),before,'rejected command must preserve state');
process.stdout.write(JSON.stringify({namespaces:true,dispatch:true,readonly:true}));
'''
    result = subprocess.run(["node","-e",script,str(game)], capture_output=True, text=True, encoding="utf-8", timeout=15)
    require(result.returncode == 0, f"公共接口运行检查失败: {result.stderr}")
    require(all(json.loads(result.stdout).values()), "运行接口检查未通过")
    print("status ok\nengine_dom_storage_audio_dependencies false\nstrategy_dom_storage_audio_dependencies false\nscript_order passed\nnamespace_contract passed\nreadonly_snapshots passed\ndispatch_contract passed\nruntime_network_calls false\nruntime_randomness false")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print(f"ERROR: {error}")
        sys.exit(1)
