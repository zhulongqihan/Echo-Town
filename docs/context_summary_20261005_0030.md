# 经营策略 v8 实施续接（2026-10-05）

用户已明确批准完整实施《回声镇》经营策略优化计划，先前“只做计划”已被覆盖。中文交付。保留原有未提交工作；基线备份为 `output/baselines/strategy-v7-20261005-001416.zip`。

## 已核对事实

- 正式实施任务为 TASK-20261005-A00-STRATEGY-001，决策 DEC-20261005-025，MASTER 3.39。A00 是源代码最终写入者，子 agent 只产出 output 下提案。
- 原项目 D5/v7；目标 D6/v8，独立存储键。离线静态网页，23 节点、五阶段、每节点 2 行动点不变。
- 主 agent 已修改 engine.js/content.js/game.js/sw.js，新增 strategy-runtime.test.js。目前是尚未全部集成、尚未全面验收的工作中版本，不能声称完整通过。
- engine 已加入真实成本、精力恢复、技能阶段上限、事务账本、真实检定成果、只读预览、操作阶段、新命令；仍需核对预览附加兴趣效果、后果反馈、阶段结算后愿望重算。
- runtime 提案 `output/implementation-proposals/runtime/save.js` 与 `save.strategy.test.js` 已完成：18 单测通过；原子导入、v7 迁移、坏档拒绝、清除标记；坏档启动需要主 agent 阻止空状态覆盖。
- strategy 提案 `output/implementation-proposals/strategy/strategy.js` 已完成：15 成果、3 链、3 遗产用途、3 晚年交接，共107个事件行动；记录使用紧凑 ID，提供 getAllGoals/getConsequences。受控分支检查通过，但自然成长三路线仍需实测。
- UI 提案 `output/implementation-proposals/ui/{index.html,ui.js,styles.css,audio.js,assets/*.webp}` 已冻结，可集成。四步流程、目标/资源/账单、预设与自定义、事务导入、音量试听。10 WebP 总1,603,758字节；原PNG保留在仓库。

## 待完成

1. 审阅并集成三个提案，统一 API 和媒体路径；补坏档启动保护。
2. 更新现有测试/校验到 v8，执行真实成本、迁移断点、40世容量、三路线完整成长与转线/困境回归。
3. 启动本地服务，真实浏览器验收桌面/390×844手机/键盘/刷新/离线/双击入口/配乐，修复发现问题。
4. 更新运行契约、README、内容/存档清单、项目状态与验收交接；只有实际通过才能记为通过。

## 重要接口与约束

- 加载次序 content → strategy → save → engine → audio → ui → game。
- UI 只能 dispatch，不写规则状态；getState/getSetup 返回副本。
- previewAction.cost 为中文字符串；remaining={money,energy,actionPoints}。
- getLifePhase 返回 start/ending/opportunity/management/event/feedback。
- 导入 prepareImport → commitImport(候选, 当前内存) → 成功后 replaceState；失败保留主档与内存。
- save.load 为只读结果对象；startupMigration 提交后替换内存；recoveryRequired 必须保护原主档。
- 2MiB 原文件输入、512KiB紧凑存档；不能删历史凑容量。
- context 总结只记录事实：现阶段没有完整浏览器和三路线自然成长验收结论。
