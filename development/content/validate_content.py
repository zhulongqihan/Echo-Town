"""Validate the machine-readable content contract against the local game source."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "development" / "content" / "content-manifest.json"
REVIEW = ROOT / "development" / "content" / "content-review.json"
GAME = ROOT / "development" / "game" / "game.js"


def fail(errors: list[str]) -> int:
    for error in errors:
        print(f"ERROR: {error}")
    return 1


def main() -> int:
    errors: list[str] = []
    try:
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        review = json.loads(REVIEW.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - CLI error path
        return fail([f"无法读取内容目录: {exc}"])
    source = GAME.read_text(encoding="utf-8")
    events = catalog.get("events", [])
    if review.get("content_version") != catalog.get("content_version"):
        errors.append("内容目录与审校记录版本不一致")
    if review.get("baseline_no_ai") is not True or review.get("runtime_ai") is not False:
        errors.append("审校记录未证明删除AI草稿后仍有固定内容基线")
    if len(events) < 10:
        errors.append("事件数量少于10个")
    ages = [event.get("age") for event in events]
    if ages != sorted(ages) or len(set(ages)) != len(ages):
        errors.append("事件年龄必须唯一且按年龄升序")
    event_ids: list[str] = []
    choice_ids: list[str] = []
    for event in events:
        event_id = event.get("id")
        if not isinstance(event_id, str) or not event_id:
            errors.append("存在无效事件ID")
        event_ids.append(event_id)
        choices = event.get("choice_ids", [])
        if len(choices) != 3 or len(set(choices)) != 3:
            errors.append(f"事件{event_id}必须有3个唯一选择")
        choice_ids.extend(choices)
    assets = review.get("assets", [])
    asset_ids = [asset.get("id") for asset in assets]
    if set(asset_ids) != set(event_ids) or len(asset_ids) != len(set(asset_ids)):
        errors.append("审校资产必须与事件ID一一对应且不能重复")
    for asset in assets:
        if asset.get("owner") != "A04" or asset.get("reviewer") != "A00" or asset.get("status") != "approved":
            errors.append(f"事件{asset.get('id')}缺少最终责任人或通过状态")
    if len(set(event_ids)) != len(event_ids):
        errors.append("事件ID重复")
    if len(set(choice_ids)) != len(choice_ids):
        errors.append("选择ID重复")
    source_choice_ids = re.findall(r'choice\("([^"\\]+)"', source)
    missing = sorted(set(choice_ids) - set(source_choice_ids))
    if missing:
        errors.append(f"内容目录中的选择未在游戏源代码中找到: {', '.join(missing)}")
    if len(source_choice_ids) != len(set(source_choice_ids)):
        errors.append("游戏源代码存在重复选择ID")
    if len(source_choice_ids) != len(choice_ids):
        errors.append(f"内容目录选择数={len(choice_ids)}，游戏源代码选择数={len(source_choice_ids)}")
    contracts = catalog.get("choice_contracts", [])
    contract_ids = [contract.get("id") for contract in contracts]
    if set(contract_ids) != set(choice_ids) or len(contract_ids) != len(set(contract_ids)):
        errors.append("选择契约必须与事件选择ID一一对应且不能重复")
    for contract in contracts:
        if not isinstance(contract.get("effects"), list) or not contract.get("effects"):
            errors.append(f"选择{contract.get('id')}缺少显式效果契约")
    if "Math.random" in source or "fetch(" in source:
        errors.append("游戏运行时不得使用随机抽签或远程请求")
    for required in ("makeLifeSeed", "SAVE_VERSION = 3", "function getEvents", "function getEnding"):
        if required not in source:
            errors.append(f"游戏源代码缺少必需规则标记: {required}")
    endings = catalog.get("endings", [])
    ending_ids = [ending.get("id") for ending in endings]
    for ending_id in ("river-return", "names-remain", "hands-continue", "lights-answer", "unfinished-page"):
        if ending_id not in ending_ids:
            errors.append(f"内容目录缺少结局: {ending_id}")
    if errors:
        return fail(errors)
    print(json.dumps({
        "status": "ok",
        "content_version": catalog.get("content_version"),
        "events": len(events),
        "choices": len(choice_ids),
        "endings": len(endings),
        "runtime_generation": catalog.get("rules", {}).get("runtime_generation"),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
