# 测试说明

在仓库根目录运行，需 Node.js 和 Python 3，无需安装第三方包：

```text
node --test development/tests/*.test.js
python development/content/validate_content.py
python development/tests/validate_save_contract.py
python development/tests/validate_runtime_boundaries.py
python planning/tools/validate_project.py
```

行为测试覆盖完整人生、三路线、项目、经济、真实事件后果、遗产、旧档迁移、40世容量及主线/挑战切换事务。必要项目样例位于已跟踪的 `output/implementation-proposals/desktop-v9-gameplay/fixtures/`。

UI、下载、导入、离线缓存、键盘和缩放需另行使用真实浏览器验证。当前验收见 [D7完整版验收](desktop-full-v9-acceptance-20261023.md)，补充核验见 [可玩性报告](../../docs/readiness_audit_20261023.md)。D2与旧版记录仅用于历史回溯。

功能测试不测定真人乐趣、实际游玩时长或重玩意愿。
