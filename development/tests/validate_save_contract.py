"""Validate the authoritative local-save contract against the shipped static game."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "planning" / "technical" / "save-contract.json"
GAME_PATH = ROOT / "development" / "game" / "game.js"
SW_PATH = ROOT / "development" / "game" / "sw.js"


def fail(message: str) -> None:
    print(f"ERROR: {message}")
    raise SystemExit(1)


def main() -> int:
    try:
        contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        game = GAME_PATH.read_text(encoding="utf-8")
        sw = SW_PATH.read_text(encoding="utf-8")
    except (OSError, json.JSONDecodeError) as error:
        fail(f"无法读取契约或运行时文件: {error}")

    expected = {
        "storage_key": "echo-town-save",
        "save_version": 3,
        "accepted_versions": [1, 2, 3],
        "max_save_bytes": 524288,
    }
    for key, value in expected.items():
        if contract.get(key) != value:
            fail(f"契约字段 {key} 不正确")

    checks = [
        ('const STORAGE_KEY = "echo-town-save"', "存储键"),
        ("const SAVE_VERSION = 3", "存档版本"),
        ("const MAX_SAVE_BYTES = 512 * 1024", "存档大小上限"),
        ("function normalizeState(saved)", "状态归一化"),
        ("function makeLifeSeed(generation, historyLength = 0)", "确定性seed"),
        ("localStorage.setItem(STORAGE_KEY", "本地写入"),
        ("function importSave(file)", "导入入口"),
        ("function exportSave()", "导出入口"),
    ]
    for needle, label in checks:
        if needle not in game:
            fail(f"运行时代码缺少{label}标记")

    if not re.search(r"\[1, 2, SAVE_VERSION\]\.includes\(Number\(value\.version\)\)", game):
        fail("运行时代码没有明确接受v1/v2/v3")
    if "JSON.parse(reader.result)" not in game or "state = nextState" not in game:
        fail("导入没有体现先解析再替换状态的边界")
    if "fetch(" in game or "WebSocket" in game or "XMLHttpRequest" in game:
        fail("业务运行时代码出现联网接口")
    if "Math.random" in game:
        fail("运行时代码出现非确定性随机")

    shell_match = re.search(r"const APP_SHELL = \[(.*?)\];", sw, re.S)
    if not shell_match:
        fail("Service Worker缺少固定应用壳")
    shell = shell_match.group(1)
    for asset in ("./index.html", "./styles.css", "./game.js", "./manifest.webmanifest", "./favicon.svg", "./icon-192.svg", "./icon-512.svg"):
        if asset not in shell:
            fail(f"应用壳缺少本地资源 {asset}")
    if "http://" in shell or "https://" in shell:
        fail("应用壳包含外部资源")

    print("status ok")
    print(f"schema_version {contract['schema_version']}")
    print(f"save_version {contract['save_version']}")
    print(f"accepted_versions {','.join(map(str, contract['accepted_versions']))}")
    print(f"max_save_bytes {contract['max_save_bytes']}")
    print("runtime_network_calls false")
    print("runtime_randomness false")
    return 0


if __name__ == "__main__":
    sys.exit(main())
