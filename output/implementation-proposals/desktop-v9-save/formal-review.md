# 正式 v9 存档与导入路径独立审阅

2026-10-22。仅只读正式源；所有复核脚本、元数据负例和报告写入本提案目录。结论：本次范围内未发现阻断缺陷。UI / 浏览器仍由 A00 迭代；本报告不替代最终视觉与浏览器验收。

## 正式集成核对

- 正式 `save.js` 的 SHA256 与冻结提案一致：`F58FA7CFA7F3067F79627CFC9B10C114342DC54DCD3FE8DDF3422478F4BD9271`。正式 engine 已用 v9 版本和独立主键，项目模块为最终 AP 守卫版本。
- game.js 保持 `load → normalize candidate → commit migration → replaceState`。v7 / v8 原键及原文均保留，启动只写 v9 一次；新主键写失败后回到默认只读恢复状态，普通开始指令被恢复锁阻止。坏 v9 / v8 阻断旧档回退与自动保存覆盖。
- `migrateV8ToV9` 只在旧 v8 缺字段时追加空 projects。真实 19 岁机会待选和已跳过、AP2 未安排生活时均可接入；已经使用 AP 时延期。不从旧工作记录重建步骤。已有 v7 migration 准入记录不重跑；v8 资源、机会、strategy、账本与世界事实完整比较通过。
- UI `importSave` 对候选执行 prepare 与 engine normalize 后，才用最新内存备份、保存候选，提交成功后 replaceState。实际 FileReader 回调路径已测试：备份写、原文备份写、主档写三类失败均保留原内存与主档，也不会显示导入成功。
- 28 岁反馈已存在但项目仍 active 的候选被 save 外部边界拒绝；engine 在正常事件处理内先 settleProject 再发 persist，内部瞬间不受这项外部检查干扰。当前节点 AP 上界及其他动作成本检查保留。
- 清除路径先 `SAVE.remove()` 成功才 `ENGINE.resetState()`；v9 tombstone 防止旧原文在刷新后复活。正式历史仍保持既有 40 世上限，没有新增删除历史或重评旧结局的逻辑；project 摘要按终态保存，不能反向解锁当前一世。

## 独立执行结果

```text
C:\Users\yang\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -X utf8 development/tests/validate_save_contract.py
C:\Users\yang\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -X utf8 development/tests/validate_runtime_boundaries.py
C:\Users\yang\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -X utf8 development/content/validate_content.py --allow-pending-review
node output/implementation-proposals/desktop-v9-save/formal-integration-review.cjs
C:\Users\yang\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -X utf8 output/implementation-proposals/desktop-v9-save/formal-validator-negative-review.py
```

结果：存档契约通过，其中真实正式源事务 / 迁移 / 项目测试 **67 / 67**；模块边界通过；内容结构通过（6.1.0、107 行动、23 保守选项、15 目标、3 链、1 项目与 1 新工作、图片 1,603,758 字节），正确显示 **2 条 pending**；正式引擎和真实 UI 导入函数联动 **22 / 22**；校验负例 **5 / 5 正确拒绝**。

22 项联动加载真实正式 save、engine、game，UI 仅抑制 DOM 渲染，保留原 importSave 回调与引擎实现。已覆盖 v8 青年三个接入断点、v7/v8 启动写失败与成功、两版导入三类存储失败、原文命名空间、最新内存备份、坏 JSON / 空壳 / null 项目、2 MiB 文件前置拒绝、28 岁反馈 active 项目拒绝以及坏较新主键保护。这是调用链验证，不是浏览器验证。快照 hash 和具体项目在 `formal-integration-review.json`，脚本可复跑。

## Validator 检查强度

逐项对比旧 v8 validator 与正式新版，没有移除原有结构、ID 引用、本地资源、图片容量、确定性、不联网、script 顺序、DOM / 存储 / 音频模块边界、dispatch 契约、只读快照、事务失败、PWA 媒体容错与缓存隔离检查。

新版增加了三份存储键互异与 CONTRACT 的真实 VM 比较、projects 接口和规则边界、scene / projects 的加载与离线壳、项目工作定义及引用、项目审阅范围，并把事务测试集合从两套扩大为四套。`--allow-pending-review` 仍只允许结构检查；默认模式会拒绝未完成审阅。

负例使用元数据副本，真实模块未改：错误主键、漏掉 v9 接受版本、虚构项目工作 ID、pending 项目审阅、借用 A04 批准全部失败。详细错误输出在 `formal-validator-negative-review.json`。负例未签署或修改任何正式审阅结论。

## 40 世容量证据与边界

本次正式存档校验运行保留 40 份完整旧历史、全阶段成果 / 后果 / 账本 / 项目摘要的紧凑往返断言；原格式化输入 > 512 KiB 且 < 2 MiB 的兼容测试也保留。此前本目录隔离整合测试的两组真实指令 40 世分别为 442,291 与 435,610 字节，完整日志在 `test-proposals-run.log`。本次没有重复执行整套 118 测试或重新刷两组 40 世；正式全套 118 / 118 是 A00 的整体验收结果，不冒充本次独立重跑。

原始输入上限仍为 2 MiB，紧凑有效状态与导出仍为 512 KiB。没有为通过校验缩小历史字段或删除额外旧历史。

## 非阻断建议与待收口项

UI 的前置文件大小常量读取 `SAVE.CONTRACT.maxImportBytes`，实际公开字段名为 `maxInputBytes`；当前 fallback 正好为 2 MiB，已验证实际行为正确。建议 A00 顺手改用公开字段，减少重复常量。

内容审阅目前仍有 `projects` 与 `desktop_project_and_migration` 两条 pending，需 A00 结合实际项目与浏览器结果收口；本报告不代签。最终 UI 正在继续迭代，调用链审阅的文件快照以 JSON 中 hash 为准。
