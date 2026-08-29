# 《回声镇：一生一局》当前状态摘要

- 更新时间：2026-08-29T21:29:57+08:00
- 权威入口：[`planning/00_master-index.md`](../planning/00_master-index.md)
- 当前阶段：D3 核心循环垂直切片
- 当前状态：用户已授权 A00 按 CHANGE-20260829-006 开发验证。新切片已落地并通过静态校验、真实浏览器一世闭环、遗产交接、第二世开局、刷新恢复和镇志检查；这仍是垂直切片，不代表正式版规则锁定。
- 当前运行规则：`development`；全中文、网页/PWA、本地单机、无需账号和联网业务、运行时不依赖 AI。

## 本轮完成

- 用 8 个固定回合替换旧版 12 个线性生命节点；每回合从 3 个行动中选择 1 个。
- 首页加入“人生起点 + 本世目标”选择；游戏页固定呈现目标进度、资源、能力、关系、小镇基础和行动条件。
- 行动卡明确展示做什么、代价、预期结果；选择后锁定本回合，并反馈数值变化与对后面的影响。
- 结算页提供可解释结果与遗产交接；遗产会在下一世转成精力、手艺、关系或小镇基础的实际起点优势。
- 新增 `content.js` 静态内容源、内容 manifest、内容审校记录、D3 验收表；存档升级为 v4，旧版存档键保留但不自动迁移。
- Service Worker 应用壳加入内容源并升级缓存版本；响应式布局、大字模式、键盘 1 / 2 / 3、JSON 导入导出继续保留。

## 验证结果

- `python planning/tools/validate_project.py`：通过；
- `python development/content/validate_content.py`：通过（8 回合、24 行动、3 起点、3 目标、11 遗产）；
- `python development/tests/validate_save_contract.py`：通过（save v4、512 KiB 上限、解析后替换）；
- `node --check development/game/content.js`、`game.js`、`sw.js`：通过；
- 真实 Chromium：完成一世 8 回合 → 选择两件遗产 → 下一世看到遗产并实际获得精力/手艺加成 → 刷新后恢复；镇志记录世代、目标、行动和遗产；最新缓存加载无控制台错误。

## 当前仍未决

- 用户本人尚未回填真实一世时长、第一眼理解、第二世重玩意愿和本人设备体验；
- D3 只验证核心循环，不代表正式版内容规模、长期重玩、最终 GDD 和 G10 已批准；
- 旧版 12 节点发行包保留作回退基线，新 D3 代码暂未替换旧发行包。

## 关键入口

- 游戏入口：[`development/game/index.html`](../development/game/index.html)
- 新核心规则：[`development/game/content.js`](../development/game/content.js)
- D3 验收表：[`development/tests/core-loop-mvp-acceptance.md`](../development/tests/core-loop-mvp-acceptance.md)
- 变更申请：[`planning/changes/CHANGE_20260829_006.md`](../planning/changes/CHANGE_20260829_006.md)
- 最新交接：[`planning/handoffs/20260829_024-core-loop-mvp.md`](../planning/handoffs/20260829_024-core-loop-mvp.md)

## 恢复规则

新会话先读取 `planning/00_master-index.md`、最新交接、`planning/user-event-log.md`、`planning/decision-log.md` 和 `planning/agents/A00-main-integrator/STATE.md`；本摘要只作快速导航，不覆盖权威入口。
