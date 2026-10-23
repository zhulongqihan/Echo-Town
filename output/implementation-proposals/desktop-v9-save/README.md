# desktop-v9 存档提案

2026-10-22；供 A00 集成。这里只修改本提案目录，未写正式源。

## 文件与已验证结果

- `save.js`：以当前 v8 完整存档模块为基线，保留原校验与返回契约，增加 v9 存储隔离、迁移、项目校验。
- `save.v9.test.js`：26 个行为测试。放在本目录时测试本提案；复制到 `development/tests/` 后测试正式 `development/game/save.js` 与 `projects.js`。
- `formal-tests-v9.patch`：8 份现有测试的精确迁移补丁；完整稿在 `test-updates/development/tests/`。兼容 helper 的输出 8 断言保留。
- `test-migration-review.md`：两处新增语义边界的复现与修复证据，以及补丁和容量复查结果。

在 `F:\selfplay` 执行：

```text
node --check output/implementation-proposals/desktop-v9-save/save.js
node --test output/implementation-proposals/desktop-v9-save/save.v9.test.js
```

结果：语法检查通过；26 / 26 通过，0 失败，0 跳过。

证据范围：独立 save VM；实际 content、strategy、projects 模块联合校验；实际 game.js 启动编排搭配受控引擎存根；40 世详细历史和 40 世项目摘要完整往返。这里未宣称完成正式引擎集成回归或浏览器验证，由 A00 集成后执行。

## 存储与迁移规则

| 项 | 值或行为 |
|---|---|
| `CONTRACT.storageKey` | `echo-town-generation-save-v9` |
| `CONTRACT.previousStorageKey` | `echo-town-generation-save-v8` |
| `CONTRACT.v7StorageKey` | `echo-town-generation-save` |
| `CONTRACT.backupKey` | `echo-town-generation-save-v9-before-import` |
| 原始导入备份 | v7 和 v8 各自独立的 `*-original-` 命名空间；保留原始文本 |
| 接受版本 | 7、8、9 |
| 文件上限 | 原始输入 2 MiB；紧凑有效状态和导出 512 KiB |
| `migrateV7ToV8()` | 兼容保留；只接收 7 / 8，仍输出 8 |
| `migrateV8ToV9()` | 接收 8 / 9，输出 9；仅 v8 缺项目时追加空项目 |
| `migrateToCurrent()` | 7 → 8 → 9；8 → 9；9 克隆，不重放规则 |
| `prepareImport()` | 最终候选为 9；来源版本留在返回 envelope，不改旧 `life.migration` |

读取顺序为 v9 → v8 → v7。较新键一旦存在，坏 JSON、错误结构、键与版本不一致均保护原档并停止回退。v8 旧清除标记与 v9 清除标记也停止回退，避免保留的旧键复活。普通持久化不能掩盖坏主档；尚未提交的旧档必须先显式迁移。

启动迁移只写一次 v9 主键，原 v8 / v7 键已构成原文备份，不再复制大文件。提交前再次核对原始文本与存储优先级；原档变化或出现更高版本键，返回 `STORAGE_CHANGED`。内存切换在写入成功之后。

手动导入先备份调用方最新有效内存，再备份 v7 / v8 导入原文，最后写 v9 主档；任何失败都不切换内存、不损伤原主档。备份本身可能已成功留下，主写失败时可用于恢复。原文 hash 碰撞用后缀避开，重复相同原文复用备份。清除只原子写入 v9 标记，旧键与其他应用数据不动。

## 项目结构与事实一致性

`life.projects = {version:1, eligibleFromRound:7|null, current:null|record}`，完整结构与 gameplay 的 `Projects.normalize` 一致。未知字段、显式 null 的当前项目容器、错误行动 / round / AP / 成本 / receiptId、未来步骤、缺真实证据或伪造结果均拒绝。

save 独立加载也验证结构和行动事实；实际页面存在 `EchoTownProjects.normalize` 时再次用私有副本做语义校验，验证不得修改候选或内存。工作 / 练习需要对应 strategy evidence；工具准备需要 21 岁 toolkit 的 purchase -12 账目及仍持有工具。completed 要求三步、结算时手艺 ≥ 5、28 岁动作记录及事件证据；当前 28 岁还须对应反馈。后续节点和结算保留当前一世的真实记录，无需从 history 反推。

