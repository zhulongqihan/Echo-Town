# 回声镇协作约定

- 使用中文回复。先核对目标、当前代码和调用链，再修改并验证；区分已验证事实、设计判断和假设。
- 恢复工作先读 `docs/current_state_summary.md`、`planning/00_master-index.md` 和最新用户事件；较新的明确用户指令优先于旧摘要。
- 唯一游戏源码在 `development/game/`，根 `index.html` 是稳定入口。保留无构建链、单机、离线、全中文和电脑端优先的产品约束。
- 不用历史提案覆盖正式源，不丢弃未提交材料，不破坏旧存档。跨模块修改保持命令、规则、存储和展示的现有边界。
- 适合独立分析或审查时可调用子代理；正式源码由主代理整合，子代理的提案放在 `output/implementation-proposals/`。
- **每个阶段完成后及时提交并推送 GitHub。** 这是用户持续要求，不因新窗口未再次提及而失效。仓库为 `git@github.com:zhulongqihan/Echo-Town.git`，交付分支为 `main`；禁止未经明确授权强制推送或丢弃历史。
- 同步正式源码、运行素材、必要测试样例、配置、当前说明和发行包。个人工具配置、凭据、本地备份和临时浏览器材料不进入仓库。详细操作见 `docs/repository_sync.md`。
- 交付报告分开说明：本地验证结果、提交 SHA、远端确认、是否在线部署。不能把源码推送描述为已上线。
- 主要校验：`node --test development/tests/*.test.js`、`python development/content/validate_content.py`、`python development/tests/validate_save_contract.py`、`python development/tests/validate_runtime_boundaries.py`、`python planning/tools/validate_project.py`。修改 UI 还需实际浏览器检查。
- 用户不参与试玩，不要求招募；自动化、代理评审不能作为真人乐趣、时长或留存证据。
- 面向玩家的界面、README 和发行包只保留有用的最终内容；内部执行过程写入开发记录。
- 压缩或总结上下文前，将进度、未解决问题与关键决定保存为 `docs/context_summary_YYYYMMDD_HHMM.md`，并通知用户。
