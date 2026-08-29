# Agent 写入权限与责任矩阵

符号：`O`直接所有者；`P`可提案；`R`只读审查；`L`锁定/整合；`—`默认不读取或无职责。

| 文件域 | A00 | A01 | A02 | A03 | A04 | A05 | A06 | A07 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 00总入口、decision-log | L/O | R | R | R | R | R | R | R |
| user-event-log | L/O | R | R | R | R | R | R | R |
| Agent注册表与角色宪法 | L/O | R | R | R | R | R | R | R |
| 各自STATE、任务内记录 | R | O | O | O | O | O | O | O |
| 01、02、03 | L/P | O | P | P | R | P | R | R |
| 04 | L/P | P | O | P | R | P | P | R |
| 05 | L/P | P | P | O | R/P | P | R | R |
| 06 | L/P | P | O | P | R/P | P | P | R |
| 07 | L/P | R | P | P | O | P | P | R |
| 08 | L/P | P | P | P | P | O | P | R |
| 09 | L/P | R | P | R | P | P | O | R |
| 10 | L/P | P | P | P | P | P | P | O |
| 11最终GDD | O/L | R | R | R | R | R | R | R |
| reviews/门禁报告 | L | P | P | P | P | P | P | O |
| planning/handoffs/根交接 | O | P | P | P | P | P | P | P |

## 强制规则

1. `O`不是无限权力：只能在有效任务简报规定的范围与租约期间直接写入。
2. 同一文件同一时刻只能有一个有效写入租约；A00负责发放和回收。
3. `P`必须写提案，不得直接改正文；提案要列建议、依据、影响、风险和验收。
4. `R`只能写独立评审记录，不能一边审查一边替被审者修正文。
5. `L`表示维护版本、状态与决策追踪，不表示A00可以绕过专业所有者和用户确认。
6. 角色永远不能修改自己的`AGENT.md`；只能提出变更申请，由A00做影响分析并经用户确认。
7. 任一角色发现P0冲突、上游版本变化、权限不清或事实来源不明，必须停止冲突部分。
8. 用户不直接修改专业专题；用户的确认、否决和纠正由 A00 记录到 `user-event-log.md`，再按决策规则更新权威文件。
9. A00不得把内部 Agent 的聊天内容直接当作事实；只有专题正文、状态、交接、审查和决策记录可进入项目状态。

## 写入租约字段

每份任务简报必须记录：`lease_owner`、`write_scope`、`issued_at`、`upstream_versions`、`expires_on_gate`、`revision_budget`、`stop_conditions`、`revoked_reason`。缺任何一项，租约无效。
