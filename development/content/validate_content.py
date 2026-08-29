"""Validate the D3 generational core-loop content contract."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "development" / "content" / "content-manifest.json"
REVIEW = ROOT / "development" / "content" / "content-review.json"
CONTENT = ROOT / "development" / "game" / "content.js"
GAME = ROOT / "development" / "game" / "game.js"


def fail(errors: list[str]) -> int:
    for error in errors:
        print(f"ERROR: {error}")
    return 1


def unique_strings(values: object) -> bool:
    return isinstance(values, list) and all(isinstance(value, str) and value for value in values) and len(values) == len(set(values))


def source_has_id(source: str, value: str) -> bool:
    return re.search(rf"\bid:\s*[\"']{re.escape(value)}[\"']", source) is not None


def main() -> int:
    errors: list[str] = []
    try:
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        review = json.loads(REVIEW.read_text(encoding="utf-8"))
        content_source = CONTENT.read_text(encoding="utf-8")
        game_source = GAME.read_text(encoding="utf-8")
    except Exception as exc:  # pragma: no cover - CLI error path
        return fail([f"无法读取内容目录或游戏源代码: {exc}"])

    version = catalog.get("content_version")
    rules = catalog.get("rules", {})
    rounds = catalog.get("rounds", [])
    profiles = catalog.get("profiles", [])
    goals = catalog.get("goals", [])
    legacy_ids = catalog.get("legacy_ids", [])
    assets = review.get("assets", [])

    if version != "2.0.0" or review.get("content_version") != version:
        errors.append("内容目录、审校记录必须统一为2.0.0")
    if review.get("baseline_no_ai") is not True or review.get("runtime_ai") is not False:
        errors.append("审校记录未证明删除AI草稿后仍有固定内容基线")
    if rules.get("life_rounds") != 8 or len(rounds) != 8:
        errors.append("D3必须有8个固定回合")
    if rules.get("actions_per_round") != 3:
        errors.append("D3每回合必须固定为3个行动")
    if rules.get("legacy_choices") != 2:
        errors.append("D3每世交接上限必须为2件遗产")
    if not unique_strings(profiles) or len(profiles) != 3:
        errors.append("必须有3个唯一人生起点ID")
    if not unique_strings(goals) or len(goals) != 3:
        errors.append("必须有3个唯一目标ID")
    if not unique_strings(legacy_ids) or len(legacy_ids) < 3:
        errors.append("必须有至少3个唯一遗产ID")

    round_ids: list[str] = []
    action_ids: list[str] = []
    for item in rounds:
        round_id = item.get("id")
        round_ids.append(round_id)
        if not isinstance(round_id, str) or not round_id:
            errors.append("存在无效回合ID")
        actions = item.get("action_ids", [])
        if not unique_strings(actions) or len(actions) != 3:
            errors.append(f"回合{round_id}必须有3个唯一行动")
        action_ids.extend(actions if isinstance(actions, list) else [])
    if len(round_ids) != len(set(round_ids)):
        errors.append("回合ID重复")
    if len(action_ids) != len(set(action_ids)):
        errors.append("行动ID重复")
    if len(action_ids) != 24:
        errors.append(f"D3行动总数应为24，当前为{len(action_ids)}")

    asset_ids = [asset.get("id") for asset in assets]
    if asset_ids != round_ids or len(asset_ids) != len(set(asset_ids)):
        errors.append("审校资产必须按回合与内容目录一一对应")
    for asset in assets:
        if asset.get("owner") != "A04" or asset.get("reviewer") != "A00" or asset.get("status") != "approved":
            errors.append(f"回合{asset.get('id')}缺少最终责任人或通过状态")
        if asset.get("action_ids") != next((item.get("action_ids") for item in rounds if item.get("id") == asset.get("id")), None):
            errors.append(f"审校回合{asset.get('id')}的行动清单不一致")

    if "window.EchoTownContent" not in content_source:
        errors.append("内容源代码缺少EchoTownContent入口")
    for required in ("maxRounds: 8", "requires:", "goalPoints:", "future:", "nextUse:"):
        if required not in content_source:
            errors.append(f"内容源代码缺少必需规则标记: {required}")
    for value in [*profiles, *goals, *legacy_ids, *round_ids, *action_ids]:
        if not source_has_id(content_source, value):
            errors.append(f"内容目录ID未在content.js中找到: {value}")
    if "Math.random" in content_source or "Math.random" in game_source or "fetch(" in content_source or "fetch(" in game_source:
        errors.append("游戏运行时不得使用随机抽签或远程请求")
    for required in ("SAVE_VERSION = 4", "function getLegacyCandidates", "function confirmLegacies"):
        if required not in game_source:
            errors.append(f"游戏源代码缺少必需规则标记: {required}")

    if errors:
        return fail(errors)
    print(json.dumps({
        "status": "ok",
        "content_version": version,
        "rounds": len(rounds),
        "actions": len(action_ids),
        "profiles": len(profiles),
        "goals": len(goals),
        "legacy_ids": len(legacy_ids),
        "runtime_generation": rules.get("runtime_generation"),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
