---
document_id: RECOVERY-RUNBOOK
title: 跨会话与调度故障恢复手册
status: 已启用
version: 1.0.0
as_of: 2026-08-28T17:25:19+08:00
updated_at: 2026-08-28T17:25:19+08:00
canonical: true
source: agents/01-startup-sequence.md、agents/03-lifecycle-closed-loop.md、agents/04-conflict-change-exit.md、DEC-20260828-014
pending: []
supersedes: []
---

# 跨会话与调度故障恢复手册

## 新会话恢复

1. 读取`planning/00_master-index.md`。
2. 读取总入口引用的最新根交接。
3. 读取`planning/user-event-log.md`中晚于总入口`as_of`的事件。
4. 读取当前任务、主责角色`STATE.md`和最近的审查文件。
5. 运行`python planning/tools/validate_project.py`。
6. 有错误、P0/P1冲突或不明迟到写入时，暂停推进并由A00处理。

## Agent无响应

1. 不把超时当成完成，也不根据最后一句聊天生成事实。
2. 扫描任务、专题、STATE、HANDOFF、REVIEW的文件状态。
3. 回收旧租约，填写`revoked_reason`和关闭时间。
4. 按任务顺序恢复同一角色；若再次无响应，由A00在授权写入范围内临时接管。
5. A00临时接管必须标明“专业复核待补”，不得自称独立审查。
6. 连续三轮同一阻塞没有新增证据时，升级到用户，不再空转。

## 实例关闭后迟到写入

1. 记录发现时间和文件修改时间。
2. 与任务签发时间、租约回收时间、文件版本和来源对照。
3. 未能证明属于有效租约的文件变更标为“待验证”，不得覆盖权威结论。
4. 需要保留时移入审查材料或写入PROPOSAL，由文件所有者决定是否吸收。

## 上游决策改变

1. A00先追加用户事件和决策记录。
2. 标记受影响专题和在途任务为“需重开”。
3. 回收旧租约，重新生成受影响任务的上游版本钉住。
4. 重新审查后才能恢复下游。

## 上下文压缩

只以权威文件为准。必须先生成项目根目录`docs/context_summary_YYYYMMDD_HHMM.md`，再继续工作；旧摘要只作历史参考，不得覆盖更新的用户事件或权威状态。
