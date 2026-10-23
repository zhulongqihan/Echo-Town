"""Compare the v9 contract with executable modules and run import failure regressions."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def node(script: str, *arguments: Path):
    result = subprocess.run(["node", "-e", script, *map(str, arguments)], capture_output=True, text=True, encoding="utf-8", timeout=30)
    require(result.returncode == 0, f"实际运行校验失败: {result.stderr}")
    return json.loads(result.stdout)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--metadata-root", type=Path, help="仅覆盖存档契约所在根目录")
    args = parser.parse_args()
    root = args.root.resolve()
    metadata = (args.metadata_root or root).resolve()
    game = root / "development/game"
    contract = json.loads((metadata / "planning/technical/save-contract.json").read_text(encoding="utf-8-sig"))
    source = {name:(game / (name+".js")).read_text(encoding="utf-8-sig") for name in ("content","strategy","projects","journey","engine","save","modes","scene","journey-card","journey-ui","ui","game","sw")}
    actual = node(r'''
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const box={TextEncoder,Blob};box.window=box;vm.createContext(box);
for(const name of ['content','strategy','projects','journey','save'])vm.runInContext(fs.readFileSync(path.join(process.argv[1],name+'.js'),'utf8'),box,{filename:name+'.js',timeout:3000});
process.stdout.write(JSON.stringify({contract:box.EchoTownSave.CONTRACT,modes:box.EchoTownSave.MODE_CONTRACT,content:box.EchoTownContent,projects:box.EchoTownProjects.getDefinitions(),variants:box.EchoTownJourney.getVariantDefinitions()}));
''', game)
    runtime = actual["contract"]
    mapping = {"storage_key":"storageKey","previous_storage_key":"previousStorageKey","v7_storage_key":"v7StorageKey","backup_key":"backupKey","v8_backup_prefix":"v8BackupPrefix","v7_backup_prefix":"v7BackupPrefix","legacy_storage_keys":"legacyStorageKeys","save_version":"version","accepted_versions":"acceptedVersions","max_save_bytes":"maxBytes","max_import_bytes":"maxInputBytes"}
    for documented, executable in mapping.items():
        require(contract.get(documented) == runtime.get(executable), f"契约 {documented} 与实际 CONTRACT.{executable} 不一致")
    require(contract["schema_version"] == "5.1.0" and runtime["version"] == 9 and runtime["acceptedVersions"] == [7,8,9], "v7 / v8 → v9 契约版本错误")
    modes = contract["modeStorage"]
    for field in ("pointerKey","snapshotPrefix","challengeStorageKey","challengeBackupKey","recoveryBackupPrefixes"):
        require(modes[field] == actual["modes"][field], f"模式契约 {field} 与实际不符")
    for field, runtime_field in (("id","challengeId"),("rulesVersion","rulesVersion"),("seed","seed")):
        require(modes["challenge"][field] == actual["modes"][runtime_field], f"固定挑战起点 {field} 不符")
    require(modes["maxEnvelopeBytes"] == runtime["maxBytes"] and modes["maxInputBytes"] == runtime["maxInputBytes"], "挑战文件/信封容量不符")
    require(modes["switchRequiresExpectedSourceSlotId"] and modes["recoveryBackupsPreserveRawReferenceAndLastValidBackup"], "模式事务或恢复保护未声明")
    require(runtime["maxBytes"] == 512*1024 and runtime["maxInputBytes"] == 2*1024*1024, "存档或导入上限错误")
    require(len({runtime["storageKey"], runtime["previousStorageKey"], runtime["v7StorageKey"]}) == 3, "v9 / v8 / v7 必须隔离存储键")
    content = actual["content"]
    for field, group in (("profile_values","profiles"),("goal_values","goals")):
        require(contract[field] == [item["id"] for item in content[group]], f"{field} 与内容不一致")
    require(contract["talent_values"] == [item["id"] for item in content["talents"]+content["talentDraftPool"]], "天赋契约不完整")
    life = contract["current_life"]
    require(life["maxRounds"] == content["maxRounds"] == 23 and life["actionPointsPerRound"] == content["actionPointsPerRound"] == 2 and life["selectedLegacies_max"] == content["maxLegacyChoices"] == 3, "人生流程契约错误")
    require(life["resources"]["money"]["max"] == 9007199254740991, "现金仍有旧 100 上限")
    for group in ("skills","relationships","characters","interests"):
        require(life[group] == list(content[group]), f"{group} 契约与内容不一致")
    require(life["strategy"]["goals_max"] == 15 and life["strategy"]["route_values"] == [route["id"] for route in content["strategy"]["routes"]], "策略成果契约错误")
    require(life["projects"]["ids"] == [item["id"] for item in actual["projects"]], "三项目存档清单与真实定义不符")
    require(life["projects"]["final_fields_by_id"] == {item["id"]:item["finalField"] for item in actual["projects"]}, "项目最终能力字段不匹配")
    require(contract["journeyVariantIds"] == [item["id"] for item in actual["variants"]], "事件版本存档清单不匹配")
    require(contract["world"]["history_max"] == 40 and contract["import_structural_limits"]["world_history"] == 40, "历史契约必须保留 40 世")
    policies = contract["import_policy"]
    for name in ("parse_before_replace","reject_keeps_current_save","validate_before_persist","capacity_check_before_replace","backup_before_main_write","replace_memory_after_commit","legacy_storage_preserved","v7_migrates_to_v8","v8_migrates_to_v9","migration_idempotent","export_compact_json","clear_marker_prevents_v7_resurrection","clear_marker_prevents_v8_resurrection","newest_corrupt_key_blocks_fallback","projects_require_actual_evidence"):
        require(policies.get(name) is True, f"导入契约未声明 {name}")
    require(policies.get("execute_imported_markup") is False, "导入内容不得当作可执行标记")
    required = {"engine":("function normalizeState(saved)","function makeLifeSeed(generation, profileId, talentId, goalId, legacyIds)","function confirmLegacies()","function getLegacyCandidates","function unlockAchievements","function resolveLifeAction","function buyItem","function settleLivingCost"),"ui":("function importSave(file)","function exportSave()","MODES.prepareImport(","MODES.commitImport(","MODES.remove("),"modes":("SAVE.persistSlot(","SAVE.switchSlot(","expectedSourceSlotId: activeSlot","ENGINE.replaceState("),"save":("function prepareImport(text","function commitImport(prepared","function persist(state")}
    for name, markers in required.items():
        for marker in markers: require(marker in source[name], f"{name}.js 缺少边界入口 {marker}")
    require(not re.search(r"\bSAVE\.(?:persist|commitImport|remove|serialize|prepareImport)\s*\(", source["ui"]), "UI仍有绕过当前槽的旧主档调用")
    business = "\n".join(source[name] for name in source if name != "sw")
    require(not re.search(r"Math\s*\.\s*random|\bfetch\s*\(|\b(?:WebSocket|XMLHttpRequest)\b", business), "业务模块出现联网或非确定性随机")
    # Parse actual SW declarations in a VM; optional media must not become a hard install dependency.
    service_worker = node(r'''
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const listeners={},deleted=[],shellAdds=[],mediaAdds=[];let claimed=false;
 const cache={addAll:async paths=>shellAdds.push(...paths),add:async path=>{mediaAdds.push(path);throw Error('missing media');},match:async key=>key==='./index.html'?new Response('offline-page'):undefined,put:async()=>{}};
 const box={URL,Response,fetch:async()=>{throw Error('offline');},caches:{open:async()=>cache,keys:async()=>[box.snapshot.CACHE_NAME,'echo-town-prior-build','echo-town-old','other-project-cache'],delete:async key=>deleted.push(key)},self:{location:{origin:'https://echo.example'},clients:{claim:async()=>{claimed=true;}},skipWaiting:()=>{},addEventListener:(name,callback)=>listeners[name]=callback}};
 vm.createContext(box);vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+'\nglobalThis.snapshot={CACHE_NAME,APP_SHELL,MEDIA};',box,{timeout:3000});
 let work;listeners.install({waitUntil:p=>work=p});await work;assert.equal(mediaAdds.length,10);assert.ok(shellAdds.includes('./strategy.js'));assert.ok(shellAdds.includes('./projects.js'));assert.ok(shellAdds.includes('./scene.js'));
 listeners.activate({waitUntil:p=>work=p});await work;assert.deepEqual(deleted,['echo-town-prior-build','echo-town-old']);assert.equal(claimed,true);
 const request=mode=>({method:'GET',url:'https://echo.example/missing',mode});
 listeners.fetch({request:request('no-cors'),respondWith:p=>work=p});assert.equal((await work).status,503);
 listeners.fetch({request:request('navigate'),respondWith:p=>work=p});assert.equal(await (await work).text(),'offline-page');
 process.stdout.write(JSON.stringify(box.snapshot));
})().catch(error=>{console.error(error);process.exit(1);});
''', game / "sw.js")
    expected_shell = ["./","./index.html","./styles.css","./journey.css","./content.js","./strategy.js","./projects.js","./journey.js","./save.js","./engine.js","./modes.js","./audio.js","./scene.js","./journey-card.js","./journey-ui.js","./ui.js","./game.js","./manifest.webmanifest","./favicon.svg","./icon-192.svg","./icon-512.svg"]
    require(service_worker["APP_SHELL"] == expected_shell, "Service Worker 核心应用壳缺失或顺序变化")
    media = ["./"+entry["src"] for entries in content["media"].values() for entry in entries.values()]
    require(service_worker["MEDIA"] == media, "离线媒体清单与实际内容不一致")
    for asset in service_worker["APP_SHELL"] + service_worker["MEDIA"]:
        local = (game / asset).resolve()
        require(local.is_relative_to(game) and local.exists() and not re.match(r"https?://", asset), f"应用壳本地资源不存在: {asset}")
    # These tests exercise quota/backup failures, bad schemas, phase-preserving migration,
    # tombstones, 40-life capacity and immutable in-memory state against the shipped save.js.
    suites = [root / ("development/tests/"+name+".test.js") for name in ("save.strategy","runtime.migration","save.v9","save.modes","mode-integration","projects","projects-routes","journey","journey-review-regressions")]
    require(all(path.is_file() for path in suites), "缺少真实存档事务或迁移回归测试")
    tested = subprocess.run(["node","--test",*map(str,suites)], cwd=root, capture_output=True, text=True, encoding="utf-8", timeout=120)
    require(tested.returncode == 0, f"存档事务/迁移回归失败:\n{tested.stdout}\n{tested.stderr}")
    print("status ok")
    print(f"schema_version {contract['schema_version']}\nsave_version {runtime['version']}\naccepted_versions 7,8,9\nmax_save_bytes {runtime['maxBytes']}\nmax_import_bytes {runtime['maxInputBytes']}\nimport_transaction_regressions passed\nservice_worker_namespace_and_fallback passed\noptional_media_failure passed\nruntime_network_calls false\nruntime_randomness false")
    for line in tested.stdout.splitlines():
        if line.startswith(("# tests ","# pass ","# fail ","ℹ tests ","ℹ pass ","ℹ fail ")): print(line.replace("ℹ", "#"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print(f"ERROR: {error}")
        sys.exit(1)
