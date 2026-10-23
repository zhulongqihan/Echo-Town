#!/usr/bin/env python3
"""Validate the file-based planning and development-entry framework.

This checker is intentionally dependency-free. It reports structural and
contract errors; it does not decide product or game-design questions.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "planning" / "contracts" / "project-manifest.json"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    lines = text.splitlines()
    try:
        end = lines.index("---", 1)
    except ValueError:
        return {}
    result: dict[str, str] = {}
    for line in lines[1:end]:
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$", line)
        if match:
            result[match.group(1)] = match.group(2).strip()
    return result


def list_field(text: str, field: str) -> list[str]:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line.strip() != f"{field}:":
            continue
        values: list[str] = []
        for following in lines[index + 1 :]:
            if following.startswith("  - "):
                values.append(following[4:].strip())
            else:
                break
        return values
    return []


def resolve_link(source: Path, target: str) -> Path | None:
    target = unquote(target.split("#", 1)[0].split("?", 1)[0].strip())
    if not target or target.startswith(("http://", "https://", "mailto:", "ftp://")):
        return None
    if re.match(r"^[A-Za-z]:[\\/]", target):
        return Path(target)
    return (source.parent / target).resolve()


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    checks: dict[str, str] = {}

    if not MANIFEST_PATH.exists():
        errors.append("缺少 planning/contracts/project-manifest.json")
        print(json.dumps({"status": "error", "errors": errors}, ensure_ascii=False, indent=2))
        return 1

    try:
        manifest = json.loads(read_text(MANIFEST_PATH))
        checks["manifest_json"] = "passed"
    except Exception as exc:  # pragma: no cover - defensive reporting
        errors.append(f"项目契约JSON无法读取: {exc}")
        print(json.dumps({"status": "error", "errors": errors}, ensure_ascii=False, indent=2))
        return 1

    required_files = [ROOT / item for item in manifest.get("required_canonical_files", [])]
    required_files.extend(
        [
            ROOT / "planning" / "contracts" / "framework-entry-contract.md",
            ROOT / "planning" / "contracts" / "gate-matrix.md",
            ROOT / "planning" / "operations" / "recovery-runbook.md",
            ROOT / "planning" / "tools" / "validate_project.py",
            ROOT / "development" / "README.md",
        ]
    )
    missing = [str(path.relative_to(ROOT)) for path in required_files if not path.exists()]
    if missing:
        errors.extend(f"缺少必需文件: {item}" for item in missing)
    else:
        checks["required_files"] = "passed"

    master_path = ROOT / "planning" / "00_master-index.md"
    master_text = read_text(master_path) if master_path.exists() else ""
    master_meta = frontmatter(master_text)

    current_rule = master_meta.get("current_rule")
    if current_rule not in {"framework_first", "development"}:
        errors.append(f"总入口current_rule无效: {current_rule}")
    if current_rule == "framework_first" and master_meta.get("current_gate") != manifest.get("framework_gate"):
        errors.append(
            f"当前门禁不一致: 总入口={master_meta.get('current_gate')}，契约={manifest.get('framework_gate')}"
        )
    if current_rule == "development":
        if manifest.get("current_rule") != "development":
            errors.append("总入口已进入development，但项目契约未同步")
        if manifest.get("development_phase") != master_meta.get("current_gate"):
            errors.append(
                f"开发阶段不一致: 总入口={master_meta.get('current_gate')}，契约={manifest.get('development_phase')}"
            )

    # Mirror status in the master table against each canonical module.
    status_mismatches: list[str] = []
    row_pattern = re.compile(r"^\| .*? \| \[[^\]]+\]\(([^)]+)\) \| ([^|]+) \|$")
    for line in master_text.splitlines():
        match = row_pattern.match(line)
        if not match:
            continue
        linked = resolve_link(master_path, match.group(1))
        expected = match.group(2).strip()
        if linked is None or not linked.exists() or not linked.is_file():
            continue
        actual = frontmatter(read_text(linked)).get("status")
        if actual and actual != expected:
            status_mismatches.append(
                f"{linked.relative_to(ROOT)}: 总入口={expected}，专题={actual}"
            )
    if status_mismatches:
        errors.extend(f"状态镜像不一致: {item}" for item in status_mismatches)
    else:
        checks["module_status_mirror"] = "passed"

    # Role identity and STATE pairing.
    expected_roles = set(manifest.get("roles", []))
    role_ids: dict[str, Path] = {}
    for agent_file in sorted((ROOT / "planning" / "agents").glob("A*/AGENT.md")):
        meta = frontmatter(read_text(agent_file))
        agent_id = meta.get("agent_id")
        if not agent_id:
            errors.append(f"角色章程缺少agent_id: {agent_file.relative_to(ROOT)}")
            continue
        if agent_id in role_ids:
            errors.append(
                f"角色ID重复: {agent_id} 出现在 {role_ids[agent_id].relative_to(ROOT)} 和 {agent_file.relative_to(ROOT)}"
            )
        role_ids[agent_id] = agent_file
        state_file = agent_file.parent / "STATE.md"
        if not state_file.exists():
            errors.append(f"角色缺少STATE.md: {agent_file.parent.relative_to(ROOT)}")
        elif frontmatter(read_text(state_file)).get("agent_id") != agent_id:
            errors.append(f"AGENT与STATE的agent_id不一致: {agent_file.parent.relative_to(ROOT)}")
    if set(role_ids) != expected_roles:
        errors.append(f"角色集合不一致: 期望={sorted(expected_roles)}，实际={sorted(role_ids)}")
    else:
        checks["role_registry"] = "passed"

    # Task contract and active lease uniqueness.
    required_task_fields = manifest.get("task_required_fields", [])
    active_statuses = set(manifest.get("active_task_statuses", []))
    active_tasks: list[tuple[Path, dict[str, str], list[str]]] = []
    task_count = 0
    for task_file in sorted((ROOT / "planning" / "agents").rglob("TASK*.md")):
        if "templates" in task_file.parts:
            continue
        task_count += 1
        text = read_text(task_file)
        meta = frontmatter(text)
        for field in required_task_fields:
            if field not in meta and not list_field(text, field):
                errors.append(f"任务缺少契约字段 {field}: {task_file.relative_to(ROOT)}")
        status = meta.get("status", "")
        scope = list_field(text, "write_scope")
        if status in active_statuses:
            if not scope:
                errors.append(f"活动任务缺少非空write_scope: {task_file.relative_to(ROOT)}")
            try:
                if int(meta.get("revision_budget", "-1")) < 0:
                    errors.append(f"任务revision_budget无效: {task_file.relative_to(ROOT)}")
            except ValueError:
                errors.append(f"任务revision_budget不是整数: {task_file.relative_to(ROOT)}")
            active_tasks.append((task_file, meta, scope))
        if status.startswith("已回收") and meta.get("revoked_reason") in (None, "", "null"):
            errors.append(f"已回收任务缺少revoked_reason: {task_file.relative_to(ROOT)}")
    for index, (left_file, _, left_scope) in enumerate(active_tasks):
        for right_file, _, right_scope in active_tasks[index + 1 :]:
            for left in left_scope:
                for right in right_scope:
                    left_norm = left.rstrip("/") + "/" if left.endswith("/") else left
                    right_norm = right.rstrip("/") + "/" if right.endswith("/") else right
                    if left == right or left_norm.startswith(right_norm) or right_norm.startswith(left_norm):
                        errors.append(
                            f"有效租约写入范围冲突: {left_file.relative_to(ROOT)} 与 {right_file.relative_to(ROOT)} -> {left}, {right}"
                        )
    if not [error for error in errors if "任务缺少契约字段" in error or "有效租约写入范围冲突" in error]:
        checks["task_contract_and_leases"] = "passed"

    for task_file, meta, _ in active_tasks:
        agent_id = meta.get("agent_id")
        state_files = list((ROOT / "planning" / "agents").glob("*/STATE.md"))
        matching_state = next(
            (path for path in state_files if frontmatter(read_text(path)).get("agent_id") == agent_id),
            None,
        )
        if matching_state is None:
            errors.append(f"活动任务找不到对应角色STATE: {task_file.relative_to(ROOT)}")
            continue
        state_meta = frontmatter(read_text(matching_state))
        if state_meta.get("current_task") != meta.get("task_id"):
            errors.append(
                f"活动任务与STATE当前任务不一致: {task_file.relative_to(ROOT)} -> {matching_state.relative_to(ROOT)}"
            )
    if not any("活动任务与STATE当前任务不一致" in error for error in errors):
        checks["active_task_state_pair"] = "passed"

    if current_rule == "framework_first" and master_meta.get("current_gate") == "F0B":
        non_a00_active = [
            meta.get("agent_id", "unknown")
            for _, meta, _ in active_tasks
            if meta.get("agent_id") != "A00"
        ]
        if non_a00_active:
            errors.append(f"F0B期间存在非A00活动任务: {sorted(non_a00_active)}")
        else:
            checks["f0b_dispatch_lock"] = "passed"

    # Operational state files must advance together; event and decision logs
    # retain their own last-event/last-decision timestamps.
    control_paths = [
        ROOT / "planning" / "00_master-index.md",
        ROOT / "planning" / "agents" / "00-agent-registry.md",
        ROOT / "planning" / "agents" / "A00-main-integrator" / "STATE.md",
    ]
    control_as_of = {str(path.relative_to(ROOT)): frontmatter(read_text(path)).get("as_of") for path in control_paths if path.exists()}
    if len(set(control_as_of.values())) > 1:
        errors.append(f"当前控制状态as_of不一致: {control_as_of}")
    else:
        checks["control_metadata"] = "passed"

    event_log = ROOT / "planning" / "user-event-log.md"
    if event_log.exists() and master_meta.get("as_of"):
        event_times = re.findall(r"^- 时间：([^\s]+)", read_text(event_log), flags=re.MULTILINE)
        if event_times and max(event_times) > master_meta["as_of"]:
            errors.append("用户事件日志存在晚于总入口as_of的事件")

    # Latest handoff referenced by the master must exist.
    handoff_match = re.search(r"最新交接：\[[^\]]+\]\(([^)]+)\)", master_text)
    if handoff_match:
        handoff_path = resolve_link(master_path, handoff_match.group(1))
        if handoff_path is None or not handoff_path.exists():
            errors.append(f"总入口引用的最新交接不存在: {handoff_match.group(1)}")
        else:
            checks["latest_handoff"] = "passed"
    else:
        errors.append("总入口没有可解析的最新交接")

    # Check local Markdown links.
    missing_links: list[str] = []
    link_pattern = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
    markdown_roots = [ROOT / "planning", ROOT / "docs", ROOT / "development"]
    for base in markdown_roots:
        if not base.exists():
            continue
        for source in base.rglob("*.md"):
            for target in link_pattern.findall(read_text(source)):
                resolved = resolve_link(source, target)
                if resolved is not None and not resolved.exists():
                    missing_links.append(f"{source.relative_to(ROOT)} -> {target}")
    if missing_links:
        errors.extend(f"本地链接不存在: {item}" for item in missing_links)
    else:
        checks["markdown_links"] = "passed"

    # Before G10, runtime code is either fully locked (framework_first) or
    # limited to the explicitly authorized development roots (development).
    forbidden_extensions = {".py", ".js", ".ts", ".tsx", ".jsx", ".css", ".html", ".vue", ".svelte"}
    allowed = {Path(item).as_posix() for item in manifest.get("allowed_framework_code", [])}
    playable_entries = {Path(item).as_posix().lstrip("./") for item in manifest.get("playable_entries", [])}
    missing_playable_entries = [item for item in sorted(playable_entries) if not (ROOT / item).is_file()]
    if missing_playable_entries:
        errors.extend(f"项目契约声明的试玩入口不存在: {item}" for item in missing_playable_entries)
    code_files: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in forbidden_extensions:
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative not in allowed and relative not in playable_entries:
            code_files.append(relative)
    if current_rule == "framework_first":
        if code_files:
            errors.extend(f"开发解锁前出现代码文件: {item}" for item in code_files)
    else:
        allowed_roots = [str(item).strip("/") for item in manifest.get("allowed_runtime_roots", [])]
        auxiliary_roots = [str(item).strip("/") for item in manifest.get("allowed_auxiliary_code_roots", [])]
        if any(not item.startswith("output/") or ".." in Path(item).parts for item in auxiliary_roots):
            errors.append("辅助代码授权必须限定在output内明确子目录")
        allowed_roots += auxiliary_roots
        unauthorized = [
            item for item in code_files
            if not any(item == root or item.startswith(root + "/") for root in allowed_roots)
        ]
        if unauthorized:
            errors.extend(f"开发代码超出授权目录: {item}" for item in unauthorized)
    if not any("开发解锁前出现代码文件" in error or "开发代码超出授权目录" in error for error in errors):
        checks["development_lock"] = "passed"

    checks["runtime_policy"] = "passed" if current_rule in {"framework_first", "development"} else "failed"

    result = {
        "status": "error" if errors else "ok",
        "project": manifest.get("project_name"),
        "current_gate": master_meta.get("current_gate"),
        "task_count": task_count,
        "active_task_count": len(active_tasks),
        "checks": checks,
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