当前节点的项目步骤还要求行动点已经付出，并计入该节点其他真实行动至少 1 点的成本；剩余行动点主动放弃不会误拒。28 岁已有事件反馈却项目仍 active 只在存档外部边界拒绝，避免越过唯一结算点；规则模块内部的结算瞬间仍可正常执行。

迁移只追加 `{version:1,eligibleFromRound,current:null}`：

- 活跃人生在 round < 7：`eligibleFromRound:7`。
- 活跃人生在 round 7，AP = 2、sideActionsUsed = 0、无 lastAction：`7`；机会待选、已选、跳过都兼容。
- 其余断点：`null`。不把旧工作、购买、机会、日志回填为新项目步骤。
- v9 缺 projects 允许通过，由引擎按真实当前断点初始化；已保存的 `eligibleFromRound:null` 永不自动提升。

`history.projects` 仅允许终态摘要：`{id,status,resultId,settledRound,stepsDone,preparationActionId,finalCraft?}`。stepsDone 为 0…3；preparationActionId 为 null / routine-repair / toolkit；withdrawn 无 finalCraft；completed 必须三步且手艺 ≥ 5。无项目可省略字段，也兼容 null。摘要不能解锁当前一世工作。40 世的完整历史与摘要全部保留，不删除历史来满足容量。

## A00 集成点

1. 用提案 `save.js` 替换正式存档模块；`engine.js` 的保存版本和主键改为 9 / 新键。
2. 页面加载项目模块后再启动 engine/game；引擎初始化新一世与缺项目旧档时调用 `Projects.normalize`，保持已存在的空、延期、完成和失败记录；不要重跑 v8 的 v7 策略准入。
3. game.js 现有 `load → normalize candidate → commit migrated → replaceState` 顺序已兼容本提案，专项测试读取了正式 game.js。保持失败恢复锁与 `ready.ok` 后切换内存，不把 `sourceVersion === 7` 写死。`loaded.needsCommit` 可作为明确命名，现有 `loaded.migrated` 同样可用。
4. 更新 save-contract.json：主键、previous 键、独立 v7 键、备份键、v8 原文前缀、version 9、accepted `[7,8,9]`；补项目 schema、迁移断点、清除标记和三层读取顺序。不要缩小历史或容量验收。
5. `validate_save_contract.py` 的 CONTRACT 映射补 `v7_storage_key → v7StorageKey`、`v8_backup_prefix → v8BackupPrefix`，仍从真实 Node VM 取 CONTRACT 并比较。保留所有事务、模块边界、脚本顺序、不联网和不 Math.random 检查。
6. 将专项测试复制正式测试目录后跑完整回归，浏览器复核实际旧 v8 启动迁移、青年接入与项目交接，以及坏 v9 主档保护。

## 旧测试最小调整建议

- `runtime.migration.test.js:32` 用源码包含 `version: 8` 决定是否回退旧提案，会令 v9 静默测试错误文件。删除版本字符串探测，直接加载正式 `GAME/save.js`；若要确认版本，用运行时 CONTRACT 断言 9。
- `save.strategy.test.js` 保留明确验证 `migrateV7ToV8` 的兼容测试以及输出 8 断言。凡测试当前主档、默认状态、persist、导入提交，改用 `migrateToCurrent`，断言当前版本 9；不要全局替换所有 8 字面量。
- 所有把 v7 原文放入 `CONTRACT.previousStorageKey` 的夹具改为 `CONTRACT.v7StorageKey`；previousStorageKey 现在只表示 v8。原本验证旧键不受影响的断言继续保留，并可同时保留 v8 / v7 两份原文。
- 测试名里的“一次新 v8 写入”改为 v9；预期仍只有一次主键提交，不能放宽写入次数。原 v7 原文备份前缀不变。
- 版本覆盖矩阵补 9，保留 7 / 8 和坏档案例；明确输入版本与最终候选版本的区别。较新键损坏应阻断回退，不能为测试通过改成自动寻找下一个好档。

上述建议只涉及版本和来源语义，不删除原有行为断言。
