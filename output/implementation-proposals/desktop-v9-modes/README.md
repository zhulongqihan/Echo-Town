# 三路线项目与独立挑战存档提案

2026-10-22。正式源码仍由 A00 集成；本目录未修改正式源码。

完整交付为 `save.js`。包括三项目严格 schema、历史摘要、实际行动/购买收据、当前 AP 不变量、28 岁反馈 active 拒绝；三种 journeyVariant 对应事件、节点、过去失败行动与当前 strategy 证据检查；以及独立主人生/固定挑战存储。

`save.routes-only.js` 为此前交付的三项目中间冻结稿，不再更新。`mode-functions.inc.js` 和 `build-proposal.py` 是完整稿生成源。`interfaces.md` 提供启动、模式切换、导入/导出和清除调用顺序；正式 modes.js 已按该接口接线并用于本轮测试。

## 验证

命令：

```text
node --test output/implementation-proposals/desktop-v9-modes/save.v9.test.js output/implementation-proposals/desktop-v9-modes/save.modes.test.js
```

本地结果见 `test-results.txt`。原有 26 项 v9 回归仍保留；唯一适配为实际 game.js 已改用 modes.js，因此 composition root 测试加载正式 modes.js，并给原来的 fake engine 增加 clone/setRuntimeMode/getChallengeDefinitions 最小接口。原始 v7/v8、启动失败、内存切换断言不变。

新增 15 项使用正式 content/strategy/projects/journey/engine/modes，以及本目录 save.js。包括固定工厂纯度和一致性、空 main、实际 v7/v8 启动迁移、当前内存与两槽磁盘切换、快照/指针/备份写失败、刷新续玩、坏高层引用保护、清除和重新开始、原始旧档保留、模式间误导入拒绝、512 KiB envelope 边界/2 MiB 原始输入、三种 journeyVariant 的证据拒绝和旧记录不追溯、隔离的旧制 raw backups、快照清理，以及实际命令走完挑战/40 世。

40 世循环每世保留完整历史，使用正常保守事件、遗产交接与下一世命令；每世在索引主槽保存、导出、导入。最终 40 条 history 全部保留，最大紧凑 payload **361,968 bytes**。这条容量测试是保守玩法；原 26 回归中的详细 40 世格式化旧档与完整项目摘要容量测试也保留。

挑战完整运行 6→75 的 23 节点；终局保存和重开成功，START_LIFE/CONFIRM_LEGACIES 不能生成挑战第二世。以实际纯工厂固定 craft 开局、seed 277191004 为起点，不借用主人生遗产。连续 80 次自动保存后只保留两槽当前引用快照，没有无限增长，旧原文与其他应用 key 保留。

## 存储事务与实际限制

单次 localStorage.setItem 提交 activeSlotId 与两槽快照引用。候选快照写失败、备份失败、指针写失败均保留原有效引用和调用者内存。成功后才清理本模块未被引用的快照；失败遗留临时快照由后续成功清理。备份保存完整 payload，不依赖可清理快照。

旧 load() 始终读 main 的最新有效引用。无 mode pointer 时沿用既有 main v9/v8/v7 迁移与写入行为；首次切模式后保留原 main v9 原文。旧 main 写 API 在 active 为挑战时拒绝，防止遗漏接线误写主档。

读写前后检查 pointer 与来源快照/原档是否发生变化，可拒绝已观察到的跨页面变化；localStorage 没有跨标签页 compare-and-swap，不声称消除了所有同时写入竞争。接口不提供 UI 任意键适配器。

坏 pointer JSON 或越界 refs 时无法可靠确定当前槽，拒绝回退、导入、清除和切换，保留两槽原文。提示应明确“模式记录损坏，无法确定当前模式”，不得承诺普通“清除当前槽”可恢复。合法 pointer 下的坏/缺失当前快照可以通过当前槽明确导入或清除恢复，另一槽仍保留。

本提案未替代浏览器验收，也未声称自动化证明游戏好玩。正式源码、UI、缓存更新与审阅标记由 A00 集成和验证。
