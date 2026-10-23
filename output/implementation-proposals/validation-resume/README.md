# v8 校验与清单升级提案

日期：2026-10-15。仅写提案目录，未改正式源。

供 A00 审查并复制的 6 个文件：

- `development/content/validate_content.py`
- `development/content/content-manifest.json`
- `development/content/content-review.json`
- `development/tests/validate_runtime_boundaries.py`
- `development/tests/validate_save_contract.py`
- `planning/technical/save-contract.json`

3 JSON 续用并核对原 UI 子智能体提案；有效内容通过真实 Node VM 依次加载 content.js 和 strategy.js 后核对。107 行动、23 个无条件零成本保守选项、15 阶段目标、3 个至少跨 3 节点的双结果事件链、10 WebP 共 1,603,758 字节已通过结构检查。

内容审阅保留 5.0.0 历史原记录，新的 6.0.0 记录全部由 A00 待审，不冒用 A04 的历史批准。当前 73 项 pending。默认内容校验必须失败；`--allow-pending-review` 仅适用于实施中的机械检查。A00 实际审阅后才能将各项改为 approved / passed，并填写 reviewed_at。禁止批量把 pending 转为批准而不审阅。

运行命令（项目根目录 PowerShell）：

```powershell
$validationPython = 'C:/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$validationProposal = 'output/implementation-proposals/validation-resume'
& $validationPython -X utf8 "$validationProposal/development/content/validate_content.py" --root F:/selfplay --metadata-root $validationProposal --allow-pending-review
& $validationPython -X utf8 "$validationProposal/development/tests/validate_runtime_boundaries.py" --root F:/selfplay
& $validationPython -X utf8 "$validationProposal/development/tests/validate_save_contract.py" --root F:/selfplay --metadata-root $validationProposal
node output/implementation-proposals/validation-resume/validator-smoke.cjs
```

结果：内容机械检查通过但审阅待完成；模块边界、只读快照及 dispatch 既有契约通过；存档实际 CONTRACT 比对、26 个存档事务/迁移测试、SW 仅清理本游戏缓存、媒体加载失败不阻断安装、非导航缺失资源不回退 HTML 均通过。3 个负向校验也确认失败而非误报成功：未完成审阅、未知行动清单引用、错误导入容量。

集成后无需指定参数，默认项目根目录由正式文件路径推导。提案检查支持 `--root` 与 `--metadata-root`，不会复制或修改正式代码。存档校验会调用正式 `save.strategy.test.js` 和 `runtime.migration.test.js`，不能在缺失行为测试时仅凭字符串匹配通过。

主 agent 仍须处理：最终实际内容审阅及 reviewed_at；浏览器试玩/可玩性结论由实际验收给出；内容校验只证明结构和引用，不替代玩法审阅。
