"""Validate the authored multi-life content manifest and its review record."""

from __future__ import annotations

import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "development" / "content" / "content-manifest.json"
REVIEW_PATH = ROOT / "development" / "content" / "content-review.json"
CONTENT_PATH = ROOT / "development" / "game" / "content.js"
GAME_PATH = ROOT / "development" / "game" / "game.js"


def fail(message: str) -> None:
    print(f"ERROR: {message}")
    raise SystemExit(1)


def unique(values: list[str], label: str) -> None:
    if len(values) != len(set(values)):
        fail(f"{label}存在重复ID")


def main() -> int:
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        review = json.loads(REVIEW_PATH.read_text(encoding="utf-8"))
        content = CONTENT_PATH.read_text(encoding="utf-8")
        game = GAME_PATH.read_text(encoding="utf-8")
    except (OSError, json.JSONDecodeError) as error:
        fail(f"无法读取内容清单或运行时代码: {error}")

    rules = manifest.get("rules", {})
    expected_rules = {
        "life_rounds": 23,
        "stages": 5,
        "actions_per_round": 3,
        "actions_total": 69,
        "life_actions": 7,
        "jobs": 6,
        "items": 6,
        "moments": 12,
        "action_points_per_round": 3,
        "profiles": 5,
        "talents": 8,
        "goals": 6,
        "legacy_choices": 3,
        "legacy_count": 16,
        "achievements": 16,
        "secrets": 10,
    }
    for key, expected in expected_rules.items():
        if rules.get(key) != expected:
            fail(f"规则 {key} 应为 {expected}")

    if manifest.get("content_version") != "5.0.0" or review.get("content_version") != "5.0.0":
        fail("内容版本没有统一到5.0.0")
    if review.get("review_version") != "5.0.0":
        fail("内容审阅记录版本不正确")
    if review.get("baseline_no_ai") is not True or review.get("runtime_ai") is not False:
        fail("内容审阅没有明确运行时无AI")

    profiles = manifest.get("profiles", [])
    talents = manifest.get("talents", [])
    goals = manifest.get("goals", [])
    rounds = manifest.get("rounds", [])
    legacy_ids = manifest.get("legacy_ids", [])
    achievement_ids = manifest.get("achievement_ids", [])
    secret_ids = manifest.get("secret_ids", [])
    life_action_ids = manifest.get("life_action_ids", [])
    job_ids = manifest.get("job_ids", [])
    item_ids = manifest.get("item_ids", [])
    moment_ids = manifest.get("moment_ids", [])
    stage_art_ids = manifest.get("stage_art_ids", [])
    unique(profiles, "人生起点")
    unique(talents, "天赋")
    unique(goals, "人生愿望")
    unique([item.get("id") for item in rounds], "成长节点")
    unique(legacy_ids, "遗产")
    unique(achievement_ids, "成就")
    unique(secret_ids, "彩蛋")
    unique(life_action_ids, "生活行动")
    unique(job_ids, "工作")
    unique(item_ids, "物品")
    unique(moment_ids, "人生片段")
    unique(stage_art_ids, "阶段画面")

    if len(rounds) != rules["life_rounds"]:
        fail("成长节点数量不正确")
    if len(profiles) != rules["profiles"] or len(talents) != rules["talents"] or len(goals) != rules["goals"]:
        fail("起点、天赋或愿望数量不正确")
    if len(legacy_ids) != rules["legacy_count"]:
        fail("遗产数量不正确")
    if len(achievement_ids) != rules["achievements"] or len(secret_ids) != rules["secrets"]:
        fail("成就或彩蛋数量不正确")
    if len(life_action_ids) != rules["life_actions"] or len(job_ids) != rules["jobs"] or len(item_ids) != rules["items"]:
        fail("生活行动、工作或物品数量不正确")
    if len(moment_ids) != rules["moments"]:
        fail("人生片段数量不正确")
    if stage_art_ids != [stage.get("id") for stage in manifest.get("stages", [])] and len(stage_art_ids) != rules["stages"]:
        fail("阶段画面数量不正确")

    all_actions: list[str] = []
    stages: set[str] = set()
    for item in rounds:
        actions = item.get("action_ids", [])
        if len(actions) != rules["actions_per_round"]:
            fail(f"节点 {item.get('id')} 没有三个互斥选择")
        all_actions.extend(actions)
        stages.add(item.get("stage"))
    unique(all_actions, "行动")
    if len(all_actions) != rules["actions_total"]:
        fail("行动总数不正确")
    if len(stages) != rules["stages"]:
        fail("成长阶段数量不正确")

    assets = review.get("assets", [])
    if [asset.get("id") for asset in assets] != [item.get("id") for item in rounds]:
        fail("内容审阅记录没有覆盖全部成长节点且顺序不一致")
    for asset, round_item in zip(assets, rounds):
        if asset.get("action_ids") != round_item.get("action_ids"):
            fail(f"节点 {round_item.get('id')} 的审阅行动清单不一致")
        if asset.get("owner") != "A04" or asset.get("reviewer") != "A00" or asset.get("status") != "approved":
            fail(f"节点 {round_item.get('id')} 缺少内容负责人审阅状态")
    for group_name, entries, expected in [("生活行动", review.get("life_actions", []), life_action_ids), ("工作", review.get("jobs", []), job_ids), ("物品", review.get("items", []), item_ids)]:
        if [entry.get("id") for entry in entries] != expected:
            fail(f"内容审阅记录没有覆盖全部{group_name}")
        for entry in entries:
            if entry.get("owner") != "A04" or entry.get("reviewer") != "A00" or entry.get("status") != "approved":
                fail(f"{group_name} {entry.get('id')} 缺少内容负责人审阅状态")
    if [entry.get("id") for entry in review.get("moments", [])] != moment_ids:
        fail("内容审阅记录没有覆盖全部人生片段")
    for entry in review.get("moments", []):
        if entry.get("owner") != "A04" or entry.get("reviewer") != "A00" or entry.get("status") != "approved":
            fail(f"人生片段 {entry.get('id')} 缺少内容负责人审阅状态")
    if review.get("media", {}).get("stage_art") != stage_art_ids or review.get("media", {}).get("audio") != "local-web-audio-synth":
        fail("媒体审阅记录不完整")
    for key, value in review.get("checks", {}).items():
        if value != "passed":
            fail(f"内容检查项 {key} 尚未通过")

    required_content_markers = [
        "window.EchoTownContent",
        "maxRounds: 23",
        "requires:",
        "goalPoints:",
        "test:",
        "secrets:",
        "nextUse:",
        "actionPointsPerRound: 3",
        "lifeActions:",
        "jobs:",
        "items:",
        "moments:",
        "stageArt:",
    ]
    for marker in required_content_markers:
        if marker not in content:
            fail(f"运行时内容缺少 {marker}")
    for value in profiles + talents + goals + [item for action in all_actions for item in [action]] + legacy_ids + achievement_ids + secret_ids + life_action_ids + job_ids + item_ids + moment_ids + stage_art_ids:
        if f'"{value}"' not in content:
            fail(f"运行时内容缺少ID {value}")

    for marker in ["function getLegacyCandidates", "function confirmLegacies", "function unlockAchievements", "function requirementMet"]:
        if marker not in game:
            fail(f"运行时缺少系统标记 {marker}")
    if "Math.random" in content or "Math.random" in game or "fetch(" in game:
        fail("内容或运行时出现非确定性/联网依赖")

    print("status ok")
    print(f"content_version {manifest['content_version']}")
    print(f"rounds {len(rounds)}")
    print(f"actions {len(all_actions)}")
    print(f"profiles {len(profiles)}")
    print(f"talents {len(talents)}")
    print(f"goals {len(goals)}")
    print(f"legacies {len(legacy_ids)}")
    print(f"achievements {len(achievement_ids)}")
    print(f"secrets {len(secret_ids)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
