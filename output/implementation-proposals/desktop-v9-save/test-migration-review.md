# v9 测试迁移与严格语义复查

2026-10-22。本轮只写 `output/implementation-proposals/desktop-v9-save/`；正式源由 A00 集成。

## 可直接集成的材料

- `formal-tests-v9.patch`：8 份正式测试的统一差异，已运行 `git apply --check`，通过。
- `test-updates/development/tests/`：对应 8 份完整文件，供按文件审阅或复制。不要复制 `scratch-runtime` 为正式源。
- `save.js`：已修复下述两个真实语义边界，冻结 SHA256 为 `F58FA7CFA7F3067F79627CFC9B10C114342DC54DCD3FE8DDF3422478F4BD9271`。
- `save.v9.test.js`：26 项行为测试，全部通过。

| 测试 | 精确调整 | 保留的验收 |
|---|---|---|
| runtime.test.js | 加载 projects；当前版本断言改 9 | 模块隔离、确定性、AP、失败写入、容量拒绝 |
| runtime.migration.test.js | 删除内容字符串探测及旧提案 fallback；加载正式模块；真实 v7 夹具去掉 projects，旧事实比较只扣除新增字段 | 62 个断点原样比较、机会/检定/账单不重放；另断言新项目为空 |
| save.strategy.test.js | 当前状态用 migrateToCurrent；v7 原文用 v7StorageKey；三层来源、双旧档清除保护；补 v9 坏档与历史项目摘要 | 显式 migrateV7ToV8 输出 8 和幂等测试完整保留；真实 v8 备份与输入版本矩阵中的 8 保留 |
| natural-routes / strategy-runtime / economy-regressions | VM loader 加载 projects | 完整三路线、40 世、经济和原物品效果断言不变 |
| migration-access | loader 加项目；两个 v7 夹具去掉新增 projects | 旧目标准入证明、技能与资源不重算、阶段冻结不变 |
| strategy-record-import | loader 加项目并移除策略旧提案 fallback | 非法证据/后果拒绝、备份与原内存保持不变 |

build-benefits、strategy-behavior、work-action-budget 复用 natural-routes 的 loader，无需另加补丁。没有通过删除断言、放宽错误码或缩短历史来适配 v9。

## 已复现并修复的两个问题

1. 当前 24 岁记录了 2 AP 的帮工、sideActionsUsed = 1，但 AP 仍为 1 或 2：原提案 prepareImport 返回成功。新测试先报 `true !== false`；修复后拒绝。21 岁 1 AP 准备允许余 0 或 1 AP；第 2 次行动进行准备必须余 0 AP。判断使用上界，兼容主动放弃行动点。
2. 28 岁已经有真实事件证据、action 和 lastAction，但项目仍 active 且没有结果：原提案允许导入。advanceRound 不会再次结算，继续到 32 岁后 active 的时段条件失效。新测试先失败；现在 save 对外校验拒绝这种状态且未写备份或主档。没有在 Projects.normalize 全局禁止这一短暂内部形状，因此正常事件结算仍可发生。

复现时 26 个测试中 24 通过、2 失败；修复后 26 / 26 通过。使用真实 gameplay normalize 以及独立 save 两种加载方式都验证这些行为，不用内部实现返回值生成期望。

## 精确测试补丁的验证结果

```text
git apply --check output/implementation-proposals/desktop-v9-save/formal-tests-v9.patch
node --test output/implementation-proposals/desktop-v9-save/save.v9.test.js
C:\Users\yang\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -X utf8 output/implementation-proposals/desktop-v9-save/validate-test-proposals.py
```

结果依次为：补丁上下文匹配；26 / 26；8 份更新测试共 58 / 58。最后一项使用本目录内隔离副本：复制当时正式 content / strategy / engine，只把 engine 的保存版本和主键两个常量改为 9，结合冻结 save / projects 提案。来源 hash 和两处常量修改都记在 `scratch-runtime/manifest.json`，完整输出在 `test-proposals-run.log`。这证明补丁自身可运行，不冒充 A00 正式整合后的完整验收。

容量证据：两组通过正常命令完成的 40 世紧凑存档分别为 **442,291 字节**和 **435,610 字节**；都保留 40 世并完成保存/导出/导入。另一个既有容量测试加入 40 份项目摘要，连同全阶段成果、事件后果和账本总计继续通过 512 KiB 上限及整状态相等断言。旧格式化文件 > 512 KiB 而 < 2 MiB 的兼容验收仍保留。

此次复查确认并修复了上述两处边界。尚待 A00 完成正式脚本顺序、PWA 壳、契约 JSON / Python validator 更新，然后独立复核正式整合结果与浏览器体验。没有调整原始 2 MiB / 紧凑 512 KiB 上限，也没有裁剪历史。
