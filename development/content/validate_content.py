"""Validate the effective content, optional projects and their review records."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys


def fail(message: str) -> None:
    raise ValueError(message)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def ids(entries):
    values = list(entries) if isinstance(entries, dict) else [entry["id"] for entry in entries]
    require(len(values) == len(set(values)), "ID 存在重复")
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--metadata-root", type=Path, help="仅覆盖清单与审阅文件所在根目录；代码仍取 --root")
    parser.add_argument("--allow-pending-review", action="store_true", help="实施中检查内容结构；不会把 pending 视为已审阅")
    args = parser.parse_args()
    root = args.root.resolve()
    metadata = (args.metadata_root or root).resolve()
    game = root / "development/game"
    manifest = json.loads((metadata / "development/content/content-manifest.json").read_text(encoding="utf-8-sig"))
    review = json.loads((metadata / "development/content/content-review.json").read_text(encoding="utf-8-sig"))
    source = {name: (game / f"{name}.js").read_text(encoding="utf-8-sig") for name in ("content", "strategy", "projects", "journey", "engine")}
    script = r'''
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const box={}; box.window=box; vm.createContext(box);
for(const name of ['content','strategy','projects','journey']) {
  vm.runInContext(fs.readFileSync(path.join(process.argv[1],name+'.js'),'utf8'),box,{filename:name+'.js',timeout:3000});
  if(name==='content') box.base=JSON.parse(JSON.stringify(box.EchoTownContent));
}
process.stdout.write(JSON.stringify({base:box.base,effective:box.EchoTownContent,projects:box.EchoTownProjects.getDefinitions(),projectJobs:box.EchoTownProjects.getJobDefinitions(),projectActions:box.EchoTownProjects.getLifeActionDefinitions(),variants:box.EchoTownJourney.getVariantDefinitions()}));
'''
    result = subprocess.run(["node", "-e", script, str(game)], capture_output=True, text=True, encoding="utf-8", timeout=15)
    require(result.returncode == 0, f"真实内容加载失败: {result.stderr}")
    loaded = json.loads(result.stdout)
    base, content = loaded["base"], loaded["effective"]
    require(content["version"] == manifest["content_version"] == review["content_version"] == review["review_version"] == "6.2.0", "内容版本未统一到 6.2.0")
    require(review.get("baseline_no_ai") is True and review.get("runtime_ai") is False, "缺少运行时无 AI 的审阅声明")
    rules = manifest["rules"]
    expected = {"life_rounds":23,"stages":5,"actions_total":107,"base_actions_total":69,"added_actions_total":38,"actions_min_per_round":4,"conservative_actions":23,"life_actions":7,"jobs":6,"items":6,"moments":12,"action_points_per_round":2,"profiles":5,"talents":8,"goals":6,"legacy_choices":3,"legacy_count":16,"achievements":16,"secrets":11,"opportunities":18,"interests":12,"characters":8,"strategy_routes":3,"stage_goals":15,"event_chains":3,"image_count":10,"max_image_bytes":5*1024*1024}
    for key, value in expected.items():
        require(rules.get(key) == value, f"规则 {key} 应为 {value}")
    require((rules.get("projects"), rules.get("project_jobs"), rules.get("project_life_actions")) == (3, 2, 1), "必须包含三项目、两份工作与一项生活安排")
    require(manifest["project_job_ids"] == ids(loaded["projectJobs"]) and manifest["project_life_action_ids"] == ids(loaded["projectActions"]), "项目解锁行动与真实模块不一致")
    actual_projects = [{"id":entry["id"],"route_id":entry["routeId"],"stage_id":"youth","entry_age":19,"deadline_age":28,"step_ages":[19,21,24],"required_ap":sum(min(choice["ap"] for choice in entry["steps"][step]) for step in ("firstWork","preparation","returnWork")),"total_stage_ap":8,"unlock_"+("job_id" if entry["unlockKind"] == "job" else "action_id"):entry["unlockId"]} for entry in loaded["projects"]]
    require(manifest["projects"] == actual_projects, "三项目实际步骤与预算清单不符")
    require([job["points"] for job in loaded["projectJobs"]] == [2,1] and [job["effect"]["resources"] for job in loaded["projectJobs"]] == [{"money":14,"energy":-4,"pressure":2},{"money":6,"energy":-2,"pressure":1}], "两份项目工作真实收益/成本不符")
    care = loaded["projectActions"][0]
    require(care["points"] == 1 and care["effect"]["resources"] == {"money":-3,"energy":2,"pressure":-1} and care["effect"]["relationships"] == {"family":1,"child":1}, "协作照料的成本/家庭与晚辈收益不符")
    require(manifest["journey"]["variant_ids"] == ids(loaded["variants"]) and len(loaded["variants"]) == 3, "过去失败对应的三种真实事件版本清单不符")
    for variant in loaded["variants"]:
        source_round = next((round for round in content["rounds"] if round["id"] == variant["sourceRoundId"]), None)
        target_round = next((round for round in content["rounds"] if round["id"] == variant["targetRoundId"]), None)
        require(source_round and target_round and variant["sourceId"] in ids(source_round["actions"]) and variant["actionId"] in ids(target_round["actions"]), "事件版本引用的真实前因/后果不存在")
    require(rules.get("runtime_generation") is False and rules.get("randomness") == "deterministic-seed-only", "必须使用本地确定性内容")
    require(content["maxRounds"] == 23 and content["actionPointsPerRound"] == 2 and content["maxLegacyChoices"] == 3, "运行时人生规模与行动点不符")
    groups = {"profiles":"profiles","talents":"talents","talent_draft_ids":"talentDraftPool","goals":"goals","legacy_ids":"legacies","achievement_ids":"achievements","secret_ids":"secrets","life_action_ids":"lifeActions","job_ids":"jobs","item_ids":"items","moment_ids":"moments","opportunity_ids":"opportunities","interest_ids":"interests","character_ids":"characters"}
    for field, group in groups.items():
        require(manifest[field] == ids(content[group]), f"清单 {field} 与实际内容不一致")
    counts = {"profiles":"profiles","talents":"talents","goals":"goals","legacy_count":"legacies","achievements":"achievements","secrets":"secrets","life_actions":"lifeActions","jobs":"jobs","items":"items","moments":"moments","opportunities":"opportunities","interests":"interests","characters":"characters","stages":"stages"}
    for key, group in counts.items():
        require(len(content[group]) == rules[key], f"实际 {group} 数量不符合规则")
    stage_ids = ids(content["stages"])
    round_ids = ids(content["rounds"])
    require(len(round_ids) == 23 and manifest["stages"] == content["stages"], "五阶段或 23 节点清单不匹配")
    require(manifest["stage_art_ids"] == stage_ids, "阶段图没有准确覆盖全部阶段")
    require(ids(manifest["rounds"]) == round_ids, "节点清单顺序不一致")
    all_actions = []
    event_by_id = {}
    action_round = {}
    for actual, authored, listed in zip(content["rounds"], base["rounds"], manifest["rounds"]):
        action_ids = ids(actual["actions"])
        base_ids = ids(authored["actions"])
        added = [key for key in action_ids if key not in base_ids]
        require(len(base_ids) == 3 and len(action_ids) >= 4, f"{actual['id']} 缺少基础选择或保守选项")
        require(listed["action_ids"] == action_ids and listed["base_action_ids"] == base_ids and listed["added_action_ids"] == added, f"{actual['id']} 行动清单未对应有效内容")
        require(listed["age"] == actual["age"] and listed["stage"] == actual["stage"] and actual["stage"] in stage_ids, "节点年龄/阶段引用不一致")
        conservative = [action for action in actual["actions"] if action.get("strategy", {}).get("conservative")]
        require(len(conservative) == 1, f"{actual['id']} 必须有一个保守选项")
        safe = conservative[0]
        require(safe["id"] == listed["conservative_action_id"] and not safe["requires"] and not safe["effect"] and not safe["test"], f"{actual['id']} 保守选项存在成本/检定/前置")
        for action in actual["actions"]:
            require(all(isinstance(action.get(field), str) and action[field] for field in ("id","label","detail","cost","preview","result","future")), f"{action.get('id')} 缺少玩家可读说明")
            event_by_id[action["id"]] = action
            action_round[action["id"]] = actual
        all_actions.extend(action_ids)
    require(len(all_actions) == len(set(all_actions)) == 107, "有效事件行动数量/唯一性不正确")
    strategy = content["strategy"]
    require(manifest["strategy"]["route_ids"] == ids(strategy["routes"]) and len(strategy["routes"]) == 3, "路线不一致")
    require(manifest["strategy"]["stage_goal_ids"] == ids(strategy["goals"]) and len(strategy["goals"]) == 15, "阶段成果不一致")
    require(manifest["strategy"]["chains"] == strategy["chains"] and len(strategy["chains"]) == 3, "事件链清单不一致")
    for goal in strategy["goals"]:
        require(goal["id"] == goal["routeId"]+":"+goal["stageId"] and goal["routeId"] in ids(strategy["routes"]) and goal["stageId"] in stage_ids, "阶段目标引用不正确")
        require(bool(goal["conditions"]), f"{goal['id']} 缺少成果条件")
    for chain in strategy["chains"]:
        require(chain["routeId"] in ids(strategy["routes"]), "事件链路线不存在")
        require(len(set(chain["actionIds"])) >= 3, "事件链少于三次行动")
        require([action_round[key]["age"] for key in chain["actionIds"]] == chain["ages"] and len(set(chain["ages"])) >= 3, "事件链没有跨至少三个节点")
        last = event_by_id[chain["actionIds"][-1]]
        require(last["test"] and last["test"].get("success") != last["test"].get("failure"), "事件链缺少两种实际后果")
    collections = {group:set(ids(content[group])) for group in groups.values()}
    collections["event"] = set(all_actions)
    collections["life"] = collections["lifeActions"] | set(ids(loaded["projectActions"]))
    collections["job"] = collections["jobs"] | set(ids(loaded["projectJobs"]))
    collections["opportunity"] = collections["opportunities"]
    maps = {key:set(content[key]) for key in ("resources","skills","relationships","interests","characters","buildAttributes")}
    maps["town"] = set(content["world"])
    maps["maxResources"] = {"energy"}
    maps["attributes"] = maps["buildAttributes"]
    known_types = {"any","all","skill","resource","relationship","world","flag","secret","legacy","life-action","event","job","bill","job-change","anyStat","statCount","count","lifeStat","countFlags","lifeCount","stat","proof","evidence","relation-count","reserve","ordered-proof","project"}
    def refs(values, allowed, location):
        require(isinstance(values, list) and all(value in allowed for value in values), f"{location} 包含未知 ID: {values}")
    def walk(value, location="content"):
        if isinstance(value, list):
            for i, item in enumerate(value): walk(item, f"{location}[{i}]")
            return
        if not isinstance(value, dict): return
        typ = value.get("type")
        if typ is not None: require(typ in known_types, f"{location} 使用未知条件类型 {typ}")
        if typ == "world": require(value["key"] in maps["town"] | {"completedLives"}, f"{location} 小镇属性不存在")
        if typ == "project": require(value["id"] in ids(loaded["projects"]), f"{location} 项目引用不存在")
        if typ in ("any", "all"):
            children = value.get("conditions", value.get("requirements"))
            require(isinstance(children, list) and bool(children), f"{location} 组合条件不能为空")
        if "stageId" in value: require(value["stageId"] in stage_ids, f"{location} 阶段引用不存在")
        if "routeId" in value: require(value["routeId"] in ids(strategy["routes"]), f"{location} 路线引用不存在")
        if "chainId" in value: require(value["chainId"] in ids(strategy["chains"]), f"{location} 事件链引用不存在")
        if typ in ("proof", "evidence"):
            refs(value["ids"], collections.get(value.get("kind", "event"), set()), location)
        if typ == "ordered-proof":
            refs(value["firstIds"], collections["event"], location)
            refs(value["nextIds"], collections[value["nextKind"]], location)
        if typ in ("event", "life-action", "job", "legacy", "secret"):
            field, group = {"event":("actionId","event"),"life-action":("actionId","life"),"job":("jobId","job"),"legacy":("id","legacies"),"secret":("key","secrets")}[typ]
            refs([value[field]], collections[group], location)
        if typ in ("skill","resource","relationship"):
            group = {"skill":"skills","resource":"resources","relationship":"relationships"}[typ]
            require(value["key"] in maps[group], f"{location} 引用了未知属性")
        if typ in ("stat","lifeStat","anyStat","statCount"):
            require(value.get("group") in maps or value.get("group") == "cashflow", f"{location} 引用了未知统计组")
            if "key" in value: require(value["key"] in maps.get(value["group"], {"income","expenses","debt"}), f"{location} 引用了未知统计项")
        for key in ("effect", "success", "failure"):
            effect = value.get(key)
            if not isinstance(effect, dict): continue
            for group in maps:
                if group in effect: require(set(effect[group]) <= maps[group], f"{location}.{key}.{group} 引用不存在")
            if "items" in effect: refs(effect["items"], collections["items"], location)
        if isinstance(value.get("test"), dict): require(value["test"].get("skill") in maps["skills"], f"{location} 检定技能不存在")
        if "goalPoints" in value: require(set(value["goalPoints"]) <= collections["goals"], f"{location} 愿望引用不存在")
        for key, item in value.items(): walk(item, f"{location}.{key}")
    walk(content)
    walk(loaded["projectJobs"], "project_jobs")
    walk(loaded["projectActions"], "project_life_actions")
    for key, character in content["characters"].items(): require(character["relation"] in maps["relationships"], f"角色 {key} 的关系不存在")
    for key, interest in content["interests"].items(): require(interest["skill"] in maps["skills"], f"兴趣 {key} 的技能不存在")
    for goal in content["goals"]: refs(goal["preferred"], set().union(*maps.values()), f"愿望 {goal['id']}")
    for stage in content["stageFocus"]:
        require(stage in stage_ids, f"阶段重点 {stage} 不存在")
    require(set(content["sceneClues"]) <= set(round_ids), "场景线索引用未知节点")
    clues = [clue["id"] for entries in content["sceneClues"].values() for clue in entries]
    require(len(clues) == len(set(clues)), "场景线索 ID 重复")
    media = content["media"]
    require(list(media["stageArt"]) == stage_ids and set(media["eventArt"]) <= set(round_ids), "插图引用阶段/事件不存在")
    images = [entry["src"] for entries in media.values() for entry in entries.values()]
    require(images == manifest["media"]["image_paths"] and len(set(images)) == 10, "十张有效插图与清单不一致")
    image_bytes = 0
    for name in images:
        path = (game / name).resolve()
        require(path.is_relative_to(game.resolve()) and path.is_file() and path.suffix == ".webp", f"图片不是本地 WebP: {name}")
        blob = path.read_bytes()
        require(blob[:4] == b"RIFF" and blob[8:12] == b"WEBP", f"图片格式错误: {name}")
        image_bytes += len(blob)
    require(image_bytes <= rules["max_image_bytes"], "有效交付图片超过 5 MiB")
    for name in manifest["runtime_files"]:
        path = (root / name).resolve()
        require(path.is_relative_to(root) and path.is_file(), f"运行文件不存在: {name}")
    for marker in ("function getLegacyCandidates", "function confirmLegacies", "function unlockAchievements", "function requirementMet"):
        require(marker in source["engine"], f"引擎缺少入口 {marker}")
    require(not re.search(r"Math\s*\.\s*random|\bfetch\s*\(|\b(?:WebSocket|XMLHttpRequest)\b", "\n".join(source.values())), "内容或规则出现非确定性/联网依赖")
    pending = []
    def reviewed(entry, location):
        require(entry.get("owner") == "A00" and entry.get("reviewer") == "A00", f"{location} 不能借用旧 A04 审阅结论")
        status = entry.get("status")
        require(status in ("pending", "approved"), f"{location} 审阅状态无效")
        if status != "approved": pending.append(location)
    require(ids(review["assets"]) == round_ids, "审阅没有覆盖每个节点")
    for entry, listed in zip(review["assets"], manifest["rounds"]):
        require(entry["action_ids"] == listed["action_ids"], "审阅的行动范围与实际不一致")
        reviewed(entry, entry["id"])
    for field, group in (("life_actions","lifeActions"),("jobs","jobs"),("items","items"),("moments","moments")):
        require(ids(review[field]) == ids(content[group]), f"审阅没有覆盖 {field}")
        for entry in review[field]: reviewed(entry, entry["id"])
    require(review["strategy"]["route_ids"] == ids(strategy["routes"]) and review["strategy"]["stage_goal_ids"] == ids(strategy["goals"]) and review["strategy"]["chain_ids"] == ids(strategy["chains"]), "策略审阅范围不完整")
    reviewed(review["strategy"], "strategy")
    require(review["projects"]["ids"] == ids(loaded["projects"]) and review["projects"]["job_ids"] == ids(loaded["projectJobs"]) and review["projects"]["life_action_ids"] == ids(loaded["projectActions"]), "项目/工作/照料审阅范围不完整")
    reviewed(review["projects"], "projects")
    require(review["journey"]["variant_ids"] == ids(loaded["variants"]) and review["journey"]["npc_ids"] == manifest["journey"]["npc_ids"], "人物与事件版本审阅范围不完整")
    reviewed(review["journey"], "journey")
    for key in ("opportunities","interests","characters"):
        entry = review["reference_richness_p2"][key]
        require(entry["count"] == len(content[key]), f"{key} 审阅范围错误")
        reviewed(entry, key)
    require(review["media"]["stage_art"] == stage_ids and review["media"]["event_art"] == list(media["eventArt"]) and review["media"]["image_paths"] == images and review["media"]["audio"] == "local-web-audio-synth", "媒体审阅范围不完整")
    reviewed(review["media"], "media")
    require(bool(review.get("checks")), "审阅检查清单不能为空")
    for name, status in review["checks"].items():
        require(status in ("pending", "passed"), f"审阅检查 {name} 的状态无效")
        if status != "passed": pending.append(name)
    if pending and not args.allow_pending_review:
        fail(f"机械内容检查通过，但有 {len(pending)} 项最终审阅未完成；必须实际审阅后更新记录。实施中可显式使用 --allow-pending-review")
    if not pending: require(bool(review.get("reviewed_at")), "已批准审阅必须有实际审阅时间")
    print("status structural-ok-review-pending" if pending else "status ok")
    print(f"content_version {content['version']}\nrounds 23\nactions 107\nconservative_actions 23\nstage_goals 15\nevent_chains 3\nprojects 3\nproject_jobs 2\nproject_life_actions 1\nevent_variants 3\nimage_bytes {image_bytes}\nreview_pending {len(pending)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print(f"ERROR: {error}")
        sys.exit(1)
