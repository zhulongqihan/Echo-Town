# 正式模式接线独立审查

2026-10-22。审查时正式 save.js 的 SHA256 为 `0E62BCF3AEB8B86C491E7412082645F6041A4FB368AB32FEE01FCBD21B65512F`。本轮仅在提案目录写文件，正式源码只读；没有重复运行原 41 项或 40 世容量循环。

## 两项实际缺陷与根因修复

1. **旧标签页可能覆盖主人生。** 窗口 A 留在挑战，窗口 B 切回主人生，A 再切主人生。原 Save.switchSlot 把磁盘 active 当作调用方内存来源；挑战 state 本身也是合法 v9，因此可被写进 main 快照。原样正式模块已复现返回成功。修复要求调用方显式传 `expectedSourceSlotId`，在工厂、normalize、备份、快照写入之前验证其合法且等于持久 active；缺失也拒绝。Modes 从自身 activeSlot 提供该参数。
2. **损坏挑战档无法导入有效备份。** 合法 pointer 指向坏/缺失挑战快照时，启动恢复页暂用 defaults（currentLife null）。原 commitSlotImport 要把它序列化为挑战 before-import 备份，因此在 `challenge.currentLife` 拒绝。修复由 Modes 持有临时 recoveryRequired，导入传 `recovery:true`；Save 再确认当前槽实际读取失败，独立保存原始 sourceKey/rawSource，才提交候选。恢复页 defaults 不冒充有效备份，已有最后有效 before-import 不变。坏高层 pointer 继续保护，不猜 main。

恢复备份描述符为 `{format:"echo-town-recovery-source",version:1,slotId,sourceKey,rawSource}`。missing 源记录 rawSource:null。独立前缀为 main=`echo-town-mode-main-recovery-raw-`、challenge=`echo-town-challenge-craft-start-v1-recovery-raw-`；不覆盖原始主/旧版键，不覆盖其他模式。GC 保留描述符引用的坏快照；缺失引用的键不能被新候选重用，避免把重建文件冒充原始档。恢复期间原来源或指针变化会拒绝提交。

完整修复稿为 `save.integration-fixes.js`、`modes.integration-fixes.js`；精确差异为同名 `.patch`。旧 `save.js` 冻结稿没有覆盖，以便主智能体核对增量。

## 正式接线路径

| 路径 | 实际调用 | 结果 |
|---|---|---|
| 人生操作、音量、字体、配乐状态 | UI dispatch / persist → Modes.persist → Save.persistSlot(activeSlot) | 未发现旧 main 写 API 漏接 |
| 启动 | game → Modes.boot → loadActive → normalize → commitLoad → apply | 候选提交成功才进入正常内存；失败保护来源 |
| 文件导出 | UI → Modes.serialize → serializeSlot(activeSlot) | 挑战 envelope 与独立文件名 |
| FileReader 导入 | 捕获 importSlot → onload 比较 → prepareSlotImport → engine.normalize → commitSlotImport → apply | 切槽期间读取完成时拒绝；失败不更新内存/引用 |
| 明确清除 | UI 确认当前模式 → Modes.remove → removeSlot(activeSlot) | 只清当前槽，挑战回固定起点，另一槽保留 |
| 手动切换/重开 | Modes.switchTo → Save.switchSlot → apply | 加显式来源守卫后拒绝旧页面误解释来源 |
| PWA 更新 | game 的 update 事件 → Modes.persist → 成功后 SKIP_WAITING | 当前槽保存失败不更新/重载；成功才通知 SW |

全目录检索只有 save.js 访问 localStorage。ui.js 中 STORAGE_KEY 仍有未使用声明，但没有用于读写。journey-ui 只调用只读 getActiveSlot，人生卡下载不调用存档写接口。

## 专项回归

`formal-mode-integration.test.js` 默认读取正式模块，未修改源码、没有替换 render 或业务函数。通过最小 DOM / FileReader / Storage / ServiceWorker 环境提供器执行正式 ui.bind、ui.dispatch、game 更新事件与下载回调；这属于模块集成行为测试，不替代真实浏览器视觉与设备验收。

提案测试命令：

```powershell
$env:ECHO_MODE_FIXES='1'
node --test output/implementation-proposals/desktop-v9-modes/formal-mode-integration.test.js
```

设置该变量时只选择两个完整修复模块，其余 content、strategy、projects、journey、engine、audio、ui、game 均读取正式文件。**9/9 通过**，结果见 `formal-integration-fixed.txt`。覆盖双窗口旧源、坏/缺失挑战恢复、有效备份不被覆盖、恢复失败三个写入阶段、外部修复与来源变化、缺失来源参数、坏目标/坏候选、真实 FileReader 切槽/失败/成功、自动保存/导出/清除/PWA 当前槽隔离，以及切回 v7/v8 主槽目标时迁移候选、指针提交失败和成功均保留精确旧原文。

集成时原正式 `save.modes.test.js` 两个直接调用 switchSlot 的测试需要显式加 `expectedSourceSlotId:"main"`，其余正常路径由 Modes 提供；这是新必填调用契约，保留原有失败/原文/内存断言。

localStorage 没有跨标签页 CAS。来源和引用的前后比较拒绝已经观察到的变化，不宣称完全消除检查完成后、单次提交前的极小跨进程竞争窗口。
