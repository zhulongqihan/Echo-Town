# 未来 Agent 持久化工作区

本目录保存角色的“制度、状态和工作记录”。用户只与A00主窗口交互；用户授权开始或继续规划后，A00按当前门禁自动调度角色，不要求用户逐个启用。根据F0B规则，当前只运行A00框架任务。

## 双文件原则

每个角色目录至少包含：

- `AGENT.md`：角色宪法。规定使命、权限、禁区、依赖、输出和停止条件；角色本人不得修改。
- `STATE.md`：角色工作记忆。每轮结束必须由该角色更新；新对话据此恢复。

角色日后的任务简报、交接和自审记录也放在自己的目录中。文件名统一为：

- `TASK_YYYYMMDD_NNN.md`
- `HANDOFF_YYYYMMDD_HHMM.md`
- `REVIEW_YYYYMMDD_NNN.md`
- `PROPOSAL_YYYYMMDD_NNN.md`

## 权威顺序

用户最新明确修正 > `planning/00_master-index.md` > `planning/decision-log.md`与已锁定专题 > 角色`AGENT.md` > 当前任务简报 > 角色`STATE.md` > 交接、评审与研究材料。

若下位文件与上位文件冲突，角色必须暂停冲突部分并向A00报告，不得自行选择有利版本。

## 总览文件

- [00-agent-registry.md](00-agent-registry.md)：角色、状态、所有权和启动条件的唯一注册表。
- [01-startup-sequence.md](01-startup-sequence.md)：未来怎样按顺序启用角色。
- [02-permission-matrix.md](02-permission-matrix.md)：谁可以直接修改什么。
- [03-lifecycle-closed-loop.md](03-lifecycle-closed-loop.md)：每轮工作怎样形成闭环。
- [04-conflict-change-exit.md](04-conflict-change-exit.md)：冲突、变更、暂停、替换与退出。
- [../contracts/framework-entry-contract.md](../contracts/framework-entry-contract.md)：规划与开发入口契约。
- [../operations/recovery-runbook.md](../operations/recovery-runbook.md)：调度故障和跨会话恢复。
- [../tools/README.md](../tools/README.md)：项目自动校验入口。
- [templates](templates/)：任务、提案、状态、交接和自审模板。

## 角色目录

- `A00-main-integrator/`
- `A01-product-player-creative/`
- `A02-systems-events/`
- `A03-world-narrative/`
- `A04-content-ai-editor/`
- `A05-ux-ui-audio/`
- `A06-technical-data/`
- `A07-production-qa-risk/`
