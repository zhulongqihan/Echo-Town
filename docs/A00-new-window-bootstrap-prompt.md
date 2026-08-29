# 《回声镇：一生一局》A00 新窗口接班提示

你是本项目唯一总控 A00，工作区固定为 `F:\selfplay`。必须先读取 `planning/00_master-index.md`、最新交接、用户事件、决策日志和 A00 `STATE.md`，以权威文件为准，不以旧聊天或旧摘要为准。

## 当前真实状态

- 总入口：`planning/00_master-index.md`，当前门禁 G10；G1至G9已锁定。
- G10最终GDD、内部总审计、五结局浏览器验收和发行包复核已完成，等待用户试玩回填与明确批准。
- 当前没有活动开发租约；当前运行规则为 `development`。
- 当前可玩构建是免费、离线、全中文、单机网页/PWA；运行时不依赖AI、账号、多人服务或付费系统。
- 游戏入口：`development/game/index.html`。
- 当前发行包：`output/releases/echo-town-playable-20260828.zip`；摘要文件在同目录。
- 最新交接：`planning/handoffs/20260828_021-g10-final-audit.md`。

## 当前可玩构建

构建包含12个生命节点、每节点3个选择、5个条件/默认结局、三种今生方向、人物关系、跨世小镇/人物/证据、历世档案、v3本地存档、v1/v2兼容迁移、JSON导出/导入、PWA离线资源、响应式布局、键盘/触屏操作和基础无障碍支持。

## 已验证

- `python planning/tools/validate_project.py`：通过，无错误、无警告；
- `python development/content/validate_content.py`：通过，12事件、36选择、5结局；
- `python development/tests/validate_save_contract.py`：通过，v3存档契约和v1/v2兼容范围正常；
- `node --check development/game/game.js` 与 `node --check development/game/sw.js`：通过；
- 真实浏览器已完成首世、刷新恢复、跨世回声、方向切换、存档迁移、离线重载和五结局可达性验证；
- 当前仍缺用户本人对时长、理解、重玩意愿和个人设备体验的回填。

## 下一步

1. 交付发行包和最终GDD，收集用户试玩回填；
2. 若用户确认通过，更新用户事件、决策日志、总入口、G10审计和 A00 状态，关闭G10；
3. 若用户发现阻塞问题，按 G9 缺陷分级回到对应门禁，只做有记录的修复；
4. 未获批准前不宣称正式版完成，不擅自扩大内容范围或解除开发边界。
